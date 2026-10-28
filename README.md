# Controle em Casa

PWA de finanças para casais: um **lar** com um titular e até um membro convidado, gastos **conjuntos** (os dois veem) e
**individuais** (só o dono vê), despesas fixas, orçamento, metas, plano Free/Pro cobrado por Pix (Asaas), Web Push e
uso offline com fila de envio. É a recriação do MyMoney no Padrão LJS.

- Produto e regras: `.md/PRD.md`, `.md/PRD-TECNICO.md`
- Arquitetura: `.md/SDD.md` e as decisões em `.md/adr/`
- Regras de segurança e qualidade: `.md/GUARDRAILS.md`, `.md/THREAT-MODEL.md`
- Plano de construção: `.md/PLANO.md`
- Operação (deploy, rollback, backup, restauração, incidentes): [`docs/runbook.md`](docs/runbook.md)

## Stack

| Parte    | Tecnologia                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------- |
| API      | Cloudflare Worker único (Hono), `backend/api`                                                   |
| Banco    | Postgres 18 (Neon em produção, Docker no local), acesso pelo Hyperdrive, RLS por lar            |
| Front    | React 19 + Vite + React Router + TanStack Query, PWA com service worker próprio, `frontend/web` |
| E-mail   | Resend (no local, o link aparece no terminal)                                                   |
| Cobrança | Asaas (Pix), sandbox no local                                                                   |
| Erros    | Sentry (`@sentry/cloudflare` e `@sentry/react`), desligado sem DSN                              |
| CI/CD    | GitHub Actions: `ci.yml`, `deploy.yml`, `backup.yml`, `purga.yml`                               |

## Estrutura

```text
backend/
  contrato/   schemas Zod de entrada e saída de todas as rotas (compartilhado com o front) e a limpeza do Sentry
  dominio/    regras puras (dinheiro em centavos, datas, parcelas, permissões, plano)
  api/        o Worker: entrada (rotas), aplicacao, infraestrutura (banco, e-mail, Asaas, push), middleware
  scripts/    migrations SQL, seed, purga, scripts de operação (deploy, backup, G-43) e testes de banco
frontend/
  web/        o app (src/), e2e com API simulada (e2e/), e2e da pilha real (e2e-pilha/), scripts (Lighthouse)
docs/         runbook de operação
.github/      workflows e a action do dump cifrado
wrangler.jsonc  configuração do Worker (sem segredo)
```

## Requisitos

- Node 24 (`.nvmrc`) e pnpm 11 (`corepack enable`)
- Docker (Postgres 18 local)

## Rodar no local

1. Instale as dependências:

   ```bash
   pnpm install
   ```

2. Crie o `.env` a partir do exemplo. Se a porta 5432 da máquina estiver ocupada, use outra, por exemplo 55432, em
   `PORTA_POSTGRES` **e** nas três URLs (o `.env` não expande variáveis):

   ```bash
   cp .env.example .env
   # edite: PORTA_POSTGRES=55432 e troque :5432 por :55432 nas URLs
   ```

3. Suba o Postgres, aplique as migrations e o seed (só local):

   ```bash
   docker compose up -d
   pnpm migrar
   pnpm seed
   ```

   Quem tinha o banco local em Postgres 17 (antes do ADR-016) precisa recriar o volume, que o 18 não lê:
   `docker compose down -v` e `docker compose up -d` (os dados locais são de teste).

4. Segredos do Worker no local: crie o `.dev.vars` na raiz (está no `.gitignore`; o bloco no fim do `.env.example`
   explica cada um). O mínimo é a `CHAVE_HMAC`:

   ```bash
   node -e "console.log('CHAVE_HMAC=' + require('crypto').randomBytes(32).toString('base64url'))" > .dev.vars
   ```

5. Construa o front e suba o Worker (front e API na mesma origem, `http://localhost:8787`). Com o Postgres em outra
   porta, aponte o Hyperdrive local para ela:

   ```bash
   pnpm --filter @controle/web build
   cd backend/api
   CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://controle_app:controle_app@127.0.0.1:55432/controle \
     pnpm exec wrangler dev -c ../../wrangler.jsonc
   ```

   Sem `RESEND_API_KEY`, o link de confirmação do cadastro aparece no terminal do `wrangler dev`. Os usuários do seed
   entram com a senha `Senha-local-123`.

