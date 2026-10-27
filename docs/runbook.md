# Runbook de operação — Controle em Casa

- **Última verificação:** 2026-10-27 (etapa 16, lote 2). Produção ainda não existe: o que depende do Neon, da Cloudflare
  ou do GitHub de verdade está marcado `[A VALIDAR NA ETAPA 17]`.
- **Base:** ADR 015 (deploy e backup), ADR 013 (exclusão e purga), SDD §11, GUARDRAILS G-02, G-09, G-42 a G-45,
  THREAT-MODEL TM-GH-01 a TM-GH-06 e TM-OBS-01.
- **Regra:** nenhum segredo neste arquivo. Os nomes dos segredos e das variáveis estão no `.env.example`.

## 1. Mapa

| Peça                   | Onde                                                                                     | Observação                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| App (front + API)      | Worker `controle-em-casa` na Cloudflare                                                  | `https://controleemcasa.ljssoftware.com.br`; saúde em `/api/health`     |
| Banco                  | Neon, projeto em `sa-east-1`, Postgres 17, branch `main`                                 | Acesso do Worker pelo Hyperdrive (cache desligado), role `controle_app` |
| Roles                  | `controle_owner` (migrations e purga), `controle_app` (API), `controle_backup_ro` (dump) | Criadas à mão no Neon `[A VALIDAR NA ETAPA 17]`                         |
| Deploy                 | `.github/workflows/deploy.yml`                                                           | Único lugar que publica o Worker (G-42)                                 |
| Backup                 | `.github/workflows/backup.yml`                                                           | Diário, 04:00 de Brasília, artefato `.dump.age` por 30 dias             |
| Purga                  | `.github/workflows/purga.yml`                                                            | Diária (ADR 013)                                                        |
| Erros                  | Sentry: projetos do Worker e do front                                                    | Release = SHA do commit; sem DSN, desligado                             |
| Environments do GitHub | `producao-aprovacao` (revisor, sem segredo) e `producao` (segredos, só da `main`)        |                                                                         |

## 2. Deploy

1. Abra o PR, espere o `ci` verde e faça o merge na `main`. O hook local bloqueia o push sem a suíte verde
   (`python .claude/scripts/trava-testes.py --rodar`).
2. O `ci` roda de novo no push à `main`. Verde, o `deploy` começa e para no job `aprovar`, esperando o revisor do
   environment `producao-aprovacao` (Actions → deploy → Review deployments).
3. Aprovado, o job `publicar` segue a ordem fixa, e qualquer passo que falha para tudo:
   build do front (com `VITE_SENTRY_DSN` e `VITE_SENTRY_RELEASE`) → cache do Hyperdrive desligado → branch
   `restauracao-<run>-<tentativa>` no Neon (ficam as 2 mais novas) → dump cifrado `dump-predeploy-<run>-<tentativa>`
   → migração com a role owner → publicação com `SENTRY_RELEASE` = SHA → `GET /api/health`.
4. Depois do deploy, confira:
   - `curl -fsS https://controleemcasa.ljssoftware.com.br/api/health` responde `{"ok":true}`;
   - no Sentry, o release novo (o SHA) aparece sem erro novo;
   - entrar no app e abrir o Início.
5. Para publicar de novo o mesmo commit: "Re-run" no workflow `deploy` (não existe disparo manual).

Migrations são **aditivas** (G-43). O passo "Migrations aditivas (G-43)" do CI recusa `drop`, `rename`, troca de tipo,
`NOT NULL` sem `default` em tabela existente, `SET NOT NULL` e `truncate`. A exceção é a anotação
`-- migracao-nao-aditiva: expand=<arquivo>.sql | <justificativa>` (a fase expand já tem de estar na `main`) ou
`-- migracao-nao-aditiva: log | <justificativa>` com uma linha aprovada e com validade no Log de Alterações do
`.md/GUARDRAILS.md`.

## 3. Rollback

### 3.1 Só o Worker (código com defeito, banco bom)

As migrations são aditivas, então o Worker anterior continua funcionando com o banco migrado.

- **Automático:** se a saúde falhar depois da publicação, o próprio `deploy.yml` faz `wrangler rollback` e marca o run
  com erro, apontando a branch e o artefato da restauração.
