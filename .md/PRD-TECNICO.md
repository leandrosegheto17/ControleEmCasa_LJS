# PRD-TECNICO — Controle em Casa

- **Status:** Aprovado pelo usuário em 2026-10-24 (etapa 0 do `.md/PLANO.md`).
- **Base:** `.md/ANALISE-MYMONEY.md` (§2 regras, §2.3 achados, §6 decisões P1–P9), `.md/PLANO.md`, `.md/PRD.md` e o legado `C:\Leandro\Projetos\MyMoney` (commit `282f2ae`, somente leitura).
- **Escopo:** regras de negócio, critérios de aceite e requisitos não funcionais. Rotas HTTP, tabelas, índices e políticas de RLS ficam no `.md/SDD.md`. Este documento cita tabelas só pelo nome.
- **Precedência:** as decisões P1–P9 do usuário vencem tudo. Abaixo delas, onde o documento do legado e o código do legado divergem, **o código vence** (ANALISE §2.3).

## 0. Convenções

| Item | Convenção |
|---|---|
| Regras | **RN-01…RN-18** mantêm a numeração e o significado do legado (`MyMoney/.md/PRD-TECNICO.md` §3), com o texto corrigido conforme o código. **RN-19…RN-28** são novas. **RT-01…RT-05** são regras transversais (valem para todas as RN) |
| Critérios de aceite | `CA-NN.M` (RN-NN) e `CA-Tn.M` (RT-0n), em notação EARS: "QUANDO … ENTÃO o sistema DEVE …"; "SE … ENTÃO …" para recusa; "ENQUANTO …" para estado. Cada CA vira ao menos um teste |
| Origem | `arquivo:linhas` do legado ou "nova — decisão Pn". Abreviações: **F** = `backend/supabase/schemas/app/funcoes/`, **A** = `.../api/funcoes/`, **T** = `.../app/tabelas/`, **TS** = `backend/supabase/tests/`, **L-PRD** = `MyMoney/.md/PRD-TECNICO.md`, **L-SDD** = `MyMoney/.md/SDD.md` |
| Pendências | `[A ESCLARECER: …]` marca o que o usuário ainda precisa decidir. Nada marcado assim deve ser implementado antes da resposta. Em 2026-10-24 o usuário decidiu todos os pontos do §6 |
| Interpretações | As interpretações I-01…I-22 do legado (L-PRD §7) continuam valendo e são citadas pelo número |

### 0.1 Glossário (só o que muda ou é novo)

| Termo | Significado |
|---|---|
| Usuário | Pessoa com conta (e-mail e senha). Tabela `usuario` |
| Lar | Unidade de isolamento. Todo dado de negócio pertence a exatamente um lar. Vários lares coexistem e nunca se enxergam |
| Membro | Vínculo usuário ↔ lar. Um lar tem **1 ou 2 membros** (P1). Tabela `membro` |
| Titular | O membro que criou o lar. Paga o plano. Há exatamente 1 titular por lar |
| Convidado | O segundo membro, que entrou por convite (RN-23) |
| Escopo | *Conjunto* (do lar) ou *Individual* (de um membro). Vem sempre da categoria (RN-01) |
| Pagador | Quem lançou uma despesa conjunta (ou pagou a ocorrência de fixa). No modelo, `dono_id` do lançamento |
| Competência | Mês em que um valor conta: o mês da **data da parcela** (RN-14) |
| Plano | Free ou Pro, do **lar** (RN-24) |
| Hoje | A data corrente em America/Sao_Paulo (RT-04) |

---

## 1. Regras transversais

### RT-01 — Isolamento por lar e anti-enumeração

**Definição.** Toda leitura e escrita é limitada ao lar do membro da sessão. Recurso inexistente, de outro lar ou privado de outro membro produz **a mesma resposta** (`registro_invalido`), sem revelar existência, uso, contagem ou total.

- CA-T1.1: QUANDO um membro do lar A pede, edita ou exclui qualquer registro do lar B, ENTÃO o sistema DEVE responder `registro_invalido`, idêntico ao de um id inexistente.
- CA-T1.2: QUANDO um membro pede um registro individual do outro membro do mesmo lar (conta, forma, categoria individual, lançamento individual, orçamento individual, meta individual, movimento de conta), ENTÃO o sistema DEVE responder `registro_invalido`.
- CA-T1.3: SE a exclusão de um recurso do outro membro falharia por estar "em uso", ENTÃO o sistema DEVE responder `registro_invalido` antes de qualquer checagem de uso (nunca `em_uso`/`categoria_em_uso`).
- CA-T1.4: O isolamento DEVE valer no banco (RLS FORCE por lar e por dono) e na API (filtro explícito), não só na tela. Nenhum total, lista ou erro pode usar dado individual do outro membro.
- CA-T1.5: Teste negativo obrigatório por tabela e por rota: com a sessão do lar B, nenhuma leitura retorna linha do lar A e nenhuma escrita altera o lar A.

Origem: L-PRD RN-10, RNF-04; A excluir_forma.sql:1-4,18-26; A excluir_conta.sql:1-3; contrato `erros.ts`; nova (vários lares) — decisão P1.

### RT-02 — Ordem das recusas

**Definição.** Quando vários erros se aplicam, o sistema responde o primeiro desta ordem:

| Ordem | Código | Exemplo |
|---|---|---|
| 1 | `sessao_expirada` | sem sessão válida |
| 2 | `origem_invalida` / `muitas_requisicoes` | cabeçalho anti-CSRF ausente; limite de taxa |
| 3 | `plano_necessario` | escrita de orçamento ou meta num lar Free (RN-25) |
| 4 | `registro_invalido` | id de outro lar, de outro membro ou inexistente |
| 5 | `valor_invalido` | valor, data, nº de parcelas fora da regra |
| 6 | `*_arquivada` | categoria, forma ou conta arquivada |
| 7 | demais regras | `sem_permissao`, `ocorrencia_paga`, `confirmar_descarte_ajustes`, `retirada_maior_que_guardado`, `em_uso` |

- CA-T2.1: SE a categoria informada é de outro membro **e** está arquivada, ENTÃO o sistema DEVE responder `registro_invalido` (nunca `categoria_arquivada`).
- CA-T2.2: SE a categoria e a forma do lançamento estão ambas arquivadas, ENTÃO o sistema DEVE responder `categoria_arquivada` (a categoria é checada antes da forma).
- CA-T2.3: SE um membro de lar Free tenta escrever num orçamento de outro lar, ENTÃO o sistema DEVE responder `plano_necessario` (o plano é checado antes do registro; não revela nada sobre o outro lar).

Exceções herdadas, mantidas como no código:
- Em `lancar_despesa` e `lancar_receita` o `valor_invalido` do valor vem **antes** da busca da categoria, mas depois da idempotência (A lancar_despesa.sql:36-51).
- Em `editar_lancamento` a ordem é: `registro_invalido` → `sem_permissao` → `valor_invalido` → `categoria_arquivada` → `forma_arquivada` → `confirmar_descarte_ajustes` (A editar_lancamento.sql:58-157).

Origem: `erros.ts`; A lancar_despesa.sql:36-68; A lancar_receita.sql:32-61; A definir_preferida.sql:22-34; nova (itens 1–3) — decisões P2, P5.

### RT-03 — Idempotência pelo id do cliente

**Definição.** Toda escrita que cria registro recebe o id (uuid v4) gerado no cliente. O reenvio com o mesmo id pelo **mesmo membro** devolve o que foi gravado, sem gravar de novo e **sem comparar os parâmetros** do reenvio. O mesmo id já usado por outro membro, ou num registro invisível a quem envia, resulta em `registro_invalido`.

- CA-T3.1: QUANDO o membro reenvia `lancar_despesa` com um id já gravado por ele, ENTÃO o sistema DEVE devolver a resposta gravada com `ja_existia: true` e não criar parcela nova, mesmo que valor ou categoria do reenvio sejam diferentes.
- CA-T3.2: SE o id pertence a um lançamento do outro membro (conjunto ou individual), ENTÃO o sistema DEVE responder `registro_invalido`.
- CA-T3.3: QUANDO duas requisições com o mesmo id chegam ao mesmo tempo, ENTÃO o sistema DEVE gravar uma só vez e responder às duas com o mesmo registro (a corrida é resolvida pela chave única).
- CA-T3.4: As escritas idempotentes são: conta, forma, categoria, lançamento (despesa e receita), pagamento de ocorrência, despesa fixa, meta, movimento de meta, pagamento de cartão, e os registros novos de convite, assinatura e inscrição de push.
- CA-T3.5: As operações de estado são idempotentes por natureza: arquivar, definir preferida, definir orçamento (`on conflict`), copiar orçamento (não sobrescreve), encerrar fixa (não move a 1ª data), desfazer pagamento já pendente (sucesso sem efeito), ajuste de saldo com diferença 0 (não grava).
- CA-T3.6: QUANDO a fila offline reenvia lançamentos depois de um novo login (RN-20), ENTÃO cada item DEVE ser aceito uma única vez pela regra acima.

Origem: F resposta_lancamento.sql:25-46; A lancar_despesa.sql:36-39,88-94; A pagar_ocorrencia.sql:32-40; A movimentar_meta.sql:41-47; A registrar_pagamento_cartao.sql:36-42; A ajustar_saldo.sql:39-41; A desfazer_pagamento.sql:28-30.

### RT-04 — Datas no fuso de São Paulo

**Definição.** "Hoje", "mês corrente", "mês fechado", vencimento atrasado e as janelas de geração usam a data civil em **America/Sao_Paulo**, independente do fuso do servidor (UTC no Worker e no Neon). Datas de negócio são datas de calendário (sem hora). Instantes (`criado_em`, `alterado_em`, sessão, expirações) são `timestamptz` e exibidos em São Paulo.

- CA-T4.1: QUANDO são 23:30 de 31/10 em São Paulo (02:30 de 01/11 em UTC), ENTÃO "hoje" DEVE ser 31/10 e o mês corrente outubro.
- CA-T4.2: O mês é sempre normalizado para o dia 1 (`2026-10-17` → `2026-10-01`) em qualquer parâmetro de mês.
- CA-T4.3: "Mês fechado" DEVE ser verdadeiro quando o dia 1 do mês seguinte é hoje ou já passou.

Origem: F hoje.sql:10; F mes_fechado.sql:10; ADR-004 do legado.

### RT-05 — Dinheiro em centavos

**Definição.** Todo valor monetário é inteiro em centavos (`bigint` no banco, `number` inteiro seguro no TypeScript). Nenhum cálculo usa ponto flutuante para guardar dinheiro. Exibição pt-BR: `R$ 1.234,56`.

- CA-T5.1: Valores de lançamento DEVEM estar entre 1 e 100.000.000.000 centavos (R$ 1 bilhão), inclusive.
- CA-T5.2: A soma das parcelas DEVE ser sempre igual ao total do lançamento.
- CA-T5.3: Percentuais são só para exibição (inteiros arredondados). Decisões de situação usam a razão exata em inteiros (RN-16, orçamento).

Origem: T lancamento.sql:13-15; F situacao_orcamento.sql:1-4; L-PRD RN-18, RNF-09.

### 1.1 Códigos de erro

A lista só cresce, de forma aditiva. A tradução para pt-BR é do front. Nenhum código carrega dado pessoal.

