# Plano de desenvolvimento — Controle em Casa

- **Data:** 2026-10-24
- **Base:** `.md/ANALISE-MYMONEY.md` (regras, layout, riscos e decisões P1–P9) e o prompt "Padrão de projeto — LJS Software".
- **Status:** aprovado pelo usuário em 2026-10-24. A análise (`ANALISE-MYMONEY.md`) foi aprovada na mesma data.
- **Regra de trabalho:** uma etapa por vez, **um commit por etapa**, `pnpm lint && pnpm typecheck && pnpm test` verdes antes do commit. Ao fim de cada etapa: o que foi feito, como validar e o que vem a seguir.

Esforço por etapa: **P** = até meio dia de sessão; **M** = 1 a 2 dias; **G** = 3 a 5 dias.

## Decisões de arquitetura que o plano assume

1. **Onde ficam as regras:**
   - Regras pequenas e puras vão em `backend/dominio`, em TypeScript: parcelas, dia de vencimento, permissões de edição, situação do orçamento, progresso da meta, percentuais e geração das ocorrências de fixas. Os testes desses casos são portados dos pgTAP do legado.
   - **Agregações** (totais do mês, orçamento realizado, saldos, gasto do cartão) são consultas SQL com Kysely. Assim o Worker fica abaixo de 10 ms de CPU (risco R1).
   - Não haverá funções de regra em SQL nem SECURITY DEFINER.
2. **Isolamento:**
   - Todas as tabelas de negócio têm `lar_id`; as individuais têm também `dono_id`.
   - A RLS usa FORCE, com política "membro do lar" e "dono" para os dados privados.
   - A API abre uma transação por requisição e faz `set_config('app.usuario_id', …, true)` e `app.lar_id` (validado contra o vínculo).
   - A role `app` não tem BYPASSRLS nem DELETE onde excluir não é regra.
3. **Contrato:** schemas Zod em `backend/contrato`, únicos para a API e o front. As respostas preservam as formas do legado, inclusive as chaves privadas **omitidas** (RN-04) e os códigos de erro. As rotas ficam em REST, em português (`/api/lancamentos`, `/api/metas/:id/movimentos` etc.).
4. **Capacidades comuns aos três apps** (auth, cobrança, e-mail, push): implementadas aqui em módulos isolados (`backend/api/src/infraestrutura/{email,asaas,push}`) com fronteira clara, para extrair depois. Nenhum pacote compartilhado agora.
5. **Front:** copiar do legado `estilo/`, CSS Modules, `componentes/`, `formatacao/`, `rotulos/`, `comum/` e `pwa/`. Reescrever `dados/`: transporte `fetch` com o cookie `__Host-sid`, erros da API e fila offline com o dono vindo da sessão. As fronteiras do `eslint.fronteiras.js` continuam valendo.
6. **Git:** a branch `master` local vira **`main`**, porque o deploy só sai da `main`. O repositório remoto no GitHub será criado por você (ver Pré-requisitos).

## Etapas

