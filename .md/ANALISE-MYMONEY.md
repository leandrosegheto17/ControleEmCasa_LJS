# Análise do legado — MyMoney → ControleEmCasa_LJS

- **Data:** 2026-10-24
- **Legado (somente leitura):** `C:\Leandro\Projetos\MyMoney` (commit `282f2ae`)
- **Objetivo:** recriar o MyMoney do zero no Padrão LJS, com as mesmas regras de negócio e 100% do layout das telas.
- **Substitui:** a refatoração no lugar planejada em `MyMoney/.specs/refatoracoes/infra-cloudflare-neon/` (aprovada, nunca executada). O mapeamento dela foi aproveitado aqui.

Nas referências, **T** = `backend/supabase/schemas/app/tabelas/`, **F** = `.../app/funcoes/`, **A** = `.../api/funcoes/` (caminhos do legado).

---

## 1. O que é o MyMoney hoje

- **Para quê:** finanças de um casal. Despesas conjuntas da casa e finanças individuais privadas. A dor principal são os gastos variáveis (mercado, delivery, almoço), sem controle.
- **Quem usa:** exatamente 2 usuários num único lar. O cadastro é fechado: os usuários foram criados à mão no painel do Supabase (ADR-008/014). Não há convite.
- **Onde roda:** front na Vercel Hobby (`mymoney-ljs.vercel.app`); banco e auth no Supabase Free (`sa-east-1`); keep-alive por um Worker agendado.
- **O que falta hoje:** backup, Sentry e UptimeRobot.
- **Produção:** em uso desde 2026-10-15, com 1 lar e 2 membros. O volume real não está registrado; a massa sintética local tem 5.990 parcelas em 2 anos.
- **Arquitetura atual:**
  - Regras em SQL: 36 funções `api.*` expostas pelo PostgREST, além de 5 views.
  - RLS FORCE nas 14 tabelas, com a identidade vinda de `auth.uid()`.
  - Front React 19 + Vite + React Router 8 + TanStack Query 5 + `vite-plugin-pwa`, já igual ao alvo.
- **Testes:**
  - banco: 1.812 pgTAP;
  - API: 241 casos;
  - front: cerca de 1.580 casos Vitest e cerca de 288 Playwright, com axe e comparação visual contra o mockup.

## 2. Regras de negócio (o contrato a preservar)

### 2.1 Modelo de dados

Todas as tabelas têm `lar_id`. Os ids são uuid, gerados pelo cliente nas escritas idempotentes.

| Tabela | Dono | Quem vê | Observações |
|---|---|---|---|
| lar | — | membros | 1 lar só (índice único `((true))`) |
| membro | — | lar | `posicao` 1/2; um gatilho recusa o 3º membro |
| conta | usuário | **só o dono** | `saldo_inicial_centavos` (pode ser negativo), `arquivada` |
| forma_pagamento | usuário | só o dono | pix/débito exigem conta; crédito exige `dia_vencimento` 1–31; 1 preferida por dono |
| categoria | lar ou usuário | conjunta: lar; individual: dono | `tipo` despesa/receita, `escopo`, `variavel` (só despesa); receita sempre individual; nome único com `nulls not distinct` |
| lancamento | usuário (pagador ou autor) | conjunto: lar; individual: dono | `valor_total` de 1 a 10^11 centavos; 1–24 parcelas; `alterado_por/em` |
| lancamento_pagamento | usuário | **só o pagador**, também na conjunta | forma, conta, `data_operacao`, `dia_vencimento_aplicado` |
| parcela | como o lançamento | como o lançamento | `data`, `data_ajustada`; escopo e dono desnormalizados por FK `on update cascade` |
| despesa_fixa | lar | lar | só conjunta; **não se exclui, só se encerra** |
| ocorrencia_fixa | lar | lar | unique(fixa, mês); `lancamento_id` quando paga |
| orcamento | lar ou usuário | conforme o escopo | unique(categoria, mês) |
| meta | lar ou usuário | conforme o escopo | **não se exclui**; `atingida_em` |
| movimento_meta | autor | quem vê a meta | aporte/retirada; `local` (até 60 caracteres); **imutável** |
| movimento_conta | usuário | só o dono | ajuste, aporte, retirada, pagamento_cartao |

### 2.2 Regras principais

