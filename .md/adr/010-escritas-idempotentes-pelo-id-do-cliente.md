# ADR-010: Escritas idempotentes pelo id do cliente

- **Status:** Aceito em 2026-10-25 (etapa 8). Proposto em 2026-10-24 (etapa 7).
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RT-01, RT-02 e RT-03 do `PRD-TECNICO.md` (CA-T1.3, CA-T2.1, CA-T3.1 a CA-T3.5); RN-03, RN-12, RN-17 e RN-18; SDD §3.1 (ids), §6 (convenção `PUT /recurso/:id`) e §7 (erros); GUARDRAILS G-03 e G-05; ADR-005 e ADR-009
- **Herda (no legado):** o id gerado no cliente das funções `salvar_conta`, `salvar_forma` e `salvar_categoria` (ADR-005 do MyMoney, "idempotente pelo id")

## Contexto

- O app funciona offline para lançar despesas (RNF-02) e reenvia a fila depois do login. O mesmo pedido pode chegar duas vezes, ou duas vezes ao mesmo tempo (duplo toque, duas abas, reenvio da fila). Gravar duas vezes é defeito (CA-T3.3).
- Com vários lares e dois membros por lar, um id escolhido pelo cliente pode colidir com o id de outra pessoa. A colisão não pode revelar que o outro registro existe (CA-T3.2) nem deixar o cliente alterá-lo.
- No legado o id vinha do cliente e a função fazia `update` e, se não achava, `insert`, traduzindo `unique_violation` em `registro_invalido`. A RLS escondia a linha alheia, então "não existe" e "é de outro" eram indistinguíveis.
- Os cadastros (conta, forma, categoria) são "salvar": o mesmo id é usado para criar e para editar. Os lançamentos (etapa 8) são "criar": o reenvio devolve o que foi gravado.

## Decisão

1. **O id é do cliente, em toda escrita que cria registro** (uuid v4). `conta` e `forma_pagamento` não têm `default gen_random_uuid()`: o id obrigatório impede a API de gerar um id sem querer. A `categoria` (etapa 6) mantém o default, que só serve às categorias iniciais criadas pelo servidor; as rotas de cadastro sempre passam o id do cliente. `movimento_conta` é a exceção: o ajuste não é idempotente por id (a repetição é absorvida porque a diferença volta a ser 0, CA-12.3), então o id é gerado no banco.
2. **Cadastros usam `PUT /recurso/:id` = criar ou atualizar** (SDD §6). Resposta `{ id }` com **201** quando criou e **200** quando o id já era do mesmo membro. O reenvio da mesma escrita devolve o mesmo resultado sem duplicar; o mesmo id com **corpo diferente, pelo mesmo membro, atualiza** o registro (é o "salvar" do legado). A regra "reenvio sem comparar parâmetros" (RT-03) vale para as escritas que só criam (lançamento, pagamento de cartão, movimento de meta, na etapa 8 em diante): lá o reenvio devolve o gravado com `ja_existia: true` e ignora o corpo novo. Decisão do usuário de 2026-10-25 (etapa 8): essas rotas de criação respondem 201 ao criar e 200 se já existia, com `ja_existia` no corpo (lançamento: a resposta gravada inteira; pagamento de cartão: `{ id, ja_existia }`); os cadastros continuam respondendo só `{ id }`, com 201 ou 200.
3. **Id de outro membro, de outro lar ou invisível a quem envia: `404 registro_invalido`**, idêntico ao de um recurso inexistente (RT-01). A API nunca distingue "existe e não é seu" de "não existe" e não altera a linha original.
4. **Corrida entre escritas do mesmo id.** Antes de ler, cada `salvar_*` toma `pg_advisory_xact_lock(4202, hashtext(id))`, que vale até o fim da transação. A segunda escrita espera a primeira confirmar e então enxerga a linha dela: grava como atualização (200) em vez de falhar. A trava é necessária porque a tabela tem mais de um índice único com o `id` (a chave primária e os `unique (id, dono_id)` e `(id, tipo, escopo)` usados pelas FKs compostas): sem ela, `ON CONFLICT (id) DO NOTHING` só arbitra a chave primária, e a inserção concorrente falha com 23505 em outro índice (observado nos testes: 500 em formas e 409 `nome_repetido` falso em categorias). Ids diferentes não esperam um ao outro.
5. **Passos de `salvar_*`:** (a) valida o corpo (contrato e domínio); (b) trava o id; (c) lê a linha pelo id **com o filtro explícito de dono ou de lar** (além da RLS, CA-T1.4); (d) se existe, valida as regras de edição e atualiza; (e) se não existe, `INSERT … ON CONFLICT (id) DO NOTHING`; (f) se o `INSERT` não gravou, o id é de quem a RLS esconde: `registro_invalido`. A corrida do passo (e) com a mesma pessoa não chega ao (f) por causa da trava do item 4.
6. **Ordem das recusas (RT-02) nos cadastros:** `sessao_expirada` → `origem_invalida` → `registro_invalido` (id de rota malformado; recurso ou conta referida que não é do membro) → `valor_invalido` (corpo; regra de domínio como tipo imutável ou forma arquivada como preferida) → `*_arquivada` → demais (`nome_repetido`, `em_uso`, `categoria_em_uso`). Duas particularidades que o PRD-TECNICO herda do legado e que ficam registradas aqui:
   - O corpo é validado **antes** de consultar o id (como em `salvar_forma.sql` e `salvar_conta.sql`): um corpo inválido responde `valor_invalido` para qualquer id, o que não revela nada de ninguém. Já o id de rota malformado responde `registro_invalido` antes do corpo.
   - A conta arquivada numa forma é `valor_invalido` (RN-03), não `conta_arquivada`: os códigos `*_arquivada` pertencem ao uso em lançamentos novos (etapa 8). Mesmo assim, a conta **de outro membro** e arquivada responde `registro_invalido`, nunca a recusa de arquivada.