| Código | Origem | Quando |
|---|---|---|
| `valor_invalido` | legado | dado fora da regra (valor ≤ 0 ou acima do teto, nº de parcelas, dia fora de 1–31, data fora da faixa, campo obrigatório vazio, escopo de meta alterado) |
| `registro_invalido` | legado | não existe, é de outro lar, é privado de outro membro, id reusado por outro (RT-01, RT-03) |
| `sem_permissao` | legado | o outro membro tenta mudar campo que não pode (RN-06, RN-07, RN-28) |
| `confirmar_descarte_ajustes` | legado | edição da compra descartaria datas de parcela ajustadas à mão |
| `categoria_em_uso` | legado | excluir categoria com vínculo |
| `em_uso` | legado | excluir conta ou forma com vínculo |
| `nome_repetido` | legado | categoria com mesmo nome, tipo, escopo e dono no lar |
| `categoria_arquivada` · `forma_arquivada` · `conta_arquivada` | legado | uso de cadastro arquivado em escrita nova |
| `ocorrencia_paga` | legado | pagar ocorrência já paga |
| `retirada_maior_que_guardado` | legado | retirada acima do guardado no local |
| `credenciais_invalidas` | legado | e-mail inexistente **ou** senha errada (mesma resposta, RN-21) |
| `senha_fraca` | legado | senha fora da política (RN-19) |
| `link_expirado` | legado | token de confirmação ou de recuperação expirado, usado ou inexistente |
| `sessao_expirada` | **novo** | sem cookie, sessão inexistente, revogada, inativa > 15 min ou com mais de 12 h (RN-20) |
| `muitas_tentativas` | **novo** | bloqueio de login (RN-21) ou limite de taxa |
| `email_nao_confirmado` | **novo** | login com senha correta numa conta ainda não confirmada (RN-19) |
| `origem_invalida` | **novo** | escrita sem o cabeçalho anti-CSRF (RNF-06) |
| `convite_invalido` | **novo** | token de convite inexistente, expirado, usado, revogado ou de outro e-mail (mesma resposta, RN-23) |
| `lar_cheio` | **novo** | convite ou aceite num lar que já tem 2 membros (RN-23) |
| `plano_necessario` | **novo** | escrita de orçamento ou meta num lar sem Pro (RN-25) |
| `erro_interno` | **novo** | falha não prevista; detalhe só no Sentry, sem dado pessoal |
| `muitas_requisicoes` | **novo** | limite de taxa do binding (`LIMITE_ENTRAR`, `LIMITE_PUBLICO`, `LIMITE_WEBHOOK`); `muitas_tentativas` fica para o bloqueio de login (RN-21) |
| `conta_em_exclusao` | **novo** | login ou uso de uma conta com exclusão confirmada, ainda não purgada (RN-26) |
| `titular_obrigatorio` | **novo** | ação só do titular (convidar, remover membro, assinar, cancelar) (RN-22, RN-24) |
| `sem_lar` | **novo** | usuário autenticado ainda sem lar; o front leva ao primeiro acesso (RN-22) |
| `convite_pendente` · `ja_tem_lar` | **novo** | já existe convite aberto no lar; convidado já pertence a outro lar (RN-23) |
| `assinatura_ativa` · `sem_assinatura` | **novo** | assinar com assinatura ativa; cancelar sem assinatura (RN-24) |
| `token_invalido` | **novo** | webhook com token ausente ou errado (RN-24) |
| `corpo_grande` · `rota_inexistente` · `indisponivel` | **novo** | corpo acima do limite; rota inexistente; banco, Hyperdrive ou Asaas fora do ar |

Status HTTP de cada código: `SDD.md` §7.

---

## 2. Modelo de privacidade

O lar tem dois níveis de visibilidade: **lar** (os dois membros) e **dono** (só um). A matriz vale para tela, API, erro, contagem, total e notificação.

| Dado | Dono, pagador ou autor | Outro membro do lar | Outro lar |
|---|---|---|---|
| Conta (nome, saldo, movimentos, ajustes) | vê e edita | **nada** | nada |
| Forma de pagamento (nome, tipo, dia, gasto no crédito) | vê e edita | **nada** | nada |
| Categoria individual e seus lançamentos, orçamentos e totais | vê e edita | **nada**, nem em totais | nada |
| Receita (sempre individual) | vê e edita | **nada** | nada |
| Despesa conjunta: descrição, categoria, valor total, valor e data de cada parcela, k/N, pagador, `alterado_por`, `alterado_em` | vê e edita | vê; edita conforme RN-06 | nada |
| Despesa conjunta: forma, conta, data da operação, dia de vencimento aplicado, `data_ajustada` das parcelas | vê | **não vê (chaves omitidas)** | nada |
| Ocorrência de fixa: descrição, categoria, vencimento, previsto, valor pago, situação, pagador | vê | vê | nada |
| Ocorrência de fixa: forma, conta e data do pagamento | vê | **não vê** | nada |
| Quanto cada um pagou do conjunto no mês (`pago_por_membro`) | vê | vê | nada |
| Meu total, minha parte, receitas, resultado individual, guardado no mês | vê | **não vê** | nada |
| Orçamento conjunto | vê; edita (Pro) | vê; edita (Pro) | nada |
| Meta compartilhada: nome, alvo, prazo, guardado, falta, por local, cada movimento (valor, data, local, autor) | vê; movimenta (Pro) | vê; movimenta (Pro) | nada |
| Meta compartilhada: conta de origem/destino do movimento | vê (autor) | **não vê (chave omitida)** | nada |
| Meta individual | vê e edita | **nada** | nada |
| Outro membro: nome | — | vê | nada |
| Outro membro: e-mail, sessões, preferências de push | — | **não vê** | nada |
| Plano do lar (Free/Pro, situação, validade) | vê | vê | nada |
| Dados de cobrança (cobranças Pix, histórico, cancelar) | titular | **não vê** (decidido em 2026-10-24: o convidado vê em "Meu plano" só o plano e a validade) | nada |

### 2.1 Chaves omitidas

**Regra:** para quem não tem direito, a chave **não existe** na resposta. Não vem como `null`, porque `null` revelaria a existência do campo e, em alguns casos, o tipo da forma.

| Resposta | Chave omitida para o outro membro | Origem |
|---|---|---|
| Detalhe do lançamento | `pagamento` (inteiro: `forma`, `conta`, `data_operacao`, `dia_vencimento_aplicado`) | A lancamento.sql:65-84 |
| Detalhe do lançamento, cada parcela | `data_ajustada` | A lancamento.sql:58-59 |
| Movimentos de meta, cada linha | `conta` | A movimentos_meta.sql:36-40 |
| Lista de ocorrências | forma, conta e data do pagamento nunca saem (para ninguém) | F ocorrencias_do_mes.sql:4-8 |
| Resposta de `editar_lancamento`, `pagar_ocorrencia`, `movimentar_meta` | mínima, sem campo privado, também para o próprio autor | A editar_lancamento.sql:196-200; A movimentar_meta.sql:1-3 |

- CA-P.1 (vale como CA-04.6): QUANDO o outro membro pede o detalhe de uma despesa conjunta, ENTÃO a resposta NÃO DEVE conter as chaves `pagamento` nem `data_ajustada`; o teste confere a ausência da chave, não o valor.
- CA-P.2: QUANDO o outro membro filtra a lista do mês por uma forma que não é dele, ENTÃO o sistema DEVE devolver lista vazia, sem erro (não revela se a forma existe).
- CA-P.3: Efeito colateral aceito (I-22): o dia da parcela de uma conjunta no crédito pode deixar implícito o dia de vencimento do cartão do pagador.

---

## 3. Regras herdadas (RN-01 a RN-18)

### RN-01 — A categoria define o escopo

**Definição.** O escopo do lançamento vem sempre da categoria escolhida, nunca de parâmetro do cliente. Categoria conjunta → lançamento conjunto; categoria individual → lançamento individual do dono. A API não aceita campo de escopo no lançamento.

Padrões do lançamento rápido (era a RN-19 do legado; o número RN-19 agora é do cadastro): data = hoje (RT-04); forma = a preferida não arquivada, senão a da despesa mais recente do próprio membro com forma não arquivada; parcelas = 1; conta da receita = a da receita mais recente; categorias de despesa ordenadas pelo uso **do próprio membro** (conjuntas lançadas pelo outro não contam), empate por nome.

- CA-01.1: QUANDO o membro lança uma despesa numa categoria conjunta, ENTÃO o lançamento e todas as parcelas DEVEM ser conjuntos, com ele como pagador.
- CA-01.2: QUANDO o cliente envia um campo de escopo, ENTÃO o sistema DEVE ignorá-lo (o contrato não o tem) e usar o da categoria.
- CA-01.3: SE a categoria é de receita, inexistente, de outro lar ou individual do outro membro, ENTÃO `lancar_despesa` DEVE responder `registro_invalido`.
- CA-01.4: QUANDO não há forma preferida e o membro nunca lançou despesa, ENTÃO `forma_padrao_id` DEVE ser nulo.
- CA-01.5: QUANDO a forma preferida é arquivada, ENTÃO ela DEVE deixar de ser preferida e de ser o padrão.

Casos limite: categoria arquivada (→ `categoria_arquivada`, RT-02); outro membro lança 50 vezes em "Mercado" → não altera a ordem de quem não lançou.
Origem: A lancar_despesa.sql:46-51; A dados_lancamento.sql:1-7,24-45,48-60; A arquivar_forma.sql:18-20; L-PRD RN-01, RN-19.

### RN-02 — Dado individual é só do dono

**Definição.** Dado individual é visível e editável só pelo dono. Não aparece ao outro membro em lista, total, contagem, busca, erro ou notificação (matriz do §2).

- CA-02.1: QUANDO o membro B lista o mês, ENTÃO nenhum lançamento individual de A DEVE aparecer, nem afetar `total_filtrado_centavos` ou `quantidade`.
- CA-02.2: QUANDO B consulta o resumo do mês, ENTÃO nenhum valor do bloco individual de A DEVE ser derivável dos números mostrados a B (ver RN-16e).
- CA-02.3: QUANDO B pede `locais_guardados`, ENTÃO locais usados só em metas individuais de A NÃO DEVEM aparecer.

Origem: L-PRD RN-02; A lancamentos_mes.sql:1-7; A locais_guardados.sql:1-4; F totais_individuais.sql:1-6.

### RN-03 — Contas e formas são individuais e privadas

**Definição.** Não existe conta conjunta. Conta e forma pertencem a um membro e só ele as vê. Regras de cadastro (conforme o código):

| Cadastro | Regra |
|---|---|
| Conta | nome 1–80 caracteres após `trim`; saldo inicial padrão 0, **pode ser negativo**; arquivar é idempotente e não muda histórico; excluir com qualquer vínculo (lançamento, movimento, forma) → `em_uso` |
| Forma Pix/Débito | exige conta própria; o dia de vencimento é ignorado (gravado nulo) |
| Forma Crédito | exige dia de vencimento 1–31; conta opcional (só sugestão no pagamento de cartão) |
| Forma (geral) | o tipo não muda depois de criada (`valor_invalido`); mudar o dia não altera parcelas já gravadas nem `dia_vencimento_aplicado` (I-19); 1 preferida por dono; arquivada não vira preferida (`valor_invalido`); arquivar tira a preferência; excluir com vínculo → `em_uso` |
| Conta arquivada na forma | recusada (`valor_invalido`) só quando a conta da forma **muda** para uma arquivada |

- CA-03.1: SE a forma Pix ou Débito vem sem conta, ENTÃO o sistema DEVE responder `valor_invalido`.
- CA-03.2: SE a forma Crédito vem sem dia ou com dia fora de 1–31, ENTÃO o sistema DEVE responder `valor_invalido`.
- CA-03.3: QUANDO o membro muda o dia de vencimento de um cartão de 10 para 15, ENTÃO as parcelas já lançadas DEVEM manter as datas, e só compras novas usam o dia 15.
- CA-03.4: QUANDO o membro define uma forma como preferida, ENTÃO a preferida anterior dele DEVE deixar de ser, sem afetar a preferida do outro membro.
- CA-03.5: SE o membro tenta excluir uma conta com lançamento, movimento ou forma ligada, ENTÃO o sistema DEVE responder `em_uso` e manter a conta.

Origem: A salvar_conta.sql:1-40; A excluir_conta.sql:13-20; A salvar_forma.sql:1-78; A definir_preferida.sql:22-45; T forma_pagamento.sql:18-24; L-PRD RN-03.

### RN-04 — O que o outro membro vê na despesa conjunta

**Definição.** Na despesa conjunta o outro membro vê descrição, categoria, valor total, valor e data de cada parcela, indicação k/N, pagador (nome e `sou_eu`), `alterado_por` (nome) e `alterado_em`. **Não vê** forma, conta, data da operação, dia de vencimento aplicado nem `data_ajustada` — as chaves são omitidas (§2.1).