| Regra | Definição (conforme o código) | Onde |
|---|---|---|
| Escopo | Vem da **categoria**, nunca do cliente | A lancar_despesa.sql:46-51 |
| Privacidade (RN-04) | Na despesa conjunta, o outro membro vê descrição, categoria, valor, data da parcela, k/N, pagador e `alterado_por`. **Não vê** forma, conta, `data_operacao` nem `data_ajustada`: as chaves são **omitidas** da resposta | A lancamento.sql:37-84 |
| Edição (RN-06/07) | O dono pode tudo. O outro membro, numa conjunta, edita descrição, valor, data (exceto no crédito) e categoria conjunta. Um campo sem permissão recusa a edição inteira. Pagamento de fixa: só o pagador | F permissoes_edicao.sql:38-59 |
| Parcelas de crédito (RN-14) | Parcela k = dia de vencimento no mês `compra + k`. Dia inexistente no mês vira o último dia. Base = total div N, e a 1ª parcela leva o resto. Exige total ≥ N. Pix/Débito/receita: 1 parcela na data da operação | F gerar_parcelas.sql, dia_no_mes.sql, calcular_parcelas.sql |
| Dia congelado | O vencimento usado fica em `dia_vencimento_aplicado`. A edição reaproveita esse dia, a menos que a forma tenha mudado | A editar_lancamento.sql:125-144 |
| Editar compra | Recalcula as parcelas, mantém os ids das que continuam e zera os ajustes. Se havia ajuste manual, exige `confirmar_descarte` | A editar_lancamento.sql:147-194 |
| Saldo (RN-12) | saldo inicial + receitas − Pix/Débito ± movimentos, contando só o que tem **data ≤ hoje**. Crédito não mexe no saldo | F saldo_conta.sql |
| Cartão (RN-13) | Gasto do mês = parcelas com data no mês; comprometido = meses seguintes | F gasto_cartao.sql |
| Resumo do mês (RN-16) | **Total do casal** = parcelas de despesa conjunta no mês, com quebra por categoria, variáveis em destaque e `pago_por_membro` em % (o último fecha 100). **Minha parte** = as conjuntas que eu paguei. **Meu total** = minha parte + meu individual. **Resultado** = minhas receitas − meu total. Resultado conjunto = orçado − total, marcado `parcial` até o mês fechar | F totais_conjunto.sql, totais_individuais.sql; A resumo_mes.sql |
| Orçamento | Realizado = parcelas do mês. O total soma todas as despesas do escopo, orçadas ou não. Situação: < 80% dentro, ≤ 100% atenção, > 100% estourado. Destaques = as 3 de maior %. A cópia do mês anterior não sobrescreve e pula categorias arquivadas | F orcado_realizado.sql, situacao_orcamento.sql |
| Metas | guardado = aportes − retiradas; falta = max(0, alvo − guardado); % limitado a 99 até atingir; mensal necessário = arredondado para cima de falta ÷ meses (mínimo 1 mês). `atingida_em` é marcado e **desmarcado** quando o guardado cai. A retirada é limitada ao saldo do local. Aporte debita a conta, retirada credita | F progresso_meta.sql; A movimentar_meta.sql |
| Despesas fixas | As ocorrências são geradas sob demanda (janela de ±12 meses, idempotente). Situação: paga, atrasada ou pendente. Pagar cria um lançamento conjunto de 1 parcela **na data de vencimento**, com qualquer forma. Desfazer apaga esse lançamento. Encerrar apaga as pendentes futuras | F garantir_ocorrencias.sql; A pagar_ocorrencia.sql |
| Idempotência | Toda escrita leva o id do cliente. Reenvio do mesmo membro devolve o que foi gravado (`ja_existia`). Id que pertence a outro dá `registro_invalido` | F resposta_lancamento.sql |
| Erros | `registro_invalido` vale tanto para "não existe" quanto para "não é seu" (anti-enumeração). Ordem de recusa: primeiro `registro_invalido`, depois `*_arquivada` | `contrato/src/erros.ts` |
| Datas e dinheiro | "hoje" no fuso America/Sao_Paulo; dinheiro em centavos bigint | F hoje.sql; ADR-004 |
| Categorias iniciais | Conjuntas: Mercado (V), Delivery/iFood do casal (V), Moradia, Contas da casa, Outros da casa, Almoço/Alimentação fora (V). Individuais por membro: Delivery pessoal (V), Transporte (V), Lazer pessoal (V), Outros. Receitas: Salário, Extra, Outros | A inicializar_membro.sql:19-46 |

São 36 operações; a lista completa, com entradas, saídas e erros, está em `MyMoney/.specs/refatoracoes/infra-cloudflare-neon/reconhecimento.md:94-107`.

### 2.3 Achados no legado

