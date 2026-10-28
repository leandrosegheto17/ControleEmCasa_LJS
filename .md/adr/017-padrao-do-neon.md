# ADR-017: Padrão de uso do Neon

- **Status:** Aceito em 2026-10-28 (decisão do usuário, padrão comum aos projetos dele)
- **Data:** 2026-10-28
- **Decisores:** Leandro (stakeholder)
- **Emenda:** ADR-015 (decisões 3.3 e 7). Mantém o ADR-016 (Postgres 18)
- **Detalha:** GUARDRAILS G-43 e G-44; THREAT-MODEL TM-DB-07; `docs/runbook.md`, seções 2, 3.2 e 4

## Contexto

- O usuário tem mais de um projeto no Neon e quer o mesmo jeito de usá-lo em todos: as mesmas branches, os mesmos nomes
  de variável, a mesma validação de destino e o mesmo ponto de retorno antes de migrar.
- Até aqui o deploy criava uma branch `restauracao-<run>-<tentativa>` no Neon antes de migrar, mantendo as 2 mais novas
  (ADR-015, decisão 3.3). Isso exigia a `NEON_API_KEY` no GitHub, gastava o limite de branches do plano Free e, na
  prática, o dump cifrado já era o ponto de retorno independente do Neon.

## Decisão

1. **Branches:** o projeto Neon tem só duas branches permanentes, `main` (produção) e `dev`. Nada de branch por PR e
   nada de branch de restauração. O deploy não cria nem apaga branch; a `NEON_API_KEY` e a `NEON_PROJECT_ID` saem do
   GitHub (nenhum workflow chama a API do Neon). O ponto de retorno antes de cada migração é só o dump cifrado com `age`
   (`dump-predeploy-<run>-<tentativa>`, G-44), e o diário é o `backup-<data>-...`. A restauração é pelo dump, primeiro no banco
   `controle` recriado da `dev` e, conferido, no da `main`, sem criar branch (runbook 4.2).
   Ordem do deploy: endereço do Asaas → build → cache do Hyperdrive → dump cifrado → migração com o owner → `wrangler
   deploy` → saúde.
2. **Postgres 18** em local (`docker-compose.yml`), CI (`ci.yml`) e no Neon, como no ADR-016. A imagem do `pg_dump`
   continua fixada por digest (`postgres:18-alpine@sha256:…` em `dump-cifrado.ts`); compose e CI usam a tag
   `postgres:18-alpine`.
3. **Nomes das variáveis:** `NEON_URL_*` para toda conexão com o Neon, e `DATABASE_URL_*` só para o banco local e de
   teste.
   - `NEON_URL_OWNER` (role `controle_owner`): secret do environment `producao` para a migração do deploy e a purga, e
     variável só do terminal para o `migrar-neon` e o `conferir-banco` contra o Neon;
   - `NEON_URL_BACKUP` (role `controle_backup_ro`): secret do `producao` para o backup e o dump do deploy;
   - `NEON_URL_APP` (role `controle_app`): só no terminal, ao criar o Hyperdrive; o Worker usa o binding `HYPERDRIVE`;
   - `DATABASE_URL_OWNER`, `DATABASE_URL_APP` e `DATABASE_URL_BACKUP` ficam no `.env` local (Postgres do Docker) e nos
     testes, que criam a partir delas um banco descartável por execução, passado ao node-pg-migrate como
     `DATABASE_URL_TESTE` (ou `DATABASE_URL_E2E` nos e2e da pilha).

   A migração do deploy passa a usar o `migrar-neon --sim`, que lê só `NEON_URL_OWNER` do ambiente (nunca o `.env`) e,
   depois de migrar, confere roles, RLS e migrations como o `conferir-banco`.
4. **Validação única da URL do Neon** (`backend/scripts/src/operacao/url-neon.ts`, `validarUrlNeon`): recusa texto
   que não é URL postgres, destino local (`localhost`, `127.0.0.1`, `::1`, porta 55432), host fora de `.neon.tech`,
   host `-pooler` e URL sem `sslmode=require` (ou `verify-full`). É usada antes de conectar em todo caminho que toca o
   Neon: `migrar-neon` (manual e na migração do deploy), `dump-cifrado` (backup diário e dump do deploy), `purgar`,
   `conferir-banco` (com `NEON_URL_OWNER`; a `DATABASE_URL_OWNER` apontando para o Neon é recusada) e a restauração
   (`pnpm --filter @controle/scripts conferir-url-neon NEON_URL_RESTAURACAO` antes do `pg_restore`, runbook 4.2).
   Nenhuma mensagem traz a senha nem a URL.
5. **Timeout de conexão no cliente de banco:** a API abre o pool do `pg` com `connectionTimeoutMillis: 8000` (8 s;
   `backend/api/src/infraestrutura/db/cliente.ts`), que cobre a retomada a frio do Neon pelo Hyperdrive sem prender a
   requisição indefinidamente. Não há nova tentativa (retry) automática: a falha de conexão vira o erro de banco
   indisponível da API. Os scripts de operação (`migrar-neon`, `purgar`, `conferir-banco`) usam o padrão do `pg`.
6. **Testes de banco em banco temporário por execução:** cada execução cria um banco com nome aleatório a partir das
   `DATABASE_URL_*` locais (`controle_teste_<hex>`, `controle_api_teste_<hex>`, `controle_e2e_<hex>` e os prefixos de
   `criarBancoDescartavel`), aplica as migrations do zero e o apaga no fim. Nenhum teste usa o Neon.
7. **Database padronizado:** no Neon o database do projeto se chama `controle`, nas branches `main` e `dev` (já criado,
   com owner `controle_owner`). A validação única (decisão 4) recusa URL do Neon com outro banco (`neondb`, o padrão
   do console, inclusive). No local o Docker também cria `controle`; os testes usam os bancos temporários da decisão 6
   e o ensaio local do runbook usou `ensaio_origem`/`ensaio_restaurado` (registro).
8. **Roles padronizadas** `<projeto>_owner`, `<projeto>_app` e `<projeto>_backup_ro`: aqui `controle_owner`,
   `controle_app` e `controle_backup_ro`, criadas por SQL (fora de `neon_superuser`). `controle_app` e
   `controle_backup_ro` são `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`: no local, `init-local.sql` e o teste
   `banco.test.ts` ("app e backup_ro não são SUPERUSER, não têm BYPASSRLS..."); no Neon, o `conferir-banco` (reprova
   qualquer `controle_*` com `rolbypassrls`) e a consulta da evidência T1 da 17b. O `neondb_owner` do console nunca é
   usado pelo app.

## Consequências

- Uma chave a menos no GitHub e nenhum gasto do limite de branches do Neon Free.
- Restaurar fica mais lento que trocar de branch: é sempre decifrar o dump e rodar o `pg_restore` (runbook 4.2).
- O dado escrito entre o dump do deploy e a restauração se perde, como antes.
- As branches `restauracao-*` que os ensaios e o primeiro deploy criaram no Neon precisam ser apagadas à mão no console.