- CA-04.1: QUANDO o pagador pede o detalhe, ENTÃO a resposta DEVE conter `pagamento` e `data_ajustada` em cada parcela.
- CA-04.2: QUANDO o outro membro pede o detalhe, ENTÃO a resposta NÃO DEVE conter essas chaves (CA-P.1).
- CA-04.3: `parcela_em_foco` DEVE ser a parcela com data no mês corrente; se não houver, a 1ª.
- CA-04.4: `alterado_por` DEVE ser nulo enquanto o lançamento nunca foi editado.
- CA-04.5: Na receita, `pagamento.forma` DEVE ser nulo e `pagamento.conta` preenchida (só o dono a vê).

Origem: A lancamento.sql:1-85; L-PRD RN-04, I-01, I-13, I-22.

### RN-05 — O pagamento afeta só o pagador

**Definição.** Quem lança a despesa conjunta é o pagador; a conjunta nasce paga. O efeito no saldo (Pix/Débito) ou no cartão (Crédito) é do pagador e só ele o vê. O lançamento não tem campo "pagador" separado do autor.

- CA-05.1: QUANDO A lança uma conjunta no Pix ligado à conta X, ENTÃO o saldo de X DEVE cair na data da operação, e B NÃO DEVE ver X nem o efeito.
- CA-05.2: QUANDO A lança uma conjunta no Crédito, ENTÃO o gasto do cartão de A DEVE subir no mês de cada parcela, e nenhum saldo de conta muda.

Origem: A lancar_despesa.sql:1-5,73-87; F permissoes_edicao.sql:2-3; L-PRD RN-05, I-04.

### RN-06 — Quem edita o quê

**Definição (conforme o código, corrige o texto do legado).** Matriz de permissões de edição de um lançamento:

| Campo | Dono/pagador | Outro membro, conjunta comum | Outro membro, pagamento de fixa |
|---|---|---|---|
| descrição | sim | sim | não |
| valor total | sim | sim | não |
| data da operação | sim | **não** (revisado em 2026-10-25; ver abaixo) | não |
| categoria do mesmo escopo | sim | sim (só conjunta, visível) | não |
| categoria de outro escopo (RN-07) | sim | não | não |
| forma | sim | não | não |
| nº de parcelas | sim | não | não |
| data de uma parcela | sim, só Crédito (CA-06.x) | não | não |
| excluir | sim | sim | não |

Regras da edição:
- Parâmetro ausente = não muda; descrição vazia (`""` após `trim`) limpa a descrição; parâmetro igual ao gravado não conta como mudança.
- **Um único campo sem permissão recusa a edição inteira** (`sem_permissao`), antes de gravar qualquer coisa.
- Toda edição grava `alterado_por` e `alterado_em`.
- Mudar valor, parcelas, data, forma ou categoria **recalcula todas as parcelas** pela RN-14: mantém os ids das parcelas que continuam, apaga as que sobram, cria as que faltam e zera `data_ajustada`. Se havia parcela com `data_ajustada`, a edição exige `confirmar_descarte = true` (senão `confirmar_descarte_ajustes`).
- **Dia congelado:** o recálculo usa o `dia_vencimento_aplicado` gravado, não o dia atual do cartão, a menos que a forma tenha mudado.
- **Revisão de 2026-10-25 (decisão do usuário, etapa 8):** no legado o outro membro também mudava a data da conjunta fora do Crédito, e a edição dele recalculava as parcelas. A data da operação, a forma e o dia aplicado moram na parte privada do pagador (`lancamento_pagamento`, G-10), que o outro membro não lê nem grava sem `SECURITY DEFINER` (G-04, SDD D-04). Por isso: a data é só do pagador (o outro membro recebe `sem_permissao`); quando o outro membro muda o valor, os valores são redistribuídos pela regra da RN-14 **mantendo a data de cada parcela** (inclusive as ajustadas à mão), sem `confirmar_descarte`; quando ele muda a categoria (mesmo escopo), nada é recalculado. O recálculo completo continua valendo para o pagador.
- Receita aceita valor, data, descrição e categoria de receita; enviar forma numa receita → `registro_invalido`.
- Não existe exclusão nem edição de valor/categoria de parcela isolada.

- CA-06.1: QUANDO B edita descrição e valor de uma conjunta Pix de A, ENTÃO o sistema DEVE aplicar e gravar `alterado_por = B`.
- CA-06.2: SE B, numa conjunta de A no Crédito, envia uma data nova junto com uma descrição nova, ENTÃO o sistema DEVE responder `sem_permissao` e não mudar a descrição.
- CA-06.3: SE B tenta mudar forma ou nº de parcelas de uma conjunta de A, ENTÃO o sistema DEVE responder `sem_permissao`.
- CA-06.4: QUANDO A edita o valor de uma compra em 3x com uma parcela ajustada à mão sem `confirmar_descarte`, ENTÃO o sistema DEVE responder `confirmar_descarte_ajustes` sem gravar; com `confirmar_descarte = true`, DEVE recalcular e zerar os ajustes.
- CA-06.5: QUANDO A reduz uma compra de 5x para 3x, ENTÃO as parcelas 1–3 DEVEM manter os ids e as 4–5 DEVEM ser apagadas.
- CA-06.6: QUANDO o cartão mudou do dia 10 para o 20 e A edita o valor de uma compra antiga, ENTÃO as parcelas recalculadas DEVEM usar o dia 10 (congelado); se A trocar a forma, DEVEM usar o dia da forma nova.
- CA-06.7: QUANDO o pagador (dono) altera a data de uma parcela de compra no Crédito, ENTÃO só aquela parcela DEVE mudar, com `data_ajustada = true`, e passar a contar no mês da nova data. SE a compra não é no Crédito, a parcela é de outro membro ou não existe, ENTÃO `registro_invalido`. SE a data vem vazia, ENTÃO `valor_invalido`.
- CA-06.8: QUANDO alguém exclui um lançamento, ENTÃO todas as parcelas e a parte privada DEVEM ser excluídas juntas; a confirmação é da tela.

Casos limite: edição sem nenhuma mudança efetiva (sucesso, só grava `alterado_*`); valor editado abaixo do nº de parcelas no Crédito (`valor_invalido`, RN-14); categoria nova arquivada (`categoria_arquivada`); forma nova arquivada (`forma_arquivada`).
Origem: F permissoes_edicao.sql:38-59; A editar_lancamento.sql:1-200; A alterar_data_parcela.sql:1-37; A excluir_lancamento.sql:1-31; ANALISE §2.3 (o texto da RN-06 e da CA-08.5 do legado estava defasado).

### RN-07 — Mudança de escopo

**Definição.** Só o dono (quem lançou) troca a categoria por outra de escopo diferente. Categoria e escopo mudam juntos, e as parcelas acompanham. De conjunta para individual, a despesa some para o outro membro; de individual para conjunta, aparece a ele conforme a RN-04. Exceção: pagamento de fixa nunca muda de escopo (RN-28).

- CA-07.1: QUANDO A troca a categoria de uma conjunta sua para uma individual sua, ENTÃO o lançamento e as parcelas DEVEM virar individuais e sumir da lista e dos totais de B.
- CA-07.2: SE B tenta trocar a categoria de uma conjunta de A para uma categoria individual de B, ENTÃO o sistema DEVE responder `sem_permissao`.
- CA-07.3: SE A tenta usar uma categoria individual de B, ENTÃO o sistema DEVE responder `registro_invalido`.

Origem: A editar_lancamento.sql:87-110,163-172; L-PRD RN-07, I-03.

### RN-08 — Metas: visibilidade e progresso

**Definição.** Meta compartilhada (escopo conjunto) é vista e movimentada pelos dois; individual, só pelo dono. A meta **não se exclui**. O escopo só é definido na criação e nunca muda (mudar exporia o histórico). Nome não vazio; alvo > 0; prazo opcional, gravado como dia 1 do mês. Escrita exige Pro (RN-25).

Progresso, sempre derivado dos movimentos, em inteiros:

| Valor | Fórmula |
|---|---|
| guardado | Σ aportes − Σ retiradas (todos os locais) |
| falta | max(0, alvo − guardado) |
| percentual | se guardado < alvo: min(99, round(100 × guardado ÷ alvo)); senão 100 |
| meses | se há prazo: max(1, (ano×12+mês do prazo) − (ano×12+mês de hoje)) |
| mensal necessário | se há prazo e falta > 0: ⌈falta ÷ meses⌉; senão nulo |
| atingida | guardado ≥ alvo |
| por local | Σ por `local`, só locais com saldo > 0, ordem saldo desc, local |

`atingida_em` é marcado com hoje quando o guardado alcança o alvo (mantém a data original se já marcada) e **desmarcado** quando deixa de alcançar — reavaliado a cada movimento e a cada edição do alvo.

| Exemplo | guardado | alvo | % | falta | mensal (hoje out/2026) |
|---|---|---|---|---|---|
| quase lá | 99.600 | 100.000 | **99** (não 100) | 400 | prazo nov/2026 → 400 |
| atingida | 100.000 | 100.000 | 100 | 0 | nulo |
| passou | 150.000 | 100.000 | 100 | 0 | nulo |
| prazo jan/2027 | 0 | 100.000 | 0 | 100.000 | 3 meses → 33.334 |
| prazo vencido (set/2026) | 0 | 100.000 | 0 | 100.000 | mínimo 1 mês → 100.000 |

- CA-08.1: QUANDO uma meta é criada, ENTÃO DEVE nascer com guardado 0, sem movimento.
- CA-08.2: SE a edição envia um escopo diferente do gravado, ENTÃO o sistema DEVE responder `valor_invalido`.
- CA-08.3: QUANDO um aporte leva o guardado ao alvo, ENTÃO `atingida_em` DEVE ser hoje; QUANDO uma retirada o faz cair abaixo, ENTÃO `atingida_em` DEVE voltar a nulo.
- CA-08.4: QUANDO o alvo é reduzido para abaixo do guardado, ENTÃO a meta DEVE ficar atingida; aumentado acima, DEVE deixar de estar.
- CA-08.5: B vê os movimentos da meta compartilhada com valor, data, local e autor (`nome`, `sou_eu`); a chave `conta` só existe nas linhas do próprio autor.
- CA-08.6: No resumo, cada bloco lista as metas com o progresso **atual** (independente do mês navegado), não atingidas primeiro, depois por nome.

Origem: F progresso_meta.sql:1-56; F sincronizar_atingida_meta.sql:1-16; A salvar_meta.sql:1-55; A movimentos_meta.sql:1-47; A resumo_mes.sql:6-9,75-85; L-PRD RN-08, I-02.

### RN-09 — Onde está guardado; aporte e retirada

**Definição.** "Local" é texto livre (1–60 caracteres após `trim`), não é conta. Movimento de meta é **imutável** (não edita nem exclui). Conta é opcional: aporte com conta debita a conta (movimento de conta privado do autor, tipo `aporte`, saída); retirada com conta credita (tipo `retirada`, entrada). A conta deve ser do autor e não arquivada. A retirada é limitada ao guardado **naquele local**. Data padrão hoje.

- CA-09.1: SE a retirada é maior que o guardado no local informado (mesmo com saldo em outros locais), ENTÃO o sistema DEVE responder `retirada_maior_que_guardado`.
- CA-09.2: QUANDO duas retiradas simultâneas somadas passam do guardado, ENTÃO só uma DEVE ser aceita (serialização na meta).
- CA-09.3: SE a conta informada é de outro membro, arquivada ou inexistente, ENTÃO `registro_invalido`.
- CA-09.4: SE o local vem vazio ou o tipo não é aporte/retirada, ENTÃO `valor_invalido`.
- CA-09.5: A sugestão de locais DEVE listar os locais já usados nas metas visíveis, do uso mais recente ao mais antigo, incluindo locais zerados.

Origem: A movimentar_meta.sql:1-89; T movimento_meta.sql:10; A locais_guardados.sql:1-26; L-PRD RN-09.