| # | Etapa | Esforço | Entrega principal | ADRs | Riscos |
|---|---|---|---|---|---|
| 0 | **Documentos de método** | M | `.md/PRD.md` (produto: casal + cadastro aberto, Free/Pro), `PRD-TECNICO.md` (RN-01…RN-18 do legado com as correções), `SDD.md` (pacotes, modelo de dados, rotas, fluxos), `GUARDRAILS.md` (G-01…G-20 do legado adaptados + regras do padrão), `THREAT-MODEL.md` (STRIDE: sessão, isolamento por lar, privacidade entre membros, webhook, convite) | 001 Padrão LJS como stack · 002 Postgres 17 (diverge do 16) · 003 Regras puras em `dominio`, agregações em SQL · 004 Lar com titular e convite, RLS por lar | Documento divergir do código: o PRD-TECNICO cita o arquivo de origem de cada regra |
| 1 | **Esqueleto do monorepo** | M | pnpm 11 + Node 24 (`engines`, `.nvmrc`), `type: module`, `tsconfig.base.json` estrito, ESLint (com fronteiras), Prettier, `.gitleaks.toml`, `.env.example` comentado, `docker-compose.yml` (Postgres 17), 5 pacotes com um teste trivial, scripts `lint/typecheck/test/dev`, `ci.yml` inicial (lint, typecheck, test, gitleaks) com ações fixadas por SHA | — | Versões de Vite 8/Vitest/pool-workers incompatíveis entre si: travar no lockfile e conferir no CI |
| 2 | **Banco: base e identidade** | M | node-pg-migrate (transação por migration), `pnpm migrar`/`pnpm seed`, roles `owner`/`app`/`backup_ro`, `pgcrypto`, funções de GUC, tabelas `usuario`, `sessao`, `tentativa_login`, `token_email`, `aceite_termos`. CI: migrations do zero num Postgres 17 de serviço | 005 Roles e RLS com GUC por transação | Grants errados liberando DDL ao `app`: teste que tenta DDL e DELETE como `app` |
| 3 | **API: esqueleto no Worker** | M | `wrangler.jsonc` (assets com SPA, `run_worker_first: ["/api/*"]`, `nodejs_compat`, Hyperdrive com `localConnectionString`, `ratelimits`), Hono, cliente Kysely + `pg` por requisição, middleware de transação com `SET LOCAL`, `GET /api/health` (sem banco), `onError` sem dados pessoais, cabeçalhos (CSP, `Cache-Control: no-store` na API), CSRF por cabeçalho. Testes em `@cloudflare/vitest-pool-workers` com Postgres real | — | **R2 vazamento de GUC:** teste com 2 requisições concorrentes e GUC vazio depois do commit |
| 4 | **Auth própria** | G | cadastro aberto (aceite de termos com versão), confirmação por e-mail (token de 256 bits com hash, 30 min, uso único), entrar, sair, **sair de todos**, recuperação de senha. Sessão opaca de 256 bits com hash SHA-256, cookie `__Host-sid`, 15 min de inatividade / 12 h absolutas, rotação no login. bcrypt no Postgres. Bloqueio de 5 falhas em 15 min por e-mail e por IP. Anti-enumeração com mesma resposta e tempo. Resend via `fetch`. `LIMITE_ENTRAR`/`LIMITE_PUBLICO` | 006 Auth própria por sessão opaca | Anti-enumeração por tempo: teste de resposta igual; e-mail no log: scrubbing testado |
| 5 | **Domínio puro** | M | `backend/dominio`: datas em São Paulo, centavos, `gerarParcelas`/`diaNoMes` (RN-14), dia congelado, permissões de edição (RN-06/07), situação do orçamento, progresso da meta, `pagoPorMembro`, meses de geração das fixas, validações. Casos portados dos pgTAP | 007 Dinheiro em centavos e datas de calendário em SP · 008 Parcelas de competência | Divergência sutil do legado (arredondamento, último dia do mês): tabela de casos copiada do pgTAP |
| 6 | **Lar, membros e isolamento** | G | tabelas `lar`/`membro`, criação do lar no 1º acesso com as categorias iniciais (6 conjuntas + 7 individuais), **convite por e-mail** (token, aceitar, recusar, limite de 2), titular, saída do membro. RLS FORCE por lar e dono. **Teste negativo obrigatório:** o lar B não lê nem escreve nada do lar A, e o membro não vê o individual do outro | 009 Convite de membro | **R3 RLS com vários lares:** testes por tabela e por rota |
| 7 | **Cadastros** | M | contas (saldo RN-12, ajuste, arquivar, excluir com `em_uso`), formas (preferida, crédito com dia de vencimento), categorias (nome único, arquivar, excluir); contrato Zod; idempotência pelo id do cliente | 010 Escritas idempotentes pelo id do cliente | Ordem das recusas (`registro_invalido` antes de `*_arquivada`): teste |
| 8 | **Lançamentos** | G | lançar despesa e receita (idempotente, `ja_existia`), detalhe com **chaves privadas omitidas** para o outro membro, lista do mês com filtros, editar (recalcula parcelas, `confirmar_descarte`), alterar data da parcela (só o pagador, só crédito), excluir, pagamento de cartão | — | Edição é a regra mais complexa do legado: matriz de testes dono × outro membro × campo |
| 9 | **Despesas fixas e resumo do mês** | G | fixas (salvar, encerrar, ocorrências preguiçosas em janela de ±12 meses), pagar/desfazer **com a correção do defeito** (parcela no vencimento e categoria conjunta), `GET /api/resumo` com agregação SQL (RN-16), gasto do cartão. Medição de CPU no `wrangler dev` com a massa de 2 anos | — | **R1 CPU:** se passar de 10 ms, mover mais cálculo para o SQL antes de seguir |
| 10 | **Orçamento e metas** | M | definir/copiar/consultar orçamento, metas (salvar, aporte/retirada por local, `atingida_em` que marca e desmarca), movimentos e locais. Ficam abertos agora; o bloqueio Pro entra na etapa 13 | — | Retirada maior que o guardado no local: teste |
| 11 | **Front: base e acesso** | G | cópia dos itens portáveis do legado, nova camada `dados/` (transporte, sessão, erros), prefixo `/app` (rotas, manifest, `navigateFallback`), guardas de rota, telas de Entrar e Redefinir senha (layout atual), telas novas de cadastro, confirmação de e-mail e recuperação. Testes puros portados como estão; testes de `dados/` reescritos | 011 Front: transporte fetch + cookie, fila offline com o dono da sessão | Fila offline com sessão expirada (P5): reenvio depois do login, só do mesmo usuário |
| 12 | **Front: telas do app** | G | Início + folha Lançar, Lançamentos, Lançamento, Fixas, Orçamento, Metas, Ajustes (contas, formas, categorias), **convite de membro**, sair de todos. Mocks Vitest e Playwright regravados para `/api/*`; comparação visual contra o mockup do legado | — | Volume de testes (cerca de 75 Vitest + 45 specs): portar por tela, priorizando o fluxo principal |
| 13 | **Cobrança Asaas** | G | tabelas `assinatura` (do **lar**) e `webhook_evento`; cliente Asaas via `fetch`; Pix como método principal; `POST /api/webhooks/asaas` (token, idempotente, fora da sessão, `LIMITE_WEBHOOK`); estados trial → ativa → atrasada → cancelada → free; trial Pro de 14 dias sem cartão; `exigePlano('pro')` em orçamento e metas, que no Free ficam somente leitura sem apagar nada; tela **Meu plano** (plano, renovação, Pix copia-e-cola/QR, cancelar); e-mails de cobrança gerada, pagamento confirmado e atraso. Validado no sandbox | 012 Cobrança por lar via Asaas | Webhook fora de ordem ou repetido: testes com `event_id` duplicado e eventos invertidos |
| 14 | **Landing e LGPD** | M | landing em `/` (proposta, planos, "Começar grátis"), `/termos` e `/privacidade` (LGPD, versão registrada no aceite), **exclusão de conta** (confirmação por e-mail e purga em 30 dias por Cron; titular com membro: o lar é encerrado com aviso e purgado junto; purga por `purgar.ts` no GitHub Actions com a role owner) | 013 Exclusão de conta e purga | Exclusão do titular com membro ativo (lar encerrado com aviso): regra explícita e testada |
| 15 | **Web Push** | M | VAPID, `push_subscription`, JWT ES256 com `crypto.subtle`, Cron Trigger em lotes com `ctx.waitUntil`: **fixa vencendo ou atrasada**, **lembrete diário opcional de lançar**, **meta atingida**; handlers `push`/`notificationclick` no service worker; preferências em Ajustes; instrução de instalação no iOS | 014 Push nativo por VAPID | iOS só recebe push com o PWA instalado: aviso na tela |
| 16 | **Operação e qualidade** | M | Sentry (`@sentry/cloudflare` + `@sentry/react`, release = SHA, scrubbing), `deploy.yml` (ordem fixa: build, branch de restauração no Neon mantendo 2, dump cifrado, migração com `owner`, `wrangler deploy --var URL_PUBLICA`) + teste que proíbe outro `wrangler deploy`, `backup.yml` (diário às 04:00 BRT, `pg_dump -Fc` com `backup_ro`, `age`, 30 dias), `README.md`, `docs/runbook.md`, e2e Playwright críticos (cadastro, login, assinar, lançar), Lighthouse PWA ≥ 90 | 015 Deploy e backup | Restauração nunca testada: o runbook inclui um ensaio com resultado registrado |
| 17 | **Publicação** | M | criar o Neon (sa-east-1, branches `main`/`dev`, roles), Hyperdrive com cache desligado, secrets (GitHub `producao` + `wrangler secret`), domínio `controleemcasa.ljssoftware.com.br`, `MAIL_FROM`, Asaas produção, UptimeRobot, primeiro deploy, teste de fumaça, ensaio de restauração | — | Ações externas: **cada uma com sua confirmação**. Limites atuais do Neon e do Workers Free conferidos na hora, não de memória |