- **Manual (painel):** Cloudflare → Workers → `controle-em-casa` → Deployments → escolher a versão anterior → Rollback.
- **Manual (terminal):** com `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no ambiente (nunca no histórico do shell):

  ```bash
  pnpm --filter @controle/api exec wrangler rollback -c ../../wrangler.jsonc --message "motivo do rollback"
  ```

  `[A VALIDAR NA ETAPA 17]`: o modo não interativo do `wrangler rollback` (ADR 015).

- Depois do rollback, o defeito vira correção pelo fluxo normal (PR, CI, deploy). Não publique fora do `deploy.yml`.

### 3.2 Banco (dado perdido ou migração errada)

Pare as escritas antes de restaurar: faça o rollback do Worker (3.1) ou, se o dano continuar, coloque o app fora do ar
pelo painel da Cloudflare. Depois escolha:

1. **Branch de restauração do Neon** (seção 4.1): a cópia exata do banco no instante anterior à migração do último
   deploy. É a mais rápida.
2. **Dump cifrado** (seção 4.2): independe do Neon. Use quando a branch não servir (dano antigo, branch podada, Neon
   indisponível).

O dado escrito entre o instante da cópia e a restauração se perde. Registre o intervalo no incidente (seção 8).

## 4. Restauração

### 4.1 Pela branch de restauração do Neon

O deploy cria `restauracao-<run>-<tentativa>` a partir da `main` antes de migrar e mantém as 2 mais novas. O nome do
run está na anotação de erro do deploy e na lista de branches do Neon.

Caminhos documentados pelo Neon (consulta em 2026-10-27, `neon.com/docs/guides/branch-restore`):

- **Restaurar a `main` a partir de outra branch** (console: Branches → `main` → Restore; CLI:
  `neon branches restore main <branch de origem>`; API: `POST /projects/{id}/branches/{main}/restore` com
  `source_branch_id`). O Neon guarda o estado anterior numa branch de backup criada na hora.
- **Restaurar a `main` a um instante do próprio histórico** (PITR): `neon branches restore main ^self@<RFC 3339>
--preserve-under-name main_antes_restauracao`, dentro da janela de histórico do plano.

`[A VALIDAR NA ETAPA 17]`:

- se a `main` (raiz) pode ser restaurada a partir da `restauracao-*`, que é filha dela, ou se o caminho certo é o PITR
  da `main` até o instante da criação da branch;
- a janela de histórico do plano Free;
- se a branch de backup criada pela restauração conta no limite de branches e se pode ser apagada.

Depois de restaurar: o Hyperdrive aponta para a `main`, então não muda. Rode a conferência da seção 4.3.

### 4.2 Pelo dump cifrado (`age`)

1. **Escolha o artefato.** Backup diário: `backup-<AAAA-MM-DD>-<run>-<tentativa>`; antes de um deploy:
   `dump-predeploy-<run>-<tentativa>`. Baixe com o GitHub CLI (ou pela página do run):

   ```bash
   gh run list --workflow backup.yml --limit 10
   gh run download <run-id> --dir restauracao
   ```

2. **Decifre num computador confiável**, com a chave privada `age` tirada da guarda offline (seção 6). O dump em claro
   tem dados pessoais: apague-o no fim.

   ```bash
   age -d -i <arquivo da chave privada> -o restauracao/banco.dump restauracao/<nome>/<nome>.dump.age
   ```

3. **Crie um banco vazio** para receber o dump: uma branch nova no Neon (ex.: `restaurada-<data>`) ou outro banco. Não
   restaure por cima da `main` em uso.
4. **Restaure com a role owner**, com o cliente do Postgres 17 (a mesma versão maior do servidor):

   ```bash
   pg_restore --exit-on-error --no-owner --role=controle_owner -d "<URL owner do banco novo>" restauracao/banco.dump
   ```

5. **Refaça as configurações por banco das roles.** O `pg_dump` não leva `ALTER ROLE ... IN DATABASE` (são objetos
   globais). Sem isto, a `controle_app` perde o `search_path` (o ensaio de 2026-10-27 mostrou `"$user", public` no banco
   restaurado):

   ```sql
   alter role controle_app in database <banco> set search_path = app;
   alter role controle_backup_ro in database <banco> set search_path = app;
   ```

6. **Confira** (seção 4.3). Só depois troque o app para o banco restaurado: restaure a `main` a partir da branch
   restaurada (4.1) ou aponte o Hyperdrive para ela `[A VALIDAR NA ETAPA 17]`.
7. Apague o `banco.dump` em claro e devolva a chave privada à guarda.

`[A VALIDAR NA ETAPA 17]`: no Neon a role owner não é superusuário. O ensaio local restaurou como superusuário (o
`controle_owner` do Docker é o `POSTGRES_USER`), que ignora a RLS. Com `FORCE ROW LEVEL SECURITY`, o `COPY` dos dados
pode ser recusado para quem não é superusuário: confirmar no primeiro ensaio em produção e, se falhar, registrar aqui o
procedimento que funcionou.

### 4.3 Conferência depois de restaurar

Rode no banco restaurado e compare com o esperado (ou com a origem, se ela ainda existir):

```sql
-- linhas por tabela (como controle_backup_ro, que lê tudo pela política backup_leitura)
select table_schema || '.' || table_name as tabela,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name),
    false, true, '')))[1]::text::int as linhas