### RN-10 — Isolamento no servidor

Ver RT-01. **Correção:** além do isolamento entre membros, agora vale o isolamento entre lares (vários lares no mesmo banco).
Origem: L-PRD RN-10; nova — decisão P1.

### RN-11 — Composição do lar

**Definição (corrigida).** O legado tinha um único lar com exatamente 2 membros criados à mão. Agora: **cada lar tem 1 titular e no máximo 1 convidado**; um usuário é membro de no máximo 1 lar; vários lares coexistem isolados. A criação do lar é a RN-22 e o convite a RN-23.

- CA-11.1: SE uma operação tentaria criar o 3º membro de um lar, ENTÃO o sistema DEVE recusar (`lar_cheio`), também sob concorrência.
- CA-11.2: SE um usuário já membro de um lar tentaria virar membro de outro, ENTÃO o sistema DEVE recusar com `ja_tem_lar`. O titular com membro no próprio lar também não aceita convite de outro lar (`ja_tem_lar`). O convidado com lar próprio segue a RN-23 (CA-23.9 a CA-23.11).
- CA-11.3: Um lar com 1 membro DEVE funcionar por completo: blocos conjunto e individual, com `pago_por_membro` de 1 linha (100%).

Origem: T lar.sql:8; T membro.sql:8-9; ANALISE §2.1; nova — decisão P1.

### RN-12 — Saldo de conta

**Definição.**

saldo(conta, até = hoje) = saldo inicial + Σ receitas com destino na conta − Σ despesas **Pix/Débito** pagas pela conta ± Σ movimentos de conta (ajuste, aporte, retirada, pagamento de cartão), contando só o que tem **data da operação ≤ hoje**.

- O valor de cada lançamento é a soma das suas parcelas (igual ao total).
- Crédito nunca entra (RN-13).
- Ajuste de saldo: o membro informa o saldo real; o sistema grava a diferença (com sinal) como movimento `ajuste` na data de hoje; diferença 0 não grava; há modo "simular" que só devolve a diferença; conta arquivada pode ser ajustada; saldo real negativo é aceito. Ajuste não é receita nem despesa.

- CA-12.1: QUANDO uma despesa Pix tem data futura, ENTÃO ela NÃO DEVE afetar o saldo até a data chegar.
- CA-12.2: QUANDO o membro informa saldo real 1.000 e o calculado é 1.250, ENTÃO o sistema DEVE gravar um ajuste de saída 250 e devolver −250.
- CA-12.3: QUANDO o membro reenvia o mesmo saldo real, ENTÃO o sistema DEVE devolver 0 e não gravar.
- CA-12.4: O ajuste NÃO DEVE aparecer em nenhum total, orçamento ou resultado.
- CA-12.5: O resumo mostra o saldo **atual** (até hoje) de cada conta não arquivada, em qualquer mês navegado.

Origem: F saldo_conta.sql:1-35; A ajustar_saldo.sql:1-50; A resumo_mes.sql:4-5,54-59; L-PRD RN-12, I-14.

### RN-13 — Crédito e cartão

**Definição.** Compra no Crédito não mexe em saldo de conta. Por forma de Crédito: **gasto no mês** = parcelas com data no mês; **comprometido futuro** = parcelas com data em meses seguintes. Exceção: pagamento de fixa no Crédito entra no cartão pela **data de cartão** = próximo vencimento após a data da operação (mesma regra da compra à vista, com o dia congelado), enquanto a parcela da casa fica no vencimento da ocorrência (RN-15, I-20). Pagamento de cartão: movimento de saída na conta de origem (do próprio membro, não arquivada), ligado à forma de Crédito; não abate o gasto do cartão e não entra em total; forma arquivada é aceita; data futura é aceita.

- CA-13.1: QUANDO o membro compra R$ 300 em 3x no cartão, ENTÃO o gasto do mês da 1ª parcela DEVE ser 100 e o comprometido futuro 200.
- CA-13.2: QUANDO a forma não é de Crédito, é do outro membro ou não existe, ENTÃO a consulta DEVE devolver nulo/nulo, sem revelar existência.
- CA-13.3: QUANDO uma fixa de vencimento 10/10 é paga no Crédito (dia 5) em 08/10, ENTÃO o cartão DEVE mostrar o valor em 05/11, e o total da casa em outubro.
- CA-13.4: Cartão arquivado DEVE aparecer no resumo só enquanto tiver gasto no mês ou comprometido > 0.
- CA-13.5: SE o pagamento de cartão aponta forma que não é Crédito, ou conta arquivada/alheia, ENTÃO `registro_invalido`.

Origem: F gasto_cartao.sql:1-47; A registrar_pagamento_cartao.sql:1-63; A resumo_mes.sql:61-73; L-PRD RN-13.

### RN-14 — Parcelas e competência

**Definição.**
- **Pix e Débito:** 1 parcela do total na data da operação. Nº de parcelas ≠ 1 → `valor_invalido`.
- **Receita:** 1 parcela na data da operação.
- **Crédito (1 a 24 parcelas):** parcela k (k = 1…N) tem data no **dia de vencimento** do cartão no mês **(mês da compra + k)**. Se o dia não existe naquele mês, vale o **último dia do mês**. Não há data de fechamento: a regra é sempre "a partir do mês seguinte", mesmo para compra no próprio dia do vencimento ou depois dele.
- **Valores:** base = ⌊total ÷ N⌋; parcelas 2…N = base; parcela 1 = total − base × (N − 1) (o resto fica na 1ª). Exige total ≥ N centavos.
- A competência de cada parcela é o mês da sua data. A tela mostra "Descrição (k/N)"; compra à vista não mostra "(1/1)".
- A data de compra não tem faixa validada no lançamento (o legado aceita qualquer data); só o pagamento de fixa limita a data (RN-15).

| # | Compra | Dia venc. | N | Total (centavos) | Parcelas (valor — data) |
|---|---|---|---|---|---|
| 1 | 15/10/2026 | 10 | 3 | 60.000 | 20.000 — 10/11/2026; 20.000 — 10/12/2026; 20.000 — 10/01/2027 |
| 2 | 15/10/2026 | 10 | 1 | 60.000 | 60.000 — 10/11/2026 |
| 3 | 10/10/2026 (no dia do vencimento) | 10 | 1 | 5.000 | 5.000 — 10/11/2026 |
| 4 | 15/10/2026 | 10 | 3 | 10.000 | **3.334** — 10/11; 3.333 — 10/12; 3.333 — 10/01/2027 |
| 5 | 31/01/2027 | 31 | 3 | 10.000 | 3.334 — **28/02/2027**; 3.333 — 31/03/2027; 3.333 — **30/04/2027** |
| 6 | 15/01/2028 (bissexto) | 30 | 2 | 101 | 51 — **29/02/2028**; 50 — 30/03/2028 |
| 7 | 20/12/2026 | 5 | 2 | 100 | 50 — 05/01/2027; 50 — 05/02/2027 (virada de ano) |
| 8 | 01/10/2026 | 15 | 24 | 100.000 | **4.182** — 15/11/2026; 23 × 4.166 — 15/12/2026 … 15/10/2028 |
| 9 | — | 10 | 3 | 2 | `valor_invalido` (total < N) |
| 10 | — | 10 | 25 ou 0 | 10.000 | `valor_invalido` |
| 11 | Pix em 15/10/2026 | — | 1 | 10.000 | 10.000 — 15/10/2026 |
| 12 | Pix | — | 2 | 10.000 | `valor_invalido` |

- CA-14.1: Os 12 casos da tabela DEVEM ser testes de unidade da função pura de parcelas (portados de TS parcelas/gerar_parcelas.sql e TS datas/dia_no_mes.sql).
- CA-14.2: QUANDO o membro confirma uma compra no Crédito, ENTÃO a resposta DEVE trazer `primeira_parcela_data`, para a tela avisar "1ª parcela em dd/mm" (I-18).
- CA-14.3: Para todo N em 1…24 e total em N…10^11, a soma das parcelas DEVE ser igual ao total e |parcela 1 − base| < N (teste por propriedade).
- CA-14.4: SE o dia de vencimento é nulo ou fora de 1–31, ENTÃO `valor_invalido`.

Origem: F gerar_parcelas.sql:1-31; F dia_no_mes.sql:1-17; F calcular_parcelas.sql:1-31; A lancar_despesa.sql:64-87; L-PRD RN-14, I-11, I-12, I-18.

### RN-15 — Despesas fixas conjuntas

**Definição.**
- **Modelo:** descrição não vazia, categoria **conjunta de despesa**, valor previsto > 0, dia de vencimento 1–31; `inicio` = mês da criação. Visível e editável pelos dois. **Não se exclui; só se encerra.** Fixa encerrada não é editada (`valor_invalido`).
- **Editar** valor ou dia atualiza as ocorrências **pendentes** do mês corrente em diante; pagas e meses passados ficam intactos.
- **Ocorrências** geradas sob demanda ao consultar um mês (resumo ou fixas), 1 por fixa ativa no mês (`unique(fixa, mês)`, idempotente sob concorrência), vencimento = dia do modelo naquele mês (último dia se não existir), previsto = do modelo. Gera do mês de início até o mês do encerramento, inclusive. **Janela:** só grava para meses entre hoje − 12 e hoje + 12 meses; fora dela a leitura vem vazia e nada é gravado. Ocorrência já gerada não é corrigida pela geração.
- **Situação:** `paga` (há lançamento ligado); `atrasada` (vencimento < hoje); `pendente`. Ordem: atrasadas, pendentes por vencimento crescente, pagas por vencimento decrescente.
- **Pagar** (qualquer membro): cria um lançamento **conjunto** do pagador, 1 parcela **na data de vencimento da ocorrência** (I-20), com qualquer forma dele (Pix, Débito ou Crédito, sempre 1x). Valor padrão = previsto; data da operação padrão = hoje, aceita de 01/01/2000 até hoje + 30 dias. A data mostrada aos dois é sempre o vencimento.
- **Desfazer:** só o pagador; apaga o lançamento ligado e a ocorrência volta a pendente; já pendente → sucesso sem efeito. Excluir o lançamento de pagamento tem o mesmo efeito.
- **Encerrar** (qualquer membro): grava `encerrada_em` = hoje (chamar de novo não move a data); apaga as ocorrências **pendentes** dos meses em que deixa de gerar (a do mês do encerramento fica); pagas nunca são apagadas.

- CA-15.1: QUANDO o membro abre um mês dentro da janela, ENTÃO DEVE existir exatamente 1 ocorrência por fixa ativa, mesmo com duas consultas simultâneas.
- CA-15.2: QUANDO hoje é 24/10/2026 e o membro abre novembro/2027, ENTÃO o sistema NÃO DEVE gravar ocorrência e DEVE devolver a lista vazia; outubro/2027 e outubro/2025 DEVEM gerar.
- CA-15.3: QUANDO uma fixa de dia 31 gera fevereiro/2027, ENTÃO o vencimento DEVE ser 28/02/2027.
- CA-15.4: QUANDO uma fixa é encerrada em 15/10, ENTÃO outubro DEVE continuar gerando e novembro em diante NÃO; ocorrência pendente de novembro já gerada DEVE ser apagada; paga de novembro DEVE ficar.
- CA-15.5: SE a ocorrência já está paga, ENTÃO pagar de novo com outro id DEVE responder `ocorrencia_paga`; com o mesmo id do mesmo membro, DEVE devolver o gravado (RT-03).
- CA-15.6: SE a data do pagamento é anterior a 01/01/2000 ou posterior a hoje + 30, ENTÃO `valor_invalido`.
- CA-15.7: SE B tenta desfazer ou excluir o pagamento feito por A, ENTÃO `registro_invalido`.
- CA-15.8: QUANDO a ocorrência de vencimento 10/10 é paga no Crédito, ENTÃO a parcela DEVE ter data 10/10 e contar em outubro nos totais e no orçamento (RN-13 trata o cartão).
- CA-15.9: SE a categoria da fixa é individual, de receita ou inexistente, ENTÃO `registro_invalido`.