- **Provável defeito, sem teste:** quando o pagador edita o valor do pagamento de uma fixa, as parcelas são recalculadas. A parcela sai da data de vencimento, o que quebra a regra I-20, e ele também consegue passar o lançamento para uma categoria individual (`tests/lancamentos/lancamento_de_fixa.sql:55-57` só confere o valor).
- **Bug candidato no front:** o "sair de todos" não trata o 400 que o Supabase devolve na segunda revogação. Na stack nova esse caso deixa de existir.
- **Documentos defasados:** Almoço passou a ser conjunta (não individual); RN-06; CA-08.5; CA-15.3. Nesses pontos o código vence.

## 3. Telas e layout

- **Copiar sem mudança:**
  - `estilo/`: `tokens.css` (igual ao mockup), `global.css` e as fontes IBM Plex locais;
  - os 90 `*.module.css`;
  - cerca de 45 componentes base;
  - os componentes de apresentação;
  - `formatacao/`, `rotulos/`, `comum/`;
  - `pwa/`, os ícones e o sprite SVG;
  - a fila offline (`dados/fila`, só trocando a origem do dono) e o `clienteConsulta.ts`.
- **Adaptar:**
  - `dados/` (cerca de 30 arquivos): cliente `fetch('/api/…')` no lugar do supabase-js, sessão por cookie e erros da API;
  - guardas de rota;
  - o prefixo `/app` nas rotas, links, manifest e `navigateFallback`;
  - CSP, que passa para os cabeçalhos do Worker;
  - o contrato: sai o `Database` gerado pelo Supabase e entram schemas Zod.
- **Telas atuais (14 grupos):** Entrar, Redefinir senha, Início (com a folha Lançar), Lançamentos, Lançamento, Fixas, Orçamento, Metas, Ajustes, Contas, Formas, Categorias e Não encontrada. O mockup tem 85 HTMLs (tela × estado) em `.md/mockup/telas`.
- **O que não existe e o padrão exige (sem mockup):**
  - landing `/`;
  - cadastro;
  - confirmação de e-mail;
  - recuperação de senha completa;
  - Meu plano;
  - `/termos` e `/privacidade`;
  - exclusão de conta;
  - permissão de push;
  - convite de membro, se houver vários lares.

  Essas telas serão desenhadas com os componentes base existentes.
- **Testes do front:** cerca de 75 arquivos Vitest e 45 specs Playwright simulam URLs do Supabase e precisam regravar os mocks para `/api/*`. Os testes puros passam como estão.

## 4. Infraestrutura: padrão LJS × referência GestaodaPelada

| Item | GestaodaPelada | Ação |
|---|---|---|
| Estrutura entrada/aplicação/infraestrutura, cliente por requisição, transação | Existe | Copiar e adaptar |
| Token de sessão, hash fixo anti-enumeração, trava de login, rate limit, CSRF por cabeçalho, `onError` | Existe | Copiar e adaptar (nome do cabeçalho) |
| `deploy.yml`, `backup.yml`, action `dump-cifrado`, checagens (`wrangler deploy` único, ações fixadas, migração aditiva) | Existe | Copiar e adaptar |
| Node 22, TS 5.9, Postgres 16, aplicador próprio de migrations, cookie `__Host-sessao` de 30 dias, papel único sem RLS, e-mail do dono fixo no SQL | Diverge | **Não copiar** |
| Papéis owner/app/backup_ro, RLS + `SET LOCAL`, sessão 15 min/12 h, node-pg-migrate | Não existe | Fazer do zero |
| Cadastro aberto, Resend, Asaas, Web Push, Sentry, UptimeRobot, termos/LGPD | Não existe | Fazer do zero (primeiro dos três apps) |

## 5. Riscos técnicos