7. **Excluir sem vazar vínculo (CA-T1.3).** A exclusão filtra por dono (ou por lar e escopo) **antes** de qualquer FK: o que não é do membro dá 0 linhas e `registro_invalido`; só uma linha do próprio membro pode chegar ao 23503, traduzido em `em_uso` (conta, forma) ou `categoria_em_uso`. Um `ON DELETE` em cascata nunca é usado: histórico não some por exclusão de cadastro (o caminho é arquivar).
8. **Operações de estado são idempotentes por natureza** (CA-T3.5), sem id novo: arquivar (204 sempre que o item é do membro), definir preferida (as duas direções), ajuste de saldo com diferença 0 (não grava).

## Consequências

**Positivas**
- O reenvio da fila offline e o duplo toque não duplicam nada, mesmo simultâneos; a unicidade vem do banco e a trava só serializa o mesmo id.
- Quem tenta o id de outra pessoa recebe a mesma resposta de um id inexistente e não consegue alterar nada (testado por rota, com o lar B e com o outro membro do mesmo lar).
- A regra não depende de a RLS "esconder": a API também filtra por dono (duas camadas, CA-T1.4).

**Negativas**
- Mais uma ida ao banco por escrita (a trava), no mesmo round-trip da transação aberta; é desprezível frente ao `set_config` e à leitura que já existem.
- O cliente precisa gerar uuid v4 (`crypto.randomUUID()`), inclusive no modo offline. Um id gerado mal (colisão, ou reaproveitado entre registros diferentes) recebe `registro_invalido` ou edita o registro anterior do mesmo membro: o front gera o id uma vez por intenção do usuário e o guarda na fila.
- `PUT` que edita com o mesmo id aceita "corpo diferente": a idempotência do cadastro é de resultado (mesmo estado final), não de payload. O front não deve reutilizar um id para dois cadastros distintos.
- A trava é por `hashtext`, de 32 bits: colisões entre ids diferentes só atrasam uma escrita, nunca a recusam.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Id gerado no banco (`default gen_random_uuid()`) com `POST` | Um reenvio vira um segundo registro; a fila offline precisaria de uma chave de idempotência à parte |
| Cabeçalho `Idempotency-Key` em vez do id na rota | Duas chaves para o mesmo recurso e armazenamento extra das respostas; o id do recurso já é a chave natural |
| Só `ON CONFLICT (id) DO UPDATE` | Com a RLS, o `DO UPDATE` de uma linha alheia não é visível e o erro vaza; e, com vários índices únicos com o `id`, ainda haveria 23505 em corrida |
| `ON CONFLICT DO NOTHING` sem alvo | Esconderia a violação de `categoria_unica` e responderia `registro_invalido` em vez de `nome_repetido` |
| Comparar o corpo do reenvio e recusar se diferente | Contraria RT-03 ("sem comparar os parâmetros") nas escritas de criação e quebra o "salvar" dos cadastros, que edita pelo mesmo id |
| Nível de isolamento `SERIALIZABLE` para a corrida | Exige repetir a transação inteira em falhas de serialização; a trava por id resolve só o caso, sem retentativa |