Origem: A salvar_despesa_fixa.sql:1-71; F garantir_ocorrencias.sql:1-30; F fixa_gera_no_mes.sql:1-11; F ocorrencias_do_mes.sql:1-49; A pagar_ocorrencia.sql:1-97; A desfazer_pagamento.sql:1-38; A encerrar_despesa_fixa.sql:1-36; A excluir_lancamento.sql:21-26; L-PRD RN-15, I-08, I-20. A correção da edição do pagamento está na RN-28.

### RN-16 — Totais do mês, resultado e orçamento

Todos os totais usam a competência (data da parcela no mês) e filtram tipo, escopo e dono de forma explícita, sem depender só da RLS.

**RN-16a — Total do casal.** Σ parcelas de **despesa conjunta** do mês (variáveis, parcelas de compra e fixas pagas). Também: total das categorias variáveis, total por categoria conjunta e `pago_por_membro` (valor e percentual por membro). Percentual = round(100 × valor ÷ total); o **último membro da ordem recebe 100 − soma dos anteriores**. Total 0 → `pago_por_membro` vazio. As fixas não pagas aparecem à parte como "previsto a pagar" (Σ previsto das não pagas, atrasadas incluídas) e não entram no total.

**RN-16b — Meu total.** Minha parte no conjunto (Σ conjuntas do mês **que eu paguei**) + meu individual (Σ despesas individuais minhas do mês). Variáveis = variáveis da minha parte + variáveis do meu individual. Por categoria: individual e "minha parte por categoria".

**RN-16c — Resultado individual.** Minhas receitas do mês − meu total. "Guardado no mês" = Σ aportes − Σ retiradas **feitos por mim** no mês, em todas as metas visíveis; é informativo, pode ser negativo e não reduz o resultado. O orçamento individual compara só categorias individuais (minha parte no conjunto não entra).

**RN-16d — Resultado conjunto.** Orçado conjunto total − total do casal (orçado ausente conta 0). Os dois resultados levam `parcial = true` enquanto o mês não está fechado (RT-04).

**RN-16e — Garantia de privacidade dos totais.** Meu total e resultado individual usam só dados do próprio membro e conjuntas em que ele é o pagador. `pago_por_membro` usa só dados conjuntos e pagadores já visíveis.

**Orçamento** (parte da RN-16; escrita só no Pro, RN-25):

| Item | Regra |
|---|---|
| Definir | por categoria de **despesa** e mês; escopo e dono vêm da categoria; valor > 0; valor ausente **remove** (idempotente); categoria arquivada aceita remoção mas não recebe valor (`registro_invalido`) |
| Realizado | Σ parcelas de despesa do escopo com data no mês (nunca o valor total do lançamento) |
| Total do escopo | orçado = Σ das linhas; realizado = Σ de **todas** as despesas do escopo no mês, **orçadas ou não**; total nulo se o escopo não tem orçamento |
| Situação | razão exata: realizado × 100 < orçado × 80 → `dentro`; realizado ≤ orçado → `atencao`; senão `estourado` |
| Percentual | round(100 × realizado ÷ orçado), só exibição |
| Ordem e destaques | linhas por percentual desc, nome; destaques do resumo = as 3 primeiras |
| Copiar do mês anterior | por escopo; não sobrescreve o que o mês já tem; pula categorias arquivadas; devolve quantas copiou (0 se nada) |
| Pode copiar | por escopo: o mês não tem orçamento e o anterior tem |
| Sem orçamento | categorias de despesa não arquivadas do escopo sem valor no mês, por nome |
| Resultado da tela de orçamento | orçado − realizado do total, com `parcial` |

| Orçado | Realizado | Percentual exibido | Situação |
|---|---|---|---|
| 10.000 | 7.999 | 80 | **dentro** (razão < 80%) |
| 10.000 | 8.000 | 80 | atencao |
| 10.000 | 10.000 | 100 | atencao |
| 10.000 | 10.001 | 100 | **estourado** (exibe 100) |
| 10.000 | 0 | 0 | dentro |

- CA-16.1: QUANDO A pagou 100 e B pagou 200 de conjuntas no mês, ENTÃO o total do casal DEVE ser 300 e `pago_por_membro` 33% e 67% (o último fecha 100).
- CA-16.2: QUANDO só A lançou conjuntas no mês, ENTÃO B DEVE aparecer com 0 e 0%, e A com 100%.
- CA-16.3: QUANDO o mês não tem despesa conjunta, ENTÃO `pago_por_membro` DEVE ser `[]` e o total 0.
- CA-16.4: QUANDO A tem receita 5.000, pagou 1.000 de conjuntas e gastou 500 de individual, ENTÃO meu total de A DEVE ser 1.500 e o resultado 3.500; nenhum desses números DEVE aparecer para B.
- CA-16.5: QUANDO uma compra de 3x tem a 2ª parcela em novembro, ENTÃO só essa parcela DEVE contar em novembro (total, orçamento, resultado).
- CA-16.6: QUANDO o orçamento conjunto tem só "Mercado" e há gasto em "Moradia", ENTÃO o realizado do total DEVE incluir "Moradia".
- CA-16.7: QUANDO o membro copia o orçamento e o mês já tem "Mercado" orçado, ENTÃO "Mercado" NÃO DEVE ser sobrescrito.
- CA-16.8: ENQUANTO o mês navegado é o corrente ou futuro, ENTÃO os resultados DEVEM ter `parcial = true`.
- CA-16.9: O resumo de um mês DEVE garantir as ocorrências desse mês antes de calcular as fixas pendentes.
- CA-16.10: Aporte em meta NÃO DEVE reduzir o resultado individual.

Origem: F totais_conjunto.sql:1-52; F totais_individuais.sql:1-45; F guardado_no_mes.sql:1-17; F orcado_realizado.sql:1-49; F situacao_orcamento.sql:1-18; F resumo_orcamento.sql:1-14; A resumo_mes.sql:1-116; A orcamento_mes.sql:1-82; A definir_orcamento.sql:1-53; A copiar_orcamento.sql:1-32; L-PRD RN-16a–e, I-05, I-10, I-15; ANALISE §2.3 (CA-15.3 defasada).

### RN-17 — Categorias

**Definição.** Categoria tem **tipo** (despesa/receita) e **escopo** (conjunta/individual). Receita é **sempre individual** (o escopo enviado é ignorado). Só despesa tem a marca `variavel` (nulo vira falso). Tipo e escopo não mudam depois de criada (`valor_invalido`). Nome não vazio, único por (lar, tipo, escopo, dono) — `nome_repetido`; conjunta e individual podem ter o mesmo nome. Conjunta: qualquer membro cria, renomeia, arquiva e exclui; individual: só o dono. Excluir com vínculo (lançamento, orçamento, fixa) → `categoria_em_uso`. Arquivar só muda o estado.

Categorias iniciais (código vence: Almoço é **conjunta**):

| Grupo | Categorias (V = variável) |
|---|---|
| Despesa conjunta (1 vez por lar) | Mercado (V), Delivery/iFood do casal (V), Moradia, Contas da casa, Outros da casa, Almoço/Alimentação fora (V) |
| Despesa individual (por membro) | Delivery pessoal (V), Transporte (V), Lazer pessoal (V), Outros |
| Receita individual (por membro) | Salário, Extra, Outros |

- CA-17.1: SE o membro cria uma categoria de receita conjunta, ENTÃO o sistema DEVE gravá-la como individual dele.
- CA-17.2: SE o membro cria "Mercado" despesa conjunta e já existe uma no lar, ENTÃO `nome_repetido`.
- CA-17.3: QUANDO A e B criam cada um "Academia" individual, ENTÃO as duas DEVEM coexistir.
- CA-17.4: As iniciais DEVEM ser criadas só se o lar não tem nenhuma conjunta (inclusive arquivada) e o membro nenhuma individual; renomear ou excluir uma inicial não a recria; a criação concorrente pelos dois membros não duplica.

Origem: A salvar_categoria.sql:1-71; A excluir_categoria.sql:1-22; A arquivar_categoria.sql:1-19; A inicializar_membro.sql:1-46; T categoria.sql:14-18; TS categorias/almoco_conjunto_dados.sql; L-PRD RN-17, I-06, I-07.

### RN-18 — Valores e textos

**Definição.** Valores sempre positivos, em centavos de BRL (RT-05). O tipo do lançamento (despesa/receita) define o sinal no cálculo. Textos livres passam por `trim`; vazio vira nulo onde o campo é opcional (descrição) e é recusado onde é obrigatório (nome, local, descrição da fixa).

| Campo | Regra |
|---|---|
| Valor de lançamento | 1 … 10^11 centavos |
| Valor previsto de fixa, alvo de meta, orçamento, movimento de meta, pagamento de cartão | > 0 |
| Saldo inicial e saldo real informado | qualquer inteiro (pode ser negativo) |
| Nome de conta | 1–80 caracteres |
| Local de meta | 1–60 caracteres |
| Nº de parcelas | 1–24 (só Crédito > 1) |
| Dia de vencimento | 1–31 |

- CA-18.1: SE o valor é vazio, 0, negativo ou maior que 10^11, ENTÃO `valor_invalido`.
- CA-18.2: QUANDO a descrição é "   ", ENTÃO DEVE ser gravada como nula.

Origem: T lancamento.sql:13-16; A lancar_despesa.sql:41-43; A salvar_conta.sql:25; T movimento_meta.sql:10; L-PRD RN-18. Decidido em 2026-10-24: o legado não limita o tamanho de descrição, nome de categoria, de forma e de meta; aqui o teto é **120 caracteres** para textos livres (Zod e `CHECK`), para evitar abuso com cadastro aberto. Corpo de requisição até 32 KB; saldo inicial de conta entre −10^11 e 10^11 centavos.

---

## 4. Regras novas (RN-19 a RN-28)

### RN-19 — Cadastro aberto, confirmação de e-mail e aceite de termos

**Definição.** Qualquer pessoa cria conta com nome, e-mail, senha e aceite dos Termos de Uso e da Política de Privacidade. O aceite grava a **versão** de cada documento e o instante. A conta só entra depois de confirmar o e-mail por link.

| Item | Regra |
|---|---|
| E-mail | normalizado (`trim` e minúsculas) e único entre usuários |
| Senha | mínimo de 12 caracteres (regra do legado); máximo de 72 bytes (limite do bcrypt); fora disso → `senha_fraca` |
| Hash da senha | bcrypt no Postgres (`crypt`/`gen_salt('bf')`) |
| Token de confirmação | 256 bits aleatórios; só o hash SHA-256 é guardado; válido por 30 min; uso único; reenviar invalida o anterior |
| Aceite | obrigatório; sem aceite → `valor_invalido`; registra versão dos termos e da privacidade e o instante |
| E-mail já cadastrado | mesma resposta e mesmo tempo de um cadastro novo; o dono do e-mail recebe um aviso "você já tem conta" (anti-enumeração) |

- CA-19.1: QUANDO uma pessoa se cadastra com dados válidos, ENTÃO o sistema DEVE criar o usuário não confirmado, gravar o aceite com as versões e enviar o e-mail de confirmação.
- CA-19.2: QUANDO o link é aberto dentro de 30 min pela primeira vez, ENTÃO a conta DEVE ficar confirmada; aberto de novo, expirado ou com token desconhecido → `link_expirado`.
- CA-19.3: SE o cadastro usa um e-mail já existente, ENTÃO a resposta DEVE ser idêntica (corpo, status e tempo dentro da tolerância do teste) à de um e-mail novo, e nenhuma conta nova é criada.
- CA-19.4: SE a senha tem 11 caracteres, ENTÃO `senha_fraca`.
- CA-19.5: SE a pessoa entra com a senha correta numa conta não confirmada, ENTÃO `email_nao_confirmado` (com senha errada, `credenciais_invalidas`).
- CA-19.6: QUANDO o usuário pede recuperação de senha, ENTÃO o sistema DEVE responder igual para e-mail existente ou não; o token segue as regras do token de confirmação; trocar a senha DEVE revogar todas as sessões do usuário (RN-20).