| # | Risco | Mitigação proposta |
|---|---|---|
| R1 | **CPU de 10 ms do Worker:** agregar milhares de parcelas e parsear com Zod em TS pode estourar | Agregações (totais do mês, orçamento, saldos) como **consultas SQL** via Kysely; o tempo no banco não conta como CPU. Regras pequenas (parcelas, situação, progresso, permissões) em `dominio`, puras e testadas. Medir a CPU no `wrangler dev` |
| R2 | **Vazamento do GUC no pool do Hyperdrive** | Só `set_config(..., true)` dentro da transação; teste com 2 requisições concorrentes; cache do Hyperdrive desligado e conferido no deploy |
| R3 | **RLS com vários lares** | Política "membro do lar" via `SET LOCAL app.usuario_id` + `app.lar_id` validado contra o vínculo; manter as FKs compostas `(id, dono_id)`; app sem BYPASSRLS |
| R4 | **Sessão de 15 min de inatividade contra o lançamento em até 10 s (M3) e a fila offline** | Aceito (P5): mantém 15 min/12 h; a fila offline segura o lançamento até o próximo login |
| R5 | **Neon Free suspenso:** a retomada a frio pesa no 1º acesso (meta do Início: ≤ 2 s) | Medir; o `/api/health` não toca o banco |
| R6 | **Migração dos dados de produção:** o esquema muda, então é preciso um ETL. Os UUIDs devem ser preservados (idempotência). As senhas `$2a$10$` do GoTrue são compatíveis com `crypt()`, mas falta teste | Só se P3 = migrar; teste com hash real; conferência de contagens e somas; exige confirmação específica |
| R7 | **Troca de domínio apaga o IndexedDB** (fila e PWA nos 2 aparelhos) | Esvaziar a fila e reinstalar o PWA no corte |
| R8 | **Volume de testes a portar** (pgTAP de regra → Vitest de `dominio`/API) | Portar por regra, não por arquivo; teste negativo de isolamento por rota |

## 6. Decisões do usuário (2026-10-24)

- **P1:** lar com titular e convite por e-mail. Mantém conjunto × individual privado, com até 2 membros como hoje.
- **P3:** começar vazio. Não há migração da produção; o MyMoney antigo segue no ar até a troca. Os riscos R6 e R7 deixam de se aplicar.
- **P5:** manter o padrão, com 15 min de inatividade e 12 h absolutas. O login frequente fica aceito. A fila offline guarda os lançamentos e envia depois do próximo login.
- **P7:** corrigir o defeito da fixa. A parcela continua no vencimento e a categoria continua conjunta, com teste.
- **P2:** o Free tem lançamentos, despesas fixas, resumo do mês, contas, formas, categorias e convite de membro. **Orçamento e metas são só do Pro.** O Pro custa **R$ 9,90/mês** (Pix, Asaas). Trial Pro de 14 dias. Quando o plano expira, orçamentos e metas ficam somente leitura, sem apagar nada.
  - O plano é do **lar**, herdado do titular. O membro convidado usa os recursos Pro sem pagar.
- **P6:** Postgres **17** em local, CI e produção, na mesma versão do Neon. Diverge do padrão (16) e será registrado em ADR.
- **P8:** push para **fixa vencendo ou atrasada**, **lembrete diário opcional de lançar** e **meta atingida**.
- **P4:** nome **Controle em Casa**, em `controleemcasa.ljssoftware.com.br`. `MAIL_FROM` com o nome "Controle em Casa".
- **P9:** as telas novas vão direto para o código, com os tokens e componentes base existentes, e são ajustadas depois de ver rodando.

## 7. Perguntas feitas

Todas foram respondidas; as respostas estão no §6.

| # | Pergunta | Por que importa |
|---|---|---|
| P1 | **Modelo de uso:** com cadastro aberto, cada usuário cria seu lar e convida membros? Quantos membros por lar? | Muda o modelo de dados, a RLS e as telas (convite) |
| P2 | **Free × Pro:** o que o Free limita (membros, contas, metas, histórico, orçamento)? Qual o preço do Pro? | Middleware `exigePlano` e limites na API |
| P3 | **Dados atuais:** migrar a produção do MyMoney (casal, com as senhas preservadas) ou começar vazio? | Etapa de ETL e corte |
| P4 | **Nome e domínio:** "MyMoney" ou "Controle em Casa"? Subdomínio `mymoney.` ou `controleemcasa.ljssoftware.com.br`? `MAIL_FROM`? | Marca, manifest, e-mails, termos |
| P5 | **Sessão:** manter 15 min de inatividade e 12 h absolutas num PWA de lançamento rápido no celular? | Com 15 min, quase todo gasto exigiria login, contra a M3 |
| P6 | **Postgres local:** o padrão diz 16, mas o Neon novo usa 17 | Paridade entre local, CI e produção |
| P7 | **Defeito da fixa (2.3):** corrigir na recriação (a parcela fica no vencimento e a categoria continua conjunta) ou replicar? | Comportamento do contrato |
| P8 | **Push:** quais lembretes (fixa a vencer, orçamento em atenção, meta)? | Cron e telas |
| P9 | **Telas novas sem mockup:** desenhar com os componentes base e aprovar antes, ou direto no código? | Fluxo da etapa de front |
