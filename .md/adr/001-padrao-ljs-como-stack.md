# ADR-001: O app segue o Padrão LJS (Worker + Hono + Neon via Hyperdrive, monorepo pnpm)

- **Status:** Aceito em 2026-10-24 (etapa 0 aprovada; antes: Proposto)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)

## Contexto

- O MyMoney roda em Vercel Hobby + Supabase. A Vercel Hobby proíbe uso comercial, e o Controle em Casa terá plano pago.
- Os três apps da LJS Software (Controle em Casa, Gestão da Pelada, Evolução Segura) tinham stacks diferentes. Cada capacidade comum (auth, cobrança, e-mail, push, backup, observabilidade) teria de ser feita três vezes, de três jeitos.
- O usuário decidiu recriar os três apps do zero sobre um padrão único, com custo zero de infraestrutura, e deixá-los publicados.
- A refatoração no lugar do MyMoney (`MyMoney/.specs/refatoracoes/infra-cloudflare-neon/`) foi substituída por esta recriação.

## Decisão

Adotar o prompt "Padrão de projeto — LJS Software" sem substituições. As exceções são registradas cada uma em ADR próprio; a primeira é o ADR-002.

| Camada | Escolha |
|---|---|
| Repositório | Monorepo pnpm 11, Node 24, TypeScript estrito, `type: module`; pacotes `backend/contrato`, `backend/dominio`, `backend/api`, `backend/scripts`, `frontend/web` |
| Front | React 19 + Vite + `vite-plugin-pwa` + React Router + TanStack Query, servido como `assets` do Worker (SPA) |
| API | Hono no mesmo Worker, `/api/*` com `run_worker_first`, `nodejs_compat` |
| Banco | Neon Free (Postgres, `sa-east-1`) via Hyperdrive; Kysely + `pg`; node-pg-migrate |
| Auth | Própria, com sessão opaca em tabela e cookie `__Host-sid` |
| Serviços | Resend (e-mail), Asaas (cobrança Pix), Web Push (VAPID), Sentry, UptimeRobot |
| CI/CD | GitHub Actions: `ci.yml`, `deploy.yml` (único `wrangler deploy`), `backup.yml` |
| Domínio | `controleemcasa.ljssoftware.com.br` |

## Consequências

**Positivas**
- O plano pago pode existir sem violar termos de hospedagem.
- O que for feito aqui (auth, Asaas, push, deploy, backup) serve de modelo direto para os outros dois apps.
- Front e API no mesmo domínio e no mesmo Worker: cookie `__Host-` sem CORS.

**Negativas**
- O front, já pronto no legado, precisa trocar a camada de dados inteira (supabase-js por `fetch`).
- As regras em SQL do legado (36 funções) precisam ser reescritas; ver o ADR-003.
- Limite de 10 ms de CPU por requisição no Workers Free; ver o ADR-003.
- O `pg` devolve `bigint` como string por padrão. Os centavos precisam de um parser explícito, seguro até 2^53.
- Capacidades novas que o legado não tinha: cadastro aberto, cobrança, push, Sentry, backup.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Refatorar o MyMoney no lugar (plano de 49 tarefas já aprovado) | Quase metade das tarefas era de transição (gatilho-ponte, flag de transporte, compatibilidade com o Supabase). O usuário preferiu um repositório limpo e começar sem os dados atuais (P3) |
| Manter Supabase (banco + auth) e trocar só a hospedagem | Deixa os três apps em stacks diferentes e não segue o padrão |
| Vercel Pro ou outro host pago | Viola o custo zero |