**Total estimado:** 11 etapas M e 7 etapas G, ou seja, **32 a 57 dias de sessão**. O número é uma estimativa; o esforço real de cada etapa é medido e registrado ao fechá-la. O uso diário (casal, sem cobrança) fica possível ao fim da etapa 12, e o produto completo e publicado, ao fim da 17.

## Pré-requisitos seus (antes das etapas indicadas)

| Quando | O quê |
|---|---|
| Etapa 1 | Criar o repositório vazio no GitHub e me passar a URL (o push só acontece com sua confirmação) |
| Etapa 4 | Chave da API do Resend com permissão de envio no domínio `ljssoftware.com.br` |
| Etapa 13 | Conta Asaas **sandbox** e token da API |
| Etapa 16 | Projeto no Sentry (free): DSN do front e do Worker |
| Etapa 17 | Acesso à Cloudflare (conta e zona `ljssoftware.com.br`), conta Neon, Asaas produção, UptimeRobot |

## Fora do escopo

- Migração de dados do MyMoney atual (P3).
- Mais de 2 membros por lar.
- Integração bancária, importação de extrato, fatura de cartão com fechamento, exportação CSV, acerto de contas entre membros (igual ao legado).
- Pacote compartilhado entre os três apps (decisão 4).
- Ambiente de homologação: o preview é o `wrangler dev` local.