Casos limite: e-mail com maiúsculas (normalizado); dois cadastros simultâneos com o mesmo e-mail (um só usuário); conta não confirmada nunca. Decidido em 2026-10-24: quando a versão dos termos muda, o reaceite é obrigatório no próximo acesso (CA-19.7); conta não confirmada é apagada após 7 dias pela rotina de purga (CA-19.8).
- CA-19.7: QUANDO a versão dos termos muda e o usuário acessa, ENTÃO o sistema DEVE exigir novo aceite antes de liberar o app, e registrar a versão aceita.
- CA-19.8: QUANDO uma conta não confirmada completa 7 dias, ENTÃO a purga DEVE apagá-la, liberando o e-mail.
Origem: nova — padrão LJS (cadastro aberto, ANALISE §4) e PLANO etapa 4; política de senha de L-SDD:482.

### RN-20 — Sessão

**Definição.** Sessão opaca: token de 256 bits no cookie `__Host-sid` (`HttpOnly`, `Secure`, `Path=/`, sem `Domain`); no banco só o hash SHA-256 (tabela `sessao`). Expira por **15 min sem requisição autenticada** ou **12 h desde o login**, o que vier primeiro (P5). Cada requisição autenticada renova a inatividade, nunca a absoluta.

- CA-20.1: QUANDO o login dá certo, ENTÃO o sistema DEVE criar uma sessão nova (token novo), e qualquer token anterior apresentado naquele navegador DEVE ser invalidado (rotação no login).
- CA-20.2: QUANDO passam 15 min e 1 s sem requisição, ENTÃO a próxima requisição DEVE receber `sessao_expirada`.
- CA-20.3: QUANDO o usuário faz requisições a cada 5 min, ENTÃO a sessão DEVE expirar 12 h após o login.
- CA-20.4: QUANDO o usuário sai, ENTÃO a sessão daquele aparelho DEVE ser revogada e o cookie apagado.
- CA-20.5: QUANDO o usuário escolhe "sair de todos", ENTÃO todas as sessões dele DEVEM ser revogadas, inclusive a atual; repetir a operação DEVE ser sucesso sem efeito (o erro 400 do legado deixa de existir).
- CA-20.6: Cookie ausente, token desconhecido, sessão revogada e sessão expirada DEVEM produzir a mesma resposta `sessao_expirada`.
- CA-20.7: QUANDO a sessão expira com lançamentos na fila offline, ENTÃO a fila DEVE ser enviada depois do próximo login **somente se** o usuário logado for o dono da fila; se for outro usuário, a fila NÃO DEVE ser enviada.
- CA-20.8: O token nunca aparece em log, URL ou resposta JSON.
- CA-20.9: QUANDO o usuário toca em "Sair" com lançamentos na fila offline, ENTÃO o app DEVE mostrar quantos estão pendentes e perguntar: enviar agora, manter para o próximo login (só o mesmo usuário envia) ou descartar; a escolha DEVE ser cumprida antes de limpar o aparelho (G-39). Sessão expirada (não é "sair") mantém a fila (CA-20.7).

Origem: nova — decisão P5; padrão LJS (ANALISE §4, R4); ANALISE §2.3 (bug do "sair de todos").

### RN-21 — Bloqueio de tentativas e anti-enumeração

**Definição.** Login com falha conta uma tentativa para o **e-mail** (normalizado, exista ou não) e para o **IP**. Com **5 falhas em 15 min** (janela deslizante) para o e-mail **ou** para o IP, novas tentativas recebem `muitas_tentativas` sem checar a senha, até a janela liberar. Login bem-sucedido zera as falhas daquele e-mail. E-mail inexistente e senha errada recebem a mesma resposta (`credenciais_invalidas`) em tempo equivalente (compara com um hash fixo quando o e-mail não existe).

- CA-21.1: QUANDO há 5 falhas para um e-mail em 15 min, ENTÃO a 6ª tentativa, mesmo com a senha certa, DEVE receber `muitas_tentativas`.
- CA-21.2: QUANDO 5 e-mails diferentes falham a partir do mesmo IP em 15 min, ENTÃO a 6ª tentativa desse IP DEVE receber `muitas_tentativas`.
- CA-21.3: QUANDO a 1ª falha sai da janela de 15 min, ENTÃO uma nova tentativa DEVE voltar a ser avaliada.
- CA-21.4: O bloqueio DEVE valer igual para e-mail existente e inexistente (o bloqueio não revela existência).
- CA-21.5: Cadastro, recuperação e reenvio de confirmação DEVEM ter limite de taxa por IP (`muitas_tentativas`) e resposta igual para e-mail existente ou não.

Casos limite: IP compartilhado (NAT) bloqueando um casal — aceito pela regra; contador por e-mail com variação de caixa (normalizado).
Origem: nova — padrão LJS (ANALISE §4, "trava de login") e PLANO etapa 4.

### RN-22 — Lar no primeiro acesso

**Definição.** No primeiro acesso autenticado de um usuário confirmado que não é membro de nenhum lar, o sistema cria um **lar**, o usuário vira **titular** (posição 1), as categorias iniciais são criadas (RN-17) e o plano começa em **trial Pro de 14 dias** (RN-24).

- CA-22.1: QUANDO um usuário confirmado entra pela primeira vez sem convite, ENTÃO DEVE existir 1 lar com ele como titular, 6 categorias conjuntas, 4 individuais de despesa, 3 de receita e uma assinatura em `trial`.
- CA-22.2: QUANDO o primeiro acesso acontece por um link de convite válido (RN-23), ENTÃO o sistema NÃO DEVE criar lar próprio e DEVE seguir para o aceite do convite.
- CA-22.3: QUANDO duas requisições do primeiro acesso chegam juntas, ENTÃO DEVE ser criado um único lar.
- CA-22.4: O nome do membro é o nome do cadastro.

Origem: nova — decisão P1; A inicializar_membro.sql:19-46 (categorias).

### RN-23 — Convite de membro

**Definição.** O titular convida 1 pessoa por e-mail. Regras:

| Item | Regra |
|---|---|
| Quem convida | só o titular |
| Limite | o lar tem no máximo 2 membros; com 2 membros, convidar → `lar_cheio` |
| Pendentes | no máximo 1 convite pendente por lar; um convite novo revoga o anterior |
| Token | 256 bits aleatórios no link; só o hash SHA-256 é guardado (tabela `convite`) |
| Validade | 7 dias |
| Limites | até 5 convites por lar por dia; 1 reenvio a cada 2 min por endereço |
| Uso | único; aceitar ou recusar encerra o convite |
| Aceite | exige sessão de usuário confirmado cujo e-mail é igual ao convidado (comparação normalizada); quem não tem conta se cadastra antes (RN-19) e volta ao link |
| Erro | inexistente, expirado, usado, revogado ou de outro e-mail → `convite_invalido` (mesma resposta) |
| Revogar | o titular revoga um convite pendente |
| E-mail do convite | não revela dado financeiro; só o nome do titular e o link |

- CA-23.1: QUANDO o titular convida um e-mail, ENTÃO o sistema DEVE gravar o hash do token e enviar o e-mail com o link.
- CA-23.2: SE um não titular tenta convidar, ENTÃO `registro_invalido`.
- CA-23.3: QUANDO o convidado aceita com a sessão do e-mail certo, ENTÃO ele DEVE virar membro (posição 2), ganhar as categorias individuais iniciais, passar a ver os dados conjuntos e o plano do lar, e o convite DEVE ficar usado.
- CA-23.4: SE o mesmo link é usado de novo, ENTÃO `convite_invalido`.
- CA-23.5: SE o link é aberto com sessão de outro e-mail, ENTÃO `convite_invalido`, sem revelar o e-mail convidado.
- CA-23.6: SE dois convites são aceitos ao mesmo tempo num lar com 1 membro, ENTÃO só um DEVE entrar; o outro recebe `lar_cheio`.
- CA-23.7: SE o titular convida o próprio e-mail, ENTÃO `valor_invalido`.
- CA-23.8: Convite está disponível no Free (P2).

- CA-23.9: QUANDO o convidado já tem lar próprio só com as categorias iniciais (nenhum lançamento, conta, forma, fixa, orçamento, meta ou categoria criada ou alterada por ele), ENTÃO o aceite DEVE descartar esse lar automaticamente e seguir normalmente.
- CA-23.10: SE o convidado tem lar próprio com qualquer dado, ENTÃO o aceite DEVE ser recusado com `ja_tem_lar`, sem alterar nada, até ele excluir o próprio lar (ação explícita com confirmação).
- CA-23.11: SE o titular de um lar com membro tenta aceitar convite de outro lar, ENTÃO `ja_tem_lar`.
- CA-23.12: QUANDO o membro sai ou o titular o remove, ENTÃO o individual dele DEVE ser purgado em 30 dias; as despesas conjuntas que ele pagou DEVEM ficar no lar com o pagador exibido como "Ex-membro" e a parte privada (`lancamento_pagamento`: forma, conta, data_operacao) DEVE ser apagada; os movimentos de meta conjunta feitos por ele DEVEM ficar com autor "Ex-membro", sem a conta. *Desvio aceito em 2026-10-25 (etapa 8):* na saída voluntária a parte privada é apagada na hora; na **remoção pelo titular** ela fica até a purga de 30 dias pela role owner (etapa 14), porque a RLS só do dono (G-10) não deixa o titular apagá-la. Até lá ela é inacessível à API (o id do membro removido nunca mais é o `app.membro_id` de ninguém). **Pendência da etapa 14:** a purga apaga `lancamento_pagamento` dos membros removidos.
- CA-23.13: QUANDO o membro sai ou é removido, ENTÃO no próximo acesso ele DEVE cair no primeiro acesso (RN-22) e ganhar um lar novo vazio como titular.
- CA-23.14: SE um não titular tenta remover membro, ENTÃO `registro_invalido`; o titular remove o membro com o mesmo efeito do CA-23.12.
- CA-23.15: QUANDO o convite é aceito por quem tem o lar descartável, ENTÃO nenhuma despesa, saldo ou dado do lar descartado DEVE aparecer no lar novo.

Origem: nova — decisões P1, P2; PLANO etapa 6; decisões de 2026-10-24 (D2, D3, D8).

### RN-24 — Plano do lar

**Definição.** O plano é do **lar** e herdado do titular; o convidado usa o Pro sem pagar. **Free** é gratuito; **Pro** custa **R$ 9,90/mês (990 centavos)**, cobrado por Pix via Asaas. Todo lar novo começa com **14 dias de trial Pro sem cartão**.

Estados da assinatura (tabela `assinatura`, 1 por lar):

| Estado | Pro liberado? | Entra quando | Sai para |
|---|---|---|---|
| `trial` | sim | lar criado (RN-22); fim = criação + 14 dias | `ativa` (pagamento confirmado); `free` (fim do trial sem pagamento) |
| `ativa` | sim | pagamento confirmado | `atrasada` (cobrança vencida sem pagamento); `cancelada` (titular cancela) |
| `atrasada` | sim, por **3 dias de carência** após o vencimento; depois, não | cobrança vencida sem pagamento | `ativa` (pagamento confirmado); `cancelada` (fim da carência) |
| `cancelada` | sim, até o fim do período pago (`periodo_fim`); depois, não | titular cancela ou fim da carência | `free` (fim do período pago); `ativa` (assina de novo) |
| `free` | não | fim do trial sem pagamento ou fim do cancelamento | `ativa` (assina) |

Regras:
- Webhook do Asaas: autenticado por token, fora da sessão, **idempotente por id do evento** (tabela `webhook_evento`); evento repetido é ignorado; evento fora de ordem não faz o estado regredir (ex.: "cobrança criada" depois de "pagamento recebido" da mesma cobrança).
- Só o titular assina, vê cobranças, copia o Pix e cancela. O convidado vê só o plano e a validade (§2).
- Mudança de estado vale para os dois membros na próxima requisição.
- E-mails: cobrança gerada, pagamento confirmado, atraso.

