# ADR-004: Lar com titular e um membro convidado; isolamento por RLS de lar e de dono

- **Status:** Aceito em 2026-10-24 (etapa 0 aprovada; antes: Proposto) (escolha do usuário na análise, P1)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)
- **Substitui (no legado):** o ADR-008 do MyMoney (cadastro fechado, um único lar criado à mão) e parte do ADR-002 (RLS com `auth.uid()`)

## Contexto

- O MyMoney tinha exatamente 1 lar e 2 membros, criados à mão. A RLS usava `auth.uid()` do Supabase, e `app.lar_atual()` assumia um lar único.
- O Controle em Casa tem cadastro aberto, então haverá muitos lares no mesmo banco.
- O Padrão LJS pede que toda tabela de negócio tenha a coluna do dono, RLS com `FORCE ROW LEVEL SECURITY`, uma transação por requisição com `SET LOCAL app.usuario_id`, e um teste negativo: o usuário B não lê nem escreve nada de A.
- O núcleo do produto depende de dois níveis de privacidade:
  - **conjunto:** visível aos membros do lar;
  - **individual:** visível só ao dono, inclusive a forma e a conta usadas numa despesa conjunta (RN-04).

## Decisão

1. **Modelo:**
   - Cada usuário pertence a **no máximo um lar**.
   - Quem se cadastra cria o lar no primeiro acesso e vira o **titular**.
   - O titular convida **um** membro por e-mail; o limite é de 2 membros por lar.
   - O plano (Free/Pro) é do lar e herdado do titular (ADR de cobrança, etapa 13).
2. **Colunas:** toda tabela de negócio tem `lar_id`; as tabelas com dado individual têm também `dono_id`. As FKs compostas `(id, dono_id)` e `(id, lar_id)` do legado são mantidas, para que um registro nunca aponte para outro de outro dono ou de outro lar.
3. **Identidade por transação:**
   - O middleware abre uma transação por requisição autenticada.
   - Ele grava `set_config('app.usuario_id', <id>, true)` e `set_config('app.lar_id', <id>, true)`. O `lar_id` vem do vínculo `membro` do usuário, nunca do cliente.
   - Só se usa a forma local à transação (`true`), por causa do pool do Hyperdrive.
4. **Políticas RLS (todas com `FORCE`):**
   - dado do lar (escopo conjunto): `lar_id = app.lar_id()`;
   - dado individual: `lar_id = app.lar_id() AND dono_id = app.usuario_id()`;
   - colunas privadas de uma despesa conjunta ficam em `lancamento_pagamento`, que é individual do pagador (separação física herdada do legado).
5. **Role `app`:** sem `BYPASSRLS`, sem DDL e sem `DELETE` onde excluir não é regra.
6. **Testes obrigatórios:**
   - para cada rota e cada tabela, o lar B não lê nem escreve nada do lar A;
   - o membro não vê o individual do outro membro;
   - duas requisições simultâneas não vazam o GUC uma para a outra.

## Consequências

**Positivas**
- O isolamento fica garantido no banco, mesmo se uma consulta da API esquecer um filtro (defesa em profundidade).
- O modelo de privacidade do legado, já testado, é mantido.

**Negativas**
- As quatro regras de produto que estavam em aberto foram **decididas em 2026-10-24**:
  - exclusão do titular com membro ativo: o lar é encerrado com aviso ao membro (e-mail e app); na purga, 30 dias depois, o lar inteiro some, inclusive o individual do membro, que ganha um lar novo vazio no próximo acesso;
  - saída ou remoção do membro (o titular pode remover): individual purgado em 30 dias; conjuntas que ele pagou ficam com "Ex-membro", sem a parte privada (`lancamento_pagamento`); movimentos de meta conjunta ficam sem a conta;
  - convidado que já tem lar: lar só com as categorias iniciais é descartado no aceite; com qualquer dado, o aceite é recusado com `ja_tem_lar` até ele excluir o próprio lar; titular com membro também recebe `ja_tem_lar`;
  - momento em que o lar perde o Pro: no fim do período pago (cancelamento), com 3 dias de carência no atraso; sem novo trial.
- O RLS com dois GUCs exige disciplina no middleware. Mitigação: um único ponto de abertura de transação, coberto por teste.
- Lar com mais de 2 membros exigirá revisão de regras (por exemplo, `pago_por_membro` e "o outro membro"); fica fora do escopo.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Só individual, sem lar | Perde o núcleo do produto (despesas conjuntas) |
| Lar com N membros | Escolha do usuário: até 2, como hoje |
| Isolamento só na aplicação, sem RLS (como o GestaodaPelada) | Contraria o padrão, e um filtro esquecido vaza dados de outro lar |
| Usuário em vários lares com lar ativo escolhido | Complexidade sem pedido; um lar por usuário basta |