`pnpm dev` sobe só o front no Vite (porta 5173), sem a API: serve para mexer em tela; o app de verdade é o do passo 5.

## Scripts

| Comando                                              | O que faz                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                          | ESLint e Prettier (sempre pela raiz: dentro de `frontend/web` o Prettier reformata `tokens.css` e `global.css`) |
| `pnpm typecheck`                                     | `tsc` em todos os pacotes                                                                                       |
| `pnpm test`                                          | Vitest de todos os pacotes, um depois do outro (os de banco precisam do Postgres no ar)                         |
| `pnpm migrar`                                        | migrations com a role owner (`DATABASE_URL_OWNER`)                                                              |
| `pnpm seed`                                          | usuários de exemplo (só em banco local)                                                                         |
| `pnpm --filter @controle/web e2e`                    | e2e Playwright com a API simulada (sem banco)                                                                   |
| `pnpm --filter @controle/web e2e:pilha`              | constrói o front e roda os e2e críticos na pilha real (Worker + Postgres, Asaas simulado)                       |
| `pnpm --filter @controle/web run lighthouse`         | mede o Lighthouse do build (meta: PWA ≥ 90)                                                                     |
| `pnpm --filter @controle/scripts migracoes-aditivas` | recusa migration não aditiva (G-43)                                                                             |
| `pnpm --filter @controle/scripts massa`              | massa de 2 anos num lar novo do banco local (medição de CPU)                                                    |
| `pnpm --filter @controle/scripts gerar-vapid`        | gera um par VAPID (só imprime)                                                                                  |

## Testes

- **Toda mudança de comportamento tem teste.** A suíte inteira roda com `pnpm lint && pnpm typecheck && pnpm test`.
- Os testes de banco (pacotes `scripts` e `api`) precisam do Postgres no ar e das variáveis do `.env`. Sem elas, são
  pulados com aviso; com `EXIGIR_BANCO=1` (CI), falham.
- A API é testada dentro do runtime do Workers (`workerd`) contra um banco descartável criado a cada execução.
- e2e: `e2e/` usa a API simulada por `page.route`; `e2e-pilha/` sobe o Worker de verdade e um banco descartável, com o
  Asaas simulado por um servidor local. Os dois limitam o Playwright a 2 workers.
- Alguns testes de tempo são instáveis sob carga e passam isolados (lista no `.specs/STATE.md`).
- Antes de integrar: `python .claude/scripts/trava-testes.py --rodar` (o hook bloqueia push sem a suíte verde).

O CI (`.github/workflows/ci.yml`) roda lint, typecheck, testes, o passo de migrations aditivas, os testes de banco no
Postgres 18, os e2e (simulados e da pilha real), o Lighthouse e o gitleaks. As ações ficam fixadas por SHA.

## Deploy e operação

- Só o `.github/workflows/deploy.yml` publica o Worker. O disparo é manual, da `main` (`gh workflow run deploy --ref main`
  ou Actions → deploy → Run workflow), e só segue com o CI verde no mesmo commit. A ordem é fixa: build, cache do Hyperdrive conferido, dump cifrado (o
  ponto de retorno; o Neon tem só as branches `main` e `dev`), migração com a role owner, publicação e saúde.
- `backup.yml`: dump diário às 04:00 de Brasília, cifrado com `age`, guardado 30 dias como artefato.
- `purga.yml`: purga diária das contas excluídas (30 dias).
- Os três ficam inertes até as variáveis `DEPLOY_ATIVO`, `BACKUP_ATIVO` e `PURGA_ATIVA` serem ligadas (etapa 17).
- Nenhum segredo fica no repositório: os nomes estão no `.env.example`; os valores vão para `wrangler secret` e para
  os secrets do GitHub.

Procedimentos de deploy, rollback, restauração, rotação de segredos e incidentes: [`docs/runbook.md`](docs/runbook.md).