- CA-24.1: QUANDO o lar é criado, ENTÃO a assinatura DEVE estar em `trial` com fim em criação + 14 dias, e orçamento e metas liberados.
- CA-24.2: QUANDO o trial termina sem pagamento confirmado, ENTÃO o estado DEVE ser `free` e a RN-25 passa a valer.
- CA-24.3: QUANDO chega o webhook de pagamento confirmado, ENTÃO o estado DEVE ir para `ativa`; o mesmo evento reenviado NÃO DEVE gerar efeito novo.
- CA-24.4: QUANDO chegam "pagamento recebido" e depois "cobrança criada" da mesma cobrança, ENTÃO o estado DEVE continuar `ativa`.
- CA-24.5: SE o webhook vem sem o token correto, ENTÃO o sistema DEVE recusar sem alterar nada e sem revelar detalhe.
- CA-24.6: SE o convidado tenta assinar ou cancelar, ENTÃO `registro_invalido`.
- CA-24.7: O valor cobrado DEVE ser 990 centavos; a cobrança é sempre Pix.

Decidido em 2026-10-24 (D4): ao perder o Pro o lar cai para Free (RN-25: orçamento e metas somente leitura, nada apagado). Cancelamento mantém o Pro até `periodo_fim`; atraso tem 3 dias de carência após o vencimento; trial expirado sem assinatura cai para Free no fim dos 14 dias. **Sem novo trial** para quem já foi titular com trial (vale também para lar novo depois de sair, ser removido ou excluir a conta). A exclusão de conta do titular cancela a assinatura no Asaas na confirmação (RN-26).
- CA-24.8: QUANDO o titular cancela, ENTÃO o plano efetivo DEVE continuar Pro até `periodo_fim` e só então virar Free.
- CA-24.9: QUANDO a cobrança vence sem pagamento, ENTÃO o plano efetivo DEVE continuar Pro por 3 dias e depois virar Free; o pagamento dentro ou depois da carência volta a `ativa`.
- CA-24.10: SE um usuário que já foi titular com trial passa a ser titular de um lar novo, ENTÃO o lar DEVE nascer em `free`, sem trial.
- CA-24.11: QUANDO o titular assina, ENTÃO o sistema DEVE pedir CPF/CNPJ no momento de assinar e repassá-lo ao Asaas, sem guardá-lo no banco (só `asaas_customer_id`) e sem registrá-lo em log.

Origem: nova — decisão P2; PLANO etapa 13.

### RN-25 — Free: orçamento e metas somente leitura

**Definição.** Enquanto o lar não tem Pro liberado, orçamento e metas ficam **somente leitura**: o que existe continua visível (telas e resumo), **nada é apagado**, e toda escrita é recusada **na API** com `plano_necessario`. Lançamentos, fixas, resumo, contas, formas, categorias e convite continuam livres.

| Operação | Free |
|---|---|
| Consultar orçamento do mês, metas, movimentos, locais | permitido |
| Definir/remover orçamento, copiar do mês anterior | `plano_necessario` |
| Criar/editar meta, aporte, retirada | `plano_necessario` |
| Blocos de orçamento e metas no resumo | mostrados com os dados existentes |
| Lançar, editar ou excluir lançamento (mesmo mudando o realizado do orçamento) | permitido |
| Arquivar ou excluir categoria com orçamento | regras da RN-17 (`categoria_em_uso` se houver vínculo) |

- CA-25.1: QUANDO um lar Free consulta o orçamento de um mês que tinha valores, ENTÃO os valores e o realizado atual DEVEM aparecer.
- CA-25.2: SE um membro de lar Free tenta definir orçamento, copiar, salvar meta ou movimentar meta, ENTÃO `plano_necessario`, sem gravar.
- CA-25.3: A recusa DEVE acontecer na API mesmo que o cliente mostre o botão (teste chamando a API direto).
- CA-25.4: QUANDO o lar volta ao Pro, ENTÃO todos os orçamentos e metas anteriores DEVEM estar intactos e editáveis.
- CA-25.5: `atingida_em` não muda no Free por movimento (não há movimento); a edição de alvo também está bloqueada.

Origem: nova — decisão P2.

### RN-26 — Exclusão de conta

**Definição.** O usuário pede a exclusão da própria conta; o sistema envia um e-mail de confirmação (token de 256 bits com hash, uso único, validade de 30 min como a confirmação de cadastro). Confirmada a exclusão, todas as sessões são revogadas e os dados pessoais são **purgados em 30 dias** por rotina agendada.

- CA-26.1: QUANDO o usuário pede a exclusão, ENTÃO nada é excluído até a confirmação pelo link.
- CA-26.2: QUANDO o link é confirmado, ENTÃO todas as sessões DEVEM ser revogadas e a purga agendada para confirmação + 30 dias.
- CA-26.3: QUANDO a purga roda para um titular sem convidado, ENTÃO o lar e todos os seus dados (tabelas de negócio, `push_subscription`, `convite`, `sessao`) DEVEM ser apagados, e a assinatura no Asaas cancelada.
- CA-26.4: Depois da purga, o e-mail fica livre para um cadastro novo.
- CA-26.5: Backups cifrados guardam os dados por até 30 dias após a purga (retenção do backup); a Política de Privacidade DEVE informar isso.

Decisões de 2026-10-24:
- **Conta em exclusão não é reativada:** o login fica bloqueado com `conta_em_exclusao`; o mesmo e-mail só pode se cadastrar após a purga (D8).
- **Titular com membro ativo (D1): o lar é encerrado com aviso.** Ao confirmar, o membro recebe e-mail e aviso no app; o prazo é a própria janela de 30 dias até a purga. Na purga, o lar e todo o conjunto são apagados e o membro perde o conjunto **e o individual dele também** (o lar inteiro some). O aviso DEVE dizer isso com clareza. No próximo acesso o membro cai no primeiro acesso (RN-22) e ganha um lar novo vazio como titular. A assinatura do Asaas é cancelada na confirmação.
- **Convidado (membro) que exclui a conta:** segue a regra de saída de membro (RN-23, CA-23.12): individual purgado em 30 dias; conjuntas que pagou ficam como "Ex-membro".
- **Purga:** `backend/scripts/purgar.ts`, agendado no GitHub Actions com a role owner (exceção registrada ao "owner só nas migrations"; ADR a criar na etapa 14). A role `app` continua sem DELETE onde não é regra; não há role `purga`. Também apaga contas não confirmadas após 7 dias e, após 30 dias, tentativas de login, tokens e sessões expiradas; `webhook_evento` fica 12 meses sem dados do pagador.

- CA-26.6: SE a conta está em exclusão confirmada, ENTÃO o login DEVE ser recusado com `conta_em_exclusao`, sem reativar a conta.
- CA-26.7: QUANDO o titular com membro ativo confirma a exclusão, ENTÃO o membro DEVE receber e-mail e aviso no app informando que o lar, o conjunto e o individual dele serão apagados na data da purga, e a assinatura no Asaas DEVE ser cancelada na confirmação.
- CA-26.8: QUANDO a purga roda para esse titular, ENTÃO o lar inteiro, o conjunto e os individuais de ambos DEVEM ser apagados; no próximo acesso o ex-membro DEVE cair no primeiro acesso e ganhar um lar novo vazio como titular.
- CA-26.9: SE o link de exclusão tem mais de 30 min, ENTÃO `link_expirado`.
- CA-26.10: A purga DEVE rodar por `purgar.ts` com a role owner; teste de que ela só apaga usuários marcados há 30 dias e contas não confirmadas há 7 dias.

Origem: nova — padrão LJS (LGPD) e PLANO etapa 14; decisões de 2026-10-24 (D1, D5, D8).

### RN-27 — Notificações push

**Definição.** Web Push nativo (VAPID). O usuário autoriza por aparelho (tabela `push_subscription`) e escolhe em Ajustes três preferências:

| Notificação | Quem recebe | Quando | Padrão |
|---|---|---|---|
| Fixa vencendo | os dois membros | ocorrência pendente: 1 dia antes, às 09:00 de São Paulo (padrão proposto, ajustável) | ligada |
| Fixa atrasada | os dois membros | ocorrência que passou a `atrasada`: no dia do atraso, 1 vez (padrão proposto, ajustável) | ligada |
| Lembrete diário de lançar | o próprio usuário | uma vez por dia, só se ele não lançou nada no dia, às 20:00 de São Paulo por padrão, horário configurável por usuário (padrão proposto, ajustável) | **desligada** (opcional, P8) |
| Meta atingida | compartilhada: os dois; individual: só o dono | na transição de não atingida para atingida (RN-08), na hora do aporte | ligada |

Regras:
- Gerada por rotina agendada (Cron) em lotes; nunca bloqueia uma requisição do usuário.
- A notificação nunca leva dado individual do outro membro (RN-02).
- O texto é genérico, sem valor nem nome (aparece na tela bloqueada). Decidido em 2026-10-24.
- Inscrição recusada pelo serviço de push como expirada/inexistente é removida.
- No iOS, push só funciona com o PWA instalado; a tela de permissão avisa.

- CA-27.1: QUANDO uma ocorrência é paga antes do horário do aviso, ENTÃO o aviso de vencimento NÃO DEVE ser enviado.
- CA-27.2: QUANDO o lembrete diário está ligado e o usuário já lançou no dia, ENTÃO o lembrete NÃO DEVE ser enviado.
- CA-27.3: QUANDO uma meta individual de A é atingida, ENTÃO só os aparelhos de A DEVEM ser notificados.
- CA-27.4: Cada notificação DEVE ser enviada no máximo uma vez por (usuário, evento, dia), mesmo que a rotina rode duas vezes.
- CA-27.5: QUANDO o usuário desliga uma preferência, ENTÃO aquele tipo NÃO DEVE mais ser enviado a nenhum aparelho dele.
- CA-27.6: QUANDO o usuário sai de todos os aparelhos ou exclui a conta, ENTÃO o sistema DEVE remover as inscrições de push dele (na exclusão, sempre; na saída de todos os aparelhos, também).
- CA-27.7: QUANDO uma notificação push é montada, ENTÃO o texto DEVE ser genérico, sem valor, descrição nem nome.
- CA-27.8: QUANDO o usuário muda o horário do lembrete diário, ENTÃO o lembrete DEVE ser enviado só nesse horário; com o lembrete desligado (padrão), nada é enviado.

Origem: nova — decisão P8; PLANO etapa 15.

### RN-28 — Correção do pagamento de fixa

**Definição.** No legado, quando o pagador edita o valor do lançamento de pagamento de uma fixa, as parcelas são recalculadas pela regra comum: a parcela sai da data de vencimento (no Crédito vai para o vencimento do cartão do mês seguinte; no Pix, para a data da operação), quebrando a I-20; e o pagador consegue passar o lançamento para uma categoria individual. **Corrigido (P7):** o lançamento de pagamento de fixa sempre tem **1 parcela, na data de vencimento da ocorrência, em categoria conjunta**.

| Mudança pelo pagador | Resultado |
|---|---|
| valor | aceita; a parcela única fica no vencimento com o novo valor |
| descrição | aceita |
| data da operação | aceita (afeta saldo do Pix/Débito e a data de cartão, RN-13); a parcela fica no vencimento; mesma faixa do pagamento (01/01/2000 … hoje + 30) |
| forma | aceita (Pix, Débito ou Crédito); a parcela fica no vencimento; `dia_vencimento_aplicado` da forma nova |
| categoria conjunta de despesa | aceita |
| categoria individual | `sem_permissao` |
| nº de parcelas ≠ 1 | `valor_invalido` |
| data da parcela (ajuste manual) | `registro_invalido` (a parcela de fixa não tem ajuste) |
| outro membro, qualquer campo | `sem_permissao` (como no legado) |