from information_schema.tables
where table_schema in ('app', 'public') and table_type = 'BASE TABLE'
order by 1;

-- RLS: todas as tabelas de negócio com ENABLE e FORCE, e as políticas
select count(*) filter (where relforcerowsecurity) as com_force, count(*) as tabelas
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'app' and relkind = 'r';
select count(*) as politicas from pg_policies where schemaname = 'app';

-- migrations conhecidas (o pgmigrations vem no dump)
select count(*), max(name) from public.pgmigrations;
```

Depois, como `controle_app` **sem** contexto, `select count(*) from app.lancamento` tem de dar 0 (a RLS está valendo), e
`pnpm migrar` contra o banco restaurado responde "No migrations to run". Por fim, entre no app com uma conta conhecida.

## 5. Conferência do último backup (toda semana e depois de cada incidente)

1. `gh run list --workflow backup.yml --limit 7`: o último run verde tem de ter menos de 26 horas.
2. Abra o run e confira o artefato `backup-<data>-...` com tamanho coerente (não perto de zero).
3. Se não houver run recente:
   - o workflow pode estar desligado: `gh workflow list --all` e, se preciso, `gh workflow enable backup.yml`;
   - a variável `BACKUP_ATIVO` tem de ser `true`;
   - o Actions pode estar parado por cobrança da conta (aconteceu nas etapas 6 a 16: o CI não iniciava);
   - rode à mão: `gh workflow run backup.yml` e acompanhe.
4. A documentação do GitHub (consulta em 2026-10-27) diz que agendas são desligadas sozinhas depois de 60 dias sem
   atividade **em repositório público**. O repositório é privado, mas a conferência continua obrigatória: a agenda
   também para por cobrança, por desligamento manual ou por falha repetida, e o UptimeRobot não vê nada disso.
5. Uma vez por trimestre, faça o ensaio da seção 9 com o artefato mais recente.

## 6. Chave `age` do backup

- O par é gerado **offline** (`age-keygen -o chave.txt`). A linha `public key: age1...` vai para a variável
  `AGE_RECIPIENT` do environment `producao`. A chave privada (`AGE-SECRET-KEY-...`) **nunca** entra no GitHub, no
  repositório nem em gerenciador na nuvem sem cifra.
- Guarde a privada em **2 lugares offline** diferentes (ex.: pendrive cifrado e cópia impressa num cofre)
  `[A VALIDAR NA ETAPA 17]` (onde ficam, de fato).
- Perder a chave privada torna todos os backups inúteis (TM-GH-06). Por isso o ensaio periódico decifra um backup real.
- Troca da chave: gere o par novo, troque `AGE_RECIPIENT`, guarde a privada nova nos 2 lugares e mantenha a antiga até o
  último artefato cifrado com ela expirar (30 dias).

## 7. Rotação de segredos

Troque um segredo quando ele vazar, quando alguém com acesso sair, ou uma vez por ano. Nunca cole segredo em conversa,
issue, PR ou log.

| Segredo                                     | Onde fica                                   | Como trocar                                                                          | Efeito da troca                                                                                         |
| ------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `CHAVE_HMAC`                                | Worker (`wrangler secret put CHAVE_HMAC`)   | Gere 32 bytes base64url e grave                                                      | Zera a contagem de tentativas de login e de exclusão (os hashes antigos de e-mail e IP deixam de casar) |
| `RESEND_API_KEY`                            | Worker                                      | Crie a chave nova no Resend (só envio, restrita ao domínio), grave, revogue a antiga | Nenhum                                                                                                  |
| `ASAAS_API_KEY`                             | Worker e environment `producao` (purga)     | Gere no Asaas (sem transferência por API), grave nos dois, revogue a antiga          | Nenhum                                                                                                  |
| `ASAAS_WEBHOOK_TOKEN`                       | Worker                                      | Grave o novo no Worker e, logo depois, no webhook do Asaas                           | Eventos entre os dois passos são recusados e o Asaas reenvia                                            |
| `VAPID_PRIVATE_KEY` / `VAPID_PUBLIC_KEY`    | Worker                                      | `pnpm --filter @controle/scripts gerar-vapid` e grave o par                          | Todas as inscrições de push deixam de valer: cada aparelho precisa ativar de novo                       |
| `SENTRY_DSN` / `VITE_SENTRY_DSN`            | Worker / variável do environment `producao` | Gere a chave nova no projeto do Sentry, grave, revogue a antiga                      | O front só passa a usar o DSN novo no próximo deploy                                                    |
| `DATABASE_URL_OWNER`, `DATABASE_URL_BACKUP` | Environment `producao`                      | Troque a senha da role no Neon e grave a URL nova                                    | Nenhum para o app                                                                                       |
| Senha da `controle_app`                     | Neon e Hyperdrive                           | Troque no Neon e atualize o Hyperdrive na mesma janela                               | Requisições falham entre os dois passos                                                                 |
| `NEON_API_KEY`, `CLOUDFLARE_API_TOKEN`      | Environment `producao`                      | Gere a nova com o menor escopo, grave, revogue a antiga                              | Nenhum                                                                                                  |
| Chave `age`                                 | Offline (seção 6)                           | Seção 6                                                                              | Nenhum                                                                                                  |

`[A VALIDAR NA ETAPA 17]`: os escopos mínimos do `CLOUDFLARE_API_TOKEN` e da `NEON_API_KEY` usados de fato.

## 8. Incidentes

1. **Detectar e registrar:** abra `.specs/incidentes/<AAAA-MM-DD>-<slug>/incidente.md` (fluxo de incidente). Evidência
   com dado pessoal fica fora do repositório.
2. **Primeiros minutos:**
   - `GET /api/health` e o painel da Cloudflare (logs do Worker; `observability` ligado);
   - Sentry: erros novos e em qual release (SHA);
   - Neon: status e métricas da `main`;
   - último deploy e último backup (seção 5).
3. **Conter:** rollback do Worker (3.1); se houver dano no banco, pare as escritas e restaure (seção 4); se for
   segredo vazado, rotação (seção 7); se for abuso, os limites de taxa ficam no `wrangler.jsonc`.
4. **Dados pessoais:** vazamento ou acesso indevido a dado pessoal pode exigir comunicação à ANPD e aos titulares
   (LGPD art. 48). Registre o que vazou, de quem e desde quando, sem copiar o dado.
   `[A PREENCHER]`: encarregado de dados e contato (os mesmos marcadores pendentes da etapa 14).
5. **Depois:** causa raiz, correção com teste que reproduz, post-mortem e atualização deste runbook.

## 9. Ensaio de restauração

Objetivo: provar que um backup cifrado vira um banco que funciona, com as mesmas linhas, a mesma RLS e as mesmas
migrations, e manter o procedimento das seções 4.2 e 4.3 correto.

### 9.1 Resultado registrado — 2026-10-27 (local, Postgres 17 do Docker)

- **Quando:** 2026-10-27, das 10:01 às 10:04 (horário de Brasília).
- **Onde:** máquina de desenvolvimento, Postgres 17.11 do `docker compose` (porta 55432), `age` 1.3.2.
- **Origem:** banco novo `ensaio_origem` com as 12 migrations, o seed (4 usuários) e a massa de 2 anos
  (`massa-dois-anos.ts`: 1 lar, 4.758 lançamentos, 5.718 parcelas, 102 fixas pagas).
- **Comandos executados** (URLs locais com as senhas fixas do Docker; a chave foi gerada só para o ensaio e apagada):

  ```bash
  age-keygen -o ensaio.key
  # origem (psql e pg_restore rodaram dentro do container: docker exec controleemcasa_ljs-banco-1 ...)
  psql -U controle_owner -d controle -c "create database ensaio_origem"
  export DATABASE_URL_OWNER=postgres://controle_owner:...@127.0.0.1:55432/ensaio_origem
  node backend/scripts/node_modules/node-pg-migrate/bin/node-pg-migrate.js up -m backend/scripts/migracoes \
    --database-url-var DATABASE_URL_OWNER --no-single-transaction
  cd backend/scripts && npx tsx src/seed.ts && npx tsx src/massa-dois-anos.ts && cd ../..
  # contagens da origem como controle_backup_ro (consulta da seção 4.3)
  # dump cifrado com o MESMO script do backup.yml (Postgres 17 por digest + age), como controle_backup_ro
  URL_BANCO=postgres://controle_backup_ro:...@host.docker.internal:55432/ensaio_origem AGE_RECIPIENT=age1... \
    SAIDA=ensaio.dump.age pnpm --filter @controle/scripts dump-cifrado
  # restauração
  age -d -i ensaio.key -o ensaio.dump ensaio.dump.age
  psql -U controle_owner -d controle -c "create database ensaio_restaurado"
  pg_restore -U controle_owner -d ensaio_restaurado --exit-on-error --no-owner --role=controle_owner ensaio.dump
  # conferência: consultas da seção 4.3 nos dois bancos, diff das contagens, RLS como controle_app,
  # node-pg-migrate up no restaurado e login pelo wrangler dev apontado para ele
  ```

- **Resultado:**

  | Conferência                                           | Origem                                                                        | Restaurado                                                                                    |
  | ----------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
  | Dump cifrado                                          | 779.381 bytes, cabeçalho `age-encryption.org/v1`, 3,4 s                       | —                                                                                             |
  | `pg_restore`                                          | —                                                                             | código 0, 1,5 s                                                                               |
  | Tabelas (`app` + `public.pgmigrations`)               | 27                                                                            | 27, **contagens idênticas** (diff vazio)                                                      |
  | Linhas principais                                     | lançamento 4.758, parcela 5.718, ocorrência fixa 102, usuário 6, categoria 20 | iguais                                                                                        |
  | Tabelas de `app` com RLS ENABLE e FORCE               | 20 de 26                                                                      | 20 de 26                                                                                      |
  | Políticas em `app`                                    | 127                                                                           | 127                                                                                           |
  | `public.pgmigrations`                                 | 12, última `20261031120000_backup_ro_dump_completo`                           | igual; `pnpm migrar` respondeu "No migrations to run"                                         |
  | `controle_app` sem contexto, `count(*)` em lançamento | 0                                                                             | 0                                                                                             |
  | `controle_app` com o contexto do titular              | 3.540 (as individuais do outro membro ficam ocultas)                          | 3.540; de outro lar: 0                                                                        |
  | Senha do seed confere (`crypt`)                       | —                                                                             | sim                                                                                           |
  | `search_path` da `controle_app`                       | `app`                                                                         | **`"$user", public`** até refazer o `ALTER ROLE ... IN DATABASE` (4.2, passo 5); depois `app` |
  | App contra o banco restaurado (`wrangler dev`)        | —                                                                             | `POST /api/sessao/entrar` 204 e `GET /api/sessao` 200                                         |

- **Achados:** (1) o `pg_dump` não leva as configurações por banco das roles: sem o passo 5 da seção 4.2 a
  `controle_app` perde o `search_path` (procedimento corrigido acima); (2) o ensaio restaurou como superusuário, o que
  não prova a restauração com a role owner do Neon (ver 4.2).
- **Limpeza:** os dois bancos foram apagados (`drop database ... with (force)`), o dump em claro, o cifrado e a chave
  foram apagados.

### 9.2 Pendente para a etapa 17 `[A VALIDAR NA ETAPA 17]`

- Repetir o ensaio com o **primeiro backup real** (artefato do `backup.yml` baixado do GitHub), decifrado com a chave
  privada da guarda offline, restaurado numa branch nova do Neon com a role owner do Neon, e registrar aqui data,
  comandos e resultado.
- Restaurar a partir de uma `restauracao-*` criada por um deploy real (seção 4.1) e registrar o caminho que funcionou.
- Medir o tempo total (do alerta ao app de volta) para ter a referência de RTO, e o intervalo de dados perdidos (RPO:
  até 24 h pelo backup diário; o instante do deploy pela branch).
