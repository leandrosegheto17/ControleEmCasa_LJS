# Etapa 17: roteiro do Neon e do Hyperdrive

- **Data:** 2026-10-27
- **Situação:** roteiro, nada executado. Cada passo externo precisa da confirmação do Leandro.
- **Regra:** nenhuma senha, URL de conexão ou chave passa pela conversa nem entra no repositório. Gere as senhas na sua máquina, cole direto no Neon, no GitHub e no `wrangler`.
- **Fontes:** pesquisa de 2026-10-27 na documentação oficial do Neon e da Cloudflare. O que a documentação não confirmou está marcado `[A VALIDAR]` e é testado no passo indicado.

## Antes de começar

1. Gere 3 senhas fortes e guarde num gerenciador de senhas (não em arquivo do projeto):
   `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` (uma por role).
2. Tenha à mão a conta da Neon e a da Cloudflare (zona `ljssoftware.com.br` ativa nela).

## 1. Projeto no Neon (console)

- Criar o projeto `controle-em-casa`, região **AWS São Paulo (`aws-sa-east-1`)**, **Postgres 17**.
- Anotar o **Project ID** (Settings do projeto) para a variável `NEON_PROJECT_ID`. `[A VALIDAR]` a localização exata no console.
- O console cria a branch `main` e o banco `neondb`, com a role `neondb_owner`. **Não use** `neondb_owner` no app: ela é `neon_superuser`, que tem `BYPASSRLS` e anularia a RLS.

## 2. Roles (SQL Editor, como `neondb_owner`)

Roles criadas por SQL não entram em `neon_superuser`; roles criadas pelo console entram. Por isso as três vão por SQL:

```sql
CREATE ROLE controle_owner      WITH LOGIN PASSWORD '<senha 1>' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE controle_app        WITH LOGIN PASSWORD '<senha 2>' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE controle_backup_ro  WITH LOGIN PASSWORD '<senha 3>' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
```

Conferir (a documentação não afirma que fica sem `BYPASSRLS`, então a prova é empírica):

```sql
SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
FROM pg_roles WHERE rolname LIKE 'controle_%';
```

Esperado: `false` em todas as colunas, nas 3 linhas. **Se algum `rolbypassrls` vier `true`, pare e me avise.**

## 3. Banco `controle` com dono `controle_owner`

- Console: Databases, novo banco `controle`, **owner `controle_owner`** (em SQL `CREATE DATABASE` não deixa escolher o dono na documentação).
- As migrations criam o schema `app`, as extensões `pgcrypto` e `citext` (no schema `app`) e fazem `ALTER ROLE ... IN DATABASE ... SET search_path = app`. `[A VALIDAR]` que a role dona consegue tudo isso no Neon: o ensaio abaixo (passo 5) prova.

## 4. Branch `dev` e strings de conexão

- Criar a branch `dev` (filha da `main`) **depois** do passo 3, para herdar roles e banco. `[A VALIDAR]` o passo no console.
- Anotar, para cada role, a string **direta** (host **sem** `-pooler`), com `sslmode=require`. As URLs:
  - owner: vai para o secret `DATABASE_URL_OWNER` (migrations e purga);
  - backup: vai para `DATABASE_URL_BACKUP`;
  - app: **só** vai para o Hyperdrive.
- Motivo da string direta: o pooler do Neon usa PgBouncer em transaction mode, e a API depende de `set_config(..., true)` dentro da transação; o Hyperdrive já faz o próprio pooling.

## 5. Ensaio na branch `dev` (antes de tocar na `main`)

Na sua máquina, com a URL **direta do owner da branch `dev`** numa variável só do terminal:

```powershell
$env:DATABASE_URL_OWNER = '<url direta owner, branch dev>'
pnpm migrar
```

Conferir (SQL Editor, branch `dev`, banco `controle`):
- 12 migrations aplicadas e `pnpm migrar` de novo diz "No migrations to run";
- 20 tabelas com RLS ligada e forçada: `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity;`;
- como `controle_app`: sem contexto devolve 0 linhas, e `CREATE TABLE` é negado.

Se algo falhar aqui, é o `[A VALIDAR]` do passo 3 e corrigimos antes de produção. O ensaio de restauração com a role owner (runbook 4.2) também se faz nesta branch.

## 6. Migrar a `main`

Mesmo comando com a URL do owner da `main`. Só depois do ensaio verde. Ação irreversível sem restauração: confirmação própria.

## 7. Hyperdrive (Cloudflare)

Na sua máquina, a string vai por variável (não fica no histórico do shell):

```powershell
$env:CONN = '<url direta controle_app, branch main>'
pnpm exec wrangler hyperdrive create controle --connection-string="$env:CONN" --caching-disabled
```

- O comando imprime o **id**. Eu troco o id fictício `00000000000000000000000000000000` do `wrangler.jsonc` e faço o commit.
- Conferir `caching` desligado (o `deploy.yml` já falha se estiver ligado). `[A VALIDAR]` o formato do id e o campo.
- Cota Free do Hyperdrive: 100 mil queries/dia.

## 8. Chaves para o GitHub (passos seguintes, outros roteiros)

| Onde | Nome | Origem |
|---|---|---|
| Secret do environment `producao` | `DATABASE_URL_OWNER`, `DATABASE_URL_BACKUP` | passo 4 |
| Secret | `NEON_API_KEY` | Neon: chave **escopada ao projeto**; `[A VALIDAR]` se cobre criar, apagar e restaurar branches |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare, menor escopo possível; `[A VALIDAR]` o mínimo (comece com Workers Scripts Edit, Hyperdrive Edit, Workers Routes Edit, Zone Read) |
| Variável | `NEON_PROJECT_ID`, `CLOUDFLARE_ACCOUNT_ID`, `AGE_RECIPIENT`, `DEPLOY_ATIVO`, `BACKUP_ATIVO`, `PURGA_ATIVA` | passos 1 e seguintes |

## Pontos de atenção levantados pela pesquisa

- **`ratelimits` no plano Free do Workers: não confirmado.** Se o `wrangler deploy` recusar o binding, a decisão é nossa (outro mecanismo de limite). Descobre-se no primeiro deploy; não há como saber antes.
- `namespace_id` dos 3 limites (2001 a 2003) precisa ser único **na conta** Cloudflare.
- Custom domain: `routes` com `custom_domain: true` para `controleemcasa.ljssoftware.com.br` ainda **não está** no `wrangler.jsonc`. É uma mudança no repositório para depois do Hyperdrive.
- Restauração do Neon Free: só **6 h** de histórico. O dump diário cifrado é a proteção real.
- Neon Free: 1 GB, 100 CU-h por mês, suspende após 5 min parado (a primeira requisição depois disso paga o cold start).