- CA-28.1: QUANDO o pagador edita o valor do pagamento de uma ocorrência de vencimento 10/10 pago no Crédito, ENTÃO a parcela única DEVE ficar em 10/10 com o novo valor, e o cartão DEVE refletir o novo valor na data de cartão (RN-13).
- CA-28.2: QUANDO o pagador edita o valor de um pagamento feito no Pix em 12/10, ENTÃO a parcela DEVE continuar em 10/10.
- CA-28.3: SE o pagador tenta mudar a categoria do pagamento para uma individual dele, ENTÃO `sem_permissao`, sem gravar.
- CA-28.4: SE o pagador tenta mudar o nº de parcelas para 2, ENTÃO `valor_invalido`.
- CA-28.5: SE o pagador tenta alterar a data da parcela de um pagamento de fixa no Crédito, ENTÃO `registro_invalido`.
- CA-28.6: QUANDO o pagador troca a forma de Pix para Crédito, ENTÃO o saldo da conta antiga DEVE deixar de ser debitado, a parcela continuar no vencimento e o cartão passar a mostrar o valor.
- CA-28.7: Regressão: B continua sem poder editar (`sem_permissao`) nem excluir ou desfazer (`registro_invalido`) o pagamento de A (TS lancamentos/lancamento_de_fixa.sql:29-38).

Decidido em 2026-10-24 (D9): o ajuste manual da data da parcela de pagamento de fixa é recusado (`registro_invalido`), como proposto.
Observação: CA-28.5 estende a P7 a um segundo caminho que o legado também deixava aberto (A alterar_data_parcela.sql:22-32 aceita a parcela do pagamento de fixa no Crédito, sem teste).
Origem: nova — decisão P7; ANALISE §2.3; A editar_lancamento.sql:147-194; F permissoes_edicao.sql:38-40; TS lancamentos/lancamento_de_fixa.sql:55-57.

---

## 5. Requisitos não funcionais

| # | Categoria | Requisito | Como verificar |
|---|---|---|---|
| RNF-01 | Fricção de lançamento | Com categoria entre as mais usadas e forma padrão: valor + no máximo 3 toques; mediana ≤ 10 s do app aberto à confirmação (M3). Medir também o caminho com login (P5) | Roteiro com 10 lançamentos cronometrados em Android e iPhone |
| RNF-02 | Offline | **Só o lançamento de despesa** funciona offline: a fila guarda no IndexedDB e envia quando houver rede e sessão do mesmo usuário (CA-20.7), com idempotência (RT-03). Nenhum lançamento confirmado se perde em silêncio. No "Sair" explícito, o app mostra quantos lançamentos estão pendentes e pergunta: enviar agora, manter para o próximo login (só o mesmo usuário envia) ou descartar; sessão expirada (não é "sair") mantém a fila. As demais telas mostram aviso de sem conexão | Teste e2e em modo avião; teste de fila com troca de usuário |
| RNF-03 | Desempenho | Início (resumo do mês) pronto em **≤ 2 s** em 4G num celular de gama média, com 2 anos de dados (~6.000 parcelas). Do ícone ao lançamento pronto ≤ 3 s | Medição com a massa sintética de 2 anos; Lighthouse em perfil móvel |
| RNF-04 | CPU do Worker | **< 10 ms de CPU por requisição** (limite do Workers Free). Agregações (totais, orçamento, saldos, cartão) em SQL; regras puras pequenas em `dominio` (risco R1) | Medição no `wrangler dev` com a massa de 2 anos, por rota; falha a etapa se passar |
| RNF-05 | Retomada a frio | O 1º acesso após suspensão do Neon é medido e registrado; `/api/health` não toca o banco (R5) | Medição no ambiente publicado |
| RNF-06 | Segurança | Só HTTPS; HSTS; CSP restritiva nos cabeçalhos do Worker; `Cache-Control: no-store` na API; cookie `__Host-` (RN-20); anti-CSRF por cabeçalho próprio em toda escrita (`origem_invalida`); segredos fora do repositório (gitleaks no CI); role `app` sem BYPASSRLS e sem DDL; GUC só com `set_config(..., true)` dentro da transação (R2) | Testes de cabeçalho; teste de 2 requisições concorrentes sem vazamento de GUC; `THREAT-MODEL.md` |
| RNF-07 | Privacidade e isolamento | RT-01 e §2 valem por qualquer caminho: tela, API direta, erro, contagem, total, notificação, e-mail, log | Teste negativo por tabela e por rota (lar × lar e membro × membro) |
| RNF-08 | Logs e observabilidade | Sentry no front e no Worker com scrubbing: nenhum e-mail, nome, valor, descrição, token ou cookie em log ou evento. `release` = SHA do commit | Teste de scrubbing; revisão de um evento real |
| RNF-09 | Disponibilidade e dados | Backup diário (04:00 BRT) com `pg_dump` por role somente leitura, cifrado, retido 30 dias; branch de restauração antes de cada migração; ensaio de restauração registrado no runbook; monitor externo (UptimeRobot) | `backup.yml`, `deploy.yml`, runbook |
| RNF-10 | PWA | Instalável no Chrome do Android e no Safari do iOS, abre em tela cheia com nome "Controle em Casa"; app em `/app` com `navigateFallback` próprio; **Lighthouse PWA/boas práticas ≥ 90** | Lighthouse no CI ou na etapa 16; instalação nos 2 aparelhos |
| RNF-11 | Acessibilidade | **axe sem violações** em todas as telas e estados testados (como no legado); alvos de toque ≥ 44×44 px; contraste WCAG 2.1 AA; todo campo com rótulo; navegação por teclado nas telas novas | axe no Vitest e no Playwright |
| RNF-12 | Fidelidade visual | As telas do legado mantêm 100% do layout (comparação visual contra o mockup do legado); telas novas só com `tokens.css` e componentes base (P9) | Playwright com comparação visual; `checar-tokens.py` |
| RNF-13 | Localização e precisão | pt-BR; `R$ 1.234,56`; datas dd/mm/aaaa; fuso America/Sao_Paulo (RT-04); centavos inteiros (RT-05) | Testes de parcelas, arredondamento e virada de mês e ano |
| RNF-14 | LGPD | Base legal e finalidade descritas em `/privacidade`; aceite versionado (RN-19); minimização (só nome, e-mail e dados financeiros digitados pelo usuário); exclusão pelo próprio usuário (RN-26); retenção de backup informada; operadores listados (Cloudflare, Neon, Resend, Asaas, Sentry); dados no Brasil quando o fornecedor permitir (Neon `sa-east-1`). Direitos de acesso e portabilidade (art. 18): fora do escopo do MVP; atendidos por e-mail ao controlador, registrado na Política de Privacidade (decidido em 2026-10-24). A exportação CSV está fora do escopo. | Revisão dos textos; teste da exclusão |
| RNF-15 | E-mail | Remetente "Controle em Casa" (`MAIL_FROM`, P4); envio por Resend via `fetch`; falha de envio não expõe erro ao usuário além de "tente de novo"; e-mails sem dado financeiro | Teste com o serviço simulado |
| RNF-16 | Custo | Planos gratuitos (Cloudflare Workers Free, Neon Free, Resend, Sentry free); custo variável só as tarifas do Asaas por cobrança; qualquer item pago exige aprovação | `SDD.md` |
| RNF-17 | Manutenibilidade | Uma pessoa mantém sozinha; regras puras testadas em `dominio`; contrato Zod único para API e front; migrações só aditivas | Revisão; checagens do CI |

---

## 6. Pontos a esclarecer (todos **resolvidos** em 2026-10-24)

**Resolvido:** 1 = opção (c) com aviso (RN-26, CA-26.7 e CA-26.8); 2 = individual purgado em 30 dias, conjuntas ficam com "Ex-membro", titular pode remover (RN-23, CA-23.12 a CA-23.14); 3 = lar só com categorias iniciais é descartado no aceite, com dados o aceite é recusado com `ja_tem_lar` (CA-23.9 a CA-23.11); 4 e 5 = Pro até o fim do período pago, 3 dias de carência no atraso (RN-24, CA-24.8 e CA-24.9); 6 = sem novo trial (CA-24.10); 7 = convite 7 dias, link de exclusão 30 min; 8 = reaceite obrigatório e purga em 7 dias (CA-19.7, CA-19.8); 9 = login bloqueado com `conta_em_exclusao` (CA-26.6); 10 = padrões propostos, ajustáveis, texto genérico (RN-27); 11 = 120 caracteres (RN-18); 12 = por e-mail, fora do MVP (RNF-14); 13 = sim, só plano e validade (§2). A tabela abaixo guarda as opções originais, como histórico.

| # | Ponto | Regras afetadas | Opções a apresentar |
|---|---|---|---|
| 1 | **Exclusão de conta do titular com membro ativo** | RN-24, RN-26, RN-11 | (a) titularidade passa ao convidado, que herda o plano (Free ao fim do período pago); (b) a exclusão é recusada até o titular remover o membro ou transferir; (c) o lar inteiro é encerrado e o convidado recebe um lar novo vazio |
| 2 | **Saída ou remoção de membro**: o que acontece com o individual dele e com as conjuntas que pagou | RN-02, RN-16a, RN-23, RN-26 | Individual: (a) sai com ele para um lar novo; (b) é apagado. Conjuntas que pagou: (a) ficam no lar com o nome do ex-membro, sem a parte privada; (b) são apagadas (mudaria totais passados) |
| 3 | **Convidado que já tem lar próprio com dados** | RN-11, RN-22, RN-23 | (a) recusar até ele excluir ou esvaziar o lar; (b) aceitar e apagar o lar dele, com confirmação explícita; (c) aceitar e levar o individual dele (contas, formas, categorias e lançamentos individuais), descartando o conjunto. Lar recém-criado só com as categorias iniciais pode ser descartado automaticamente? |
| 4 | **Lar sem titular pago: perde orçamento e metas conjuntas na hora ou no fim do período?** (cancelamento, atraso, exclusão do titular) | RN-24, RN-25 | (a) na hora; (b) no fim do período já pago; (c) no fim do período, mais uma carência fixa |
| 5 | Carência do estado `atrasada` | RN-24 | 0, 3 ou 7 dias com Pro |
| 6 | Novo trial para quem já foi titular | RN-24 | não (proposta); sim |
| 7 | Validade do convite e do link de exclusão | RN-23, RN-26 | convite 7 dias; exclusão 30 min |
| 8 | Reaceite quando os termos mudam; purga de contas não confirmadas | RN-19 | reaceite obrigatório no próximo acesso; purga após 7 dias |
| 9 | Cancelar a exclusão de conta dentro dos 30 dias | RN-26 | permitir pelo login; bloquear o login |
| 10 | Push: antecedência, horários, repetição do atraso, valores no texto, inscrições ao "sair de todos" | RN-27 | propostas no texto da RN-27 |
| 11 | Teto de tamanho dos textos livres | RN-18 | 120 caracteres para descrição e nomes |
| 12 | Atendimento dos direitos do titular de dados (acesso e portabilidade) | RNF-14 | e-mail manual; exportação no app (nova funcionalidade) |
| 13 | O convidado vê só plano e validade (sem dados de cobrança)? | §2, RN-24 | sim (proposta); vê também o histórico |

---

## 7. Rastreabilidade com o legado

| Legado | Aqui | Mudança |
|---|---|---|
| RF-01 (login restrito, sem cadastro) | RN-19, RN-20, RN-21 | cadastro aberto; sessão de 15 min/12 h em vez de "logado até sair" (P5) |
| RN-01…RN-10, RN-12…RN-18 | RN-01…RN-10, RN-12…RN-18 | texto alinhado ao código (RN-06, orçamento, Almoço conjunta) |
| RN-11 (lar único, 2 membros fixos) | RN-11, RN-22, RN-23 | vários lares, titular e convite (P1) |
| RN-19 (padrões do lançamento rápido) | RN-01 (bloco "Padrões") | número liberado para o cadastro |
| RNF-07 (sem backup no MVP) | RNF-09 | backup diário passa a ser obrigatório |
| LGPD "refutada para este uso" | RNF-14, RN-26 | com cadastro aberto a LGPD se aplica |
| Notificações fora do escopo | RN-27 | P8 |
| — | RN-24, RN-25 | planos Free/Pro (P2) |
| Defeito da fixa (ANALISE §2.3) | RN-28 | corrigido (P7) |
| CA-08.5, CA-15.3, RN-06 defasados | RN-06, RN-16 | o código vence |
