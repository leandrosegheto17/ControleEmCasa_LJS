# Publicação 17b: infraestrutura de produção — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tarefas com a skill `tlc-spec-driven`: **ative-a pelo nome e siga o fluxo Execute e as Critical Rules dela.** Não procure os arquivos da skill pelo caminho no disco.

**Se a skill não puder ser ativada, PARE e avise o usuário. Não siga sem ela.**

---

**Design**: não há `design.md` próprio. A base é o roteiro `.specs/etapa-17/neon.md`, o `docs/runbook.md` (seções 2, 4, 9 e 10), os ADRs 015 e 016 e o `deploy.yml`/`backup.yml`. A divisão da etapa 17 está no AD-001 (`.specs/STATE.md`).
**Status**: Approved (2026-10-27)

Escopo: criar e configurar, **fora do repositório**, tudo o que o primeiro deploy (17c) precisa: Neon, Hyperdrive, chaves, GitHub, Resend, Sentry, Asaas e domínio. Quase toda tarefa é **Ação do usuário**: Claude guia, confere o resultado e commita o que cabe no repositório.

**Regras desta feature (valem para toda tarefa):**

- Nenhum segredo, senha, chave, token nem URL de conexão passa pela conversa nem entra no repositório. As senhas são geradas pelo usuário (`node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`), guardadas num gerenciador de senhas e coladas direto no painel, no `wrangler secret` ou no GitHub.
- Cada ação externa precisa da **confirmação própria** do usuário, mesmo com a feature aprovada.
- **Evidência** de tarefa de configuração = saída de comando ou resultado de consulta, sem valor secreto, registrada no `.specs/features/publicacao-infra/evidencias.md` (criado pelo Claude, sem segredo). Sem evidência, a tarefa não conta como concluída.
- Banco em **Postgres 18** (ADR-016), região `aws-sa-east-1`. Project ID do Neon: `nameless-grass-28234591`.

---

## Test Coverage Matrix

> Gerada a partir de `.specs/features/publicacao-repositorio/tasks.md` e do `.claude/CLAUDE.md`. Diretrizes: automação feita só por configuração prova o comportamento com casos executados de verdade e evidência registrada.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Configuração externa (Neon, Cloudflare, GitHub, Resend, Sentry, Asaas, domínio) | none (evidência registrada) | Cada tarefa tem uma conferência executada de verdade e o resultado registrado em `evidencias.md` | `.specs/features/publicacao-infra/evidencias.md` | o comando de conferência de cada tarefa |
| Banco de produção | integration (script de operação) | `conferir-banco` sem acusação em `dev` e em `main` | `backend/scripts/src/operacao/conferir-banco.ts` | `pnpm --filter @controle/scripts conferir-banco` |
| Arquivos do repositório (`wrangler.jsonc`, lista de segredos) | unit | Valor real do Hyperdrive no lugar do fictício; lista de segredos igual ao que os workflows leem | `backend/scripts/src/operacao/*.test.ts` | `pnpm --filter @controle/scripts test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tarefa de código/teste de um pacote | `pnpm --filter @controle/scripts test` |
| Full | Tarefa que mexe no banco local | `EXIGIR_BANCO=1 pnpm test` (Docker no ar) |
| Build | Fim de Phase e fim da feature | `pnpm lint && pnpm typecheck && EXIGIR_BANCO=1 pnpm test`, e com tudo commitado `python .claude/scripts/trava-testes.py --rodar` |

---

## Execution Plan

As Phases rodam em sequência e as tarefas de cada Phase rodam em ordem. São 18 tarefas, cerca de 19,5 h de trabalho humano, em 2 lotes (a T17 e a T18 entraram depois do ensaio da T3 falhar). Ações do usuário: T1 a T5, T7 a T11 e T13 a T16. Trabalho do Claude: T6, T12, T17 e T18 (e a conferência de cada tarefa).

### Phase 1: Neon

Banco de produção pronto, migrado e conferido.

```
T1 → T2 → T17 → T3 → T18 → T4
```

### Phase 2: Cloudflare e chaves

Hyperdrive sem cache e as chaves que o app precisa para subir.

```
T5 → T6
T7
T8
```

### Phase 3: GitHub

Environment, segredos, variáveis e a prova de que a lista confere com os workflows.

```
T9 → T10 → T12
T9 → T11
```

### Phase 4: Serviços de terceiros e domínio

Cada um independente dos outros.

```
T13
T14
T15
T16
```

---

## Task Breakdown

### Phase 1: Neon

#### T1: Roles por SQL e conferência dos atributos

**What**: **Ação do usuário.** No SQL Editor do Neon, como `neondb_owner`, criar `controle_owner`, `controle_app` e `controle_backup_ro` por SQL (`LOGIN`, `NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`) e conferir os atributos.
**Estimativa**: 30 min
**Where**: painel do Neon (SQL Editor)
**Depends on**: None
**Reuses**: `.specs/etapa-17/neon.md` passo 2
**Requirement**: RNF-07; ADR-005

**Done when**:

- [x] As 3 roles existem; a consulta de conferência do roteiro devolve `false` em `rolsuper`, `rolbypassrls`, `rolcreaterole` e `rolcreatedb` nas 3 linhas (o usuário cola só os true/false; nenhuma senha)
- [x] Se algum `rolbypassrls` vier `true`, a feature PARA e o usuário avisa
- [x] Evidência registrada em `evidencias.md`

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência das roles do Neon`

---

#### T2: Banco `controle` com dono `controle_owner` e branch `dev`

**What**: **Ação do usuário.** Criar o banco `controle` com dono `controle_owner` e a branch `dev` (filha da `main`) no console do Neon.
**Estimativa**: 30 min
**Where**: painel do Neon
**Depends on**: T1
**Reuses**: `.specs/etapa-17/neon.md` passos 3 e 4
**Requirement**: ADR-016; RNF-09

**Done when**:

- [x] O banco `controle` aparece com dono `controle_owner` nas branches `main` e `dev`
- [x] As strings de conexão **diretas** (host sem `-pooler`, `sslmode=require`) das 3 roles estão guardadas no gerenciador de senhas do usuário (nada na conversa)
- [x] Evidência registrada em `evidencias.md` (nomes de banco e branch, sem URL)

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência do banco e da branch dev`

---

#### T17: Migration base tolerante ao owner do Neon e conferência do `search_path`

**What**: Fazer o `ALTER ROLE ... IN DATABASE ... SET search_path` da migration `20261024120000` tolerar a falta de privilégio (aviso, sem erro) e acrescentar ao `conferir-banco` a checagem de que `controle_app` e `controle_backup_ro` têm `search_path = app` no banco, para a omissão não passar despercebida.
**Estimativa**: 2h
**Where**: `backend/scripts/migracoes/20261024120000_base_schema_roles_extensoes.sql`
**Depends on**: T2
**Reuses**: `backend/scripts/src/operacao/conferir-banco.ts` e seus testes; `.specs/etapa-17/neon.md` passo 5
**Requirement**: RNF-07; ADR-005; GUARDRAILS G-43 (linha no Log: edição de migration ainda não aplicada em produção)

**Done when**:

- [x] Teste de banco novo: a parte do `ALTER ROLE` da migration roda como role SEM `CREATEROLE` (simulando o owner do Neon) e termina sem erro; como superusuário continua definindo o `search_path` (comportamento local e do CI intacto)
- [x] `conferir-banco` reprova quando `controle_app` ou `controle_backup_ro` não tem `search_path = app` no banco, e passa quando tem (testes novos; provados falhando sem a checagem)
- [x] `.specs/etapa-17/neon.md` e `docs/runbook.md` ganham o passo de preparação do `search_path` como `neondb_owner` (e o motivo)
- [x] Linha no Log de Alterações do `.md/GUARDRAILS.md` (aprovada por Leandro em 2026-10-27)
- [x] Nenhum teste existente alterado; `pnpm lint && pnpm typecheck` e gate full verdes

**Tests**: integration
**Gate**: full
**Commit**: `fix(banco): migration base tolera owner sem CREATEROLE e conferir-banco checa o search_path`

---

#### T3: Ensaio de migração na branch `dev`

**What**: **Ação do usuário com conferência do Claude.** Antes, como `neondb_owner` no SQL Editor da branch `dev`, definir o `search_path` das duas roles no banco `controle` (o `controle_owner` não pode: falta `CREATEROLE`); depois rodar `pnpm migrar` com a URL direta do owner da branch `dev` e `conferir-banco` em seguida, para provar que a role dona consegue criar o schema, as extensões e o `search_path` por role no Neon.
**Estimativa**: 1h
**Where**: terminal do usuário, variável `DATABASE_URL_OWNER` só no terminal
**Depends on**: T17
**Reuses**: `backend/scripts/src/operacao/conferir-banco.ts`; `.specs/etapa-17/neon.md` passo 5
**Requirement**: RNF-07; ADR-005

**Done when**:

- [x] Passo de preparação feito como `neondb_owner`: `ALTER ROLE controle_app IN DATABASE controle SET search_path = app;` e o mesmo para `controle_backup_ro`
- [x] `pnpm migrar` aplica todas as migrations; rodar de novo diz "No migrations to run"
- [x] `conferir-banco` sai com código 0 na `dev` (sem `IGNORAR_ROLES`: o owner do Neon é `NOSUPERUSER`)
- [x] Como `controle_app`: sem contexto devolve 0 linhas, e `CREATE TABLE` é negado
- [x] Se algo falhar (extensão, `ALTER ROLE ... IN DATABASE`, schema), o erro vai ao Claude e vira ajuste antes de produção
- [x] Evidência registrada em `evidencias.md`

**Tests**: integration
**Gate**: full
**Commit**: `docs(infra): evidência do ensaio de migração na dev`

---

#### T18: Comando `migrar-neon` que confirma o destino antes de migrar

**What**: Passo `pnpm migrar-neon` que exige `DATABASE_URL_OWNER` no ambiente do terminal (sem cair no `.env`), recusa destino local ou fora do Neon e o host com `-pooler`, imprime usuário, host e banco com a senha mascarada e só migra depois de o usuário digitar o nome do banco para confirmar.
**Estimativa**: 1,5h
**Where**: `backend/scripts/src/operacao/migrar-neon.ts`
**Depends on**: T3
**Reuses**: `backend/scripts/src/operacao/conferir-banco.ts` (padrão de leitura do ambiente e de saída sem segredo); `node-pg-migrate`
**Requirement**: G-43; TM-DB-05; roteiro `.specs/etapa-17/neon.md` passos 5 e 6

**Done when**:

- [x] Teste: sem `DATABASE_URL_OWNER` no ambiente, o comando falha com mensagem clara e NÃO usa o `.env`
- [x] Testes: recusa `localhost`, `127.0.0.1`, `55432`, host que não termine em `.neon.tech` e host com `-pooler`
- [x] Teste: a saída traz usuário, host e banco com a senha mascarada, nunca a URL inteira
- [x] Teste: só prossegue com a confirmação digitada igual ao nome do banco (ou `--sim` explícito para automação); qualquer outra resposta cancela sem migrar
- [x] Script `migrar-neon` no `backend/scripts/package.json` e no `package.json` da raiz; o `migrar` existente não muda
- [x] `docs/runbook.md` e `.specs/etapa-17/neon.md` passam a mandar usar `migrar-neon` para o Neon
- [x] Nenhum teste existente alterado; gate quick verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(operacao): migrar-neon confirma o destino antes de migrar`

---

#### T4: Migrar a `main` do Neon

**What**: **Ação do usuário, com confirmação própria.** Rodar `pnpm migrar-neon` (T18) com a URL direta do owner da `main` e `conferir-banco`.
**Estimativa**: 30 min
**Where**: terminal do usuário
**Depends on**: T18
**Reuses**: `.specs/etapa-17/neon.md` passo 6
**Requirement**: RNF-07; ADR-015

**Done when**:

- [x] Antes de migrar, repetir como `neondb_owner` na branch `main` a preparação do `search_path` (os dois `ALTER ROLE ... IN DATABASE controle SET search_path = app;`)
- [x] Só executada depois de T3 sem erro e com a confirmação do usuário
- [x] `conferir-banco` sai com código 0 na `main`
- [x] Evidência registrada em `evidencias.md`

**Tests**: integration
**Gate**: full
**Commit**: `docs(infra): evidência da migração da main`

---

### Phase 2: Cloudflare e chaves

#### T5: Hyperdrive sem cache

**What**: **Ação do usuário.** Criar o Hyperdrive `controle` com `wrangler hyperdrive create --caching-disabled`, a string direta do `controle_app` passada por variável de ambiente, e guardar o id devolvido.
**Estimativa**: 45 min
**Where**: terminal do usuário
**Depends on**: T4
**Reuses**: `.specs/etapa-17/neon.md` passo 7
**Requirement**: ADR-015; SDD §11

**Done when**:

- [ ] O comando devolve um id; o usuário o passa ao Claude (o id não é segredo)
- [ ] `wrangler hyperdrive get <id>` mostra o cache desligado (confirma o formato do campo, `[A VALIDAR]`)
- [ ] Evidência registrada em `evidencias.md` (sem a string de conexão)

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência do Hyperdrive`

---

#### T6: Id real do Hyperdrive no `wrangler.jsonc`

**What**: Trocar o id fictício `00000000000000000000000000000000` pelo id real do Hyperdrive, com teste que recusa o id fictício.
**Estimativa**: 30 min
**Where**: `wrangler.jsonc`
**Depends on**: T5
**Reuses**: `backend/scripts/src/operacao/wrangler-dominio.test.ts`
**Requirement**: ADR-015

**Done when**:

- [ ] Teste novo falha com o id fictício (`/^0+$/`) e passa com o real; o `localConnectionString` continua local
- [ ] O comentário do `wrangler.jsonc` sobre o id fictício é atualizado
- [ ] Nenhum teste existente alterado
- [ ] Gate quick verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(deploy): id real do Hyperdrive`

---

#### T7: Par `age` do backup

**What**: **Ação do usuário.** Gerar o par `age` do backup, guardar a chave privada offline em dois lugares e informar a chave pública (`AGE_RECIPIENT`).
**Estimativa**: 1h
**Where**: máquina do usuário
**Depends on**: None
**Reuses**: `docs/runbook.md` (chave `age`); ADR-015
**Requirement**: RNF-09

**Done when**:

- [ ] A chave pública `age1...` é passada ao Claude (não é segredo); a privada nunca sai da máquina do usuário
- [ ] A privada está guardada em 2 lugares offline; o usuário confirma
- [ ] Teste de ida e volta: cifrar e decifrar um arquivo de teste com o par, confirmando a decifragem
- [ ] Evidência registrada em `evidencias.md` (só a chave pública)

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência do par age`

---

#### T8: Chaves do app: VAPID, `CHAVE_HMAC` e `VAPID_SUBJECT`

**What**: **Ação do usuário.** Gerar o par VAPID de produção (`pnpm --filter @controle/scripts gerar-vapid`) e a `CHAVE_HMAC`, e gravá-los como secrets do Worker; `VAPID_SUBJECT` com o contato do usuário.
**Estimativa**: 1h
**Where**: terminal do usuário, `wrangler secret`
**Depends on**: None
**Reuses**: `backend/scripts/src/gerar-vapid.ts`; `.env.example`
**Requirement**: RNF-06; ADR-014

**Done when**:

- [ ] `wrangler secret list` mostra `CHAVE_HMAC`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (só os nomes)
- [ ] A chave pública VAPID NÃO é a de teste; a privada nunca aparece na conversa
- [ ] `[A VALIDAR]`: se o Worker ainda não existir, o `wrangler secret put` pede para criá-lo; o resultado é registrado
- [ ] Evidência registrada em `evidencias.md` (só nomes)

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência dos segredos do Worker`

---

### Phase 3: GitHub

#### T9: Environment `producao`

**What**: **Ação do usuário.** Criar o environment `producao` no GitHub, só para a branch `main` e sem revisor (o GitHub Free não aceita revisor em repositório privado; AD-001/ADR-015).
**Estimativa**: 30 min
**Where**: GitHub, Settings, Environments
**Depends on**: None
**Reuses**: `docs/runbook.md` seção 2
**Requirement**: ADR-015; G-42

**Done when**:

- [ ] O environment `producao` existe, restrito à `main`
- [ ] Não existe `producao-aprovacao`
- [ ] Evidência registrada em `evidencias.md` (captura sem segredo ou descrição)

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência do environment producao`

---

#### T10: Secrets e variáveis do GitHub

**What**: **Ação do usuário.** Gravar no environment `producao` os secrets `DATABASE_URL_OWNER` e `DATABASE_URL_BACKUP`, e as variáveis `NEON_PROJECT_ID`, `CLOUDFLARE_ACCOUNT_ID` e `AGE_RECIPIENT` (ficam FORA os secrets `NEON_API_KEY` e `CLOUDFLARE_API_TOKEN`, da T11, e as flags `DEPLOY_ATIVO`, `BACKUP_ATIVO` e `PURGA_ATIVA`, da 17c).
**Estimativa**: 1,5h
**Where**: GitHub, environment `producao`
**Depends on**: T9, T7, T4
**Reuses**: `.github/workflows/deploy.yml`, `.github/workflows/backup.yml`
**Requirement**: ADR-015; G-32

**Done when**:

- [ ] `gh secret list --env producao` e `gh variable list --env producao` mostram os nomes esperados (só nomes e datas)
- [ ] `DATABASE_URL_OWNER` usa o host direto; `DATABASE_URL_BACKUP` usa a role `controle_backup_ro`
- [ ] Evidência registrada em `evidencias.md` (só nomes)

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência dos secrets e variáveis`

---

#### T11: Tokens de menor escopo (Cloudflare e Neon)

**What**: **Ação do usuário.** Criar o `CLOUDFLARE_API_TOKEN` (comece com Workers Scripts Edit, Hyperdrive Edit, Workers Routes Edit e Zone Read) e a `NEON_API_KEY` escopada ao projeto, e gravá-los como secrets do environment `producao`; registrar o escopo mínimo que realmente funcionou.
**Estimativa**: 1,5h
**Where**: painéis da Cloudflare, do Neon e do GitHub
**Depends on**: T9
**Reuses**: `docs/runbook.md` seção 8 (rotação) e a linha `[A VALIDAR]` do escopo
**Requirement**: ADR-015; G-32

**Done when**:

- [ ] Os dois secrets existem no environment `producao` (só nomes)
- [ ] `[A VALIDAR]` resolvido: o escopo da chave do Neon cobre criar, apagar e restaurar branches (verificado pelo script `restauracao-neon` com a chave); o escopo mínimo do token da Cloudflare fica anotado
- [ ] Evidência registrada em `evidencias.md`

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência dos tokens e escopos`

---

#### T12: Teste de consistência da lista de segredos

**What**: Teste que extrai de `deploy.yml`, `backup.yml` e `purga.yml` todo `secrets.*` e `vars.*`, e compara com a lista documentada no runbook, para a configuração do GitHub não divergir do que os workflows leem.
**Estimativa**: 1,5h
**Where**: `backend/scripts/src/operacao/segredos-workflows.test.ts`
**Depends on**: T10
**Reuses**: `backend/scripts/src/deploy-workflow.test.ts` (leitura de YAML)
**Requirement**: ADR-015; G-32

**Done when**:

- [ ] Teste novo falha quando um workflow passa a ler um secret ou variável fora da lista documentada, e quando o runbook cita um que nenhum workflow lê (provado na cópia)
- [ ] Nenhum teste existente alterado
- [ ] Gate quick verde

**Tests**: unit
**Gate**: quick
**Commit**: `test(operacao): lista de segredos bate com os workflows`

---

### Phase 4: Serviços de terceiros e domínio

#### T13: Resend: domínio verificado, `MAIL_FROM` e chave

**What**: **Ação do usuário.** No Resend, verificar o domínio `ljssoftware.com.br` (SPF e DKIM), criar a `RESEND_API_KEY` com permissão de envio, e gravá-la como secret do Worker.
**Estimativa**: 1,5h
**Where**: painel do Resend, DNS da zona, `wrangler secret`
**Depends on**: None
**Reuses**: `wrangler.jsonc` (`MAIL_FROM`)
**Requirement**: RNF-15

**Done when**:

- [ ] O domínio aparece como verificado no Resend
- [ ] `wrangler secret list` mostra `RESEND_API_KEY` (só o nome)
- [ ] Um e-mail de teste do Resend chega na caixa do usuário com o remetente "Controle em Casa" (sem dado financeiro)
- [ ] Evidência registrada em `evidencias.md`

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência do Resend`

---

#### T14: Sentry: projetos e DSN

**What**: **Ação do usuário.** Criar os projetos do Sentry para o Worker e para o front, gravar `SENTRY_DSN` como secret do Worker e `VITE_SENTRY_DSN` como variável do environment `producao`.
**Estimativa**: 1h
**Where**: painel do Sentry, `wrangler secret`, GitHub
**Depends on**: T9
**Reuses**: `backend/contrato/src/observabilidade.ts`; `frontend/web/scripts/gerar-headers.mjs`
**Requirement**: RNF-08

**Done when**:

- [ ] `wrangler secret list` mostra `SENTRY_DSN` e `gh variable list --env producao` mostra `VITE_SENTRY_DSN` (só nomes)
- [ ] O host do DSN passa na validação do `gerar-headers.mjs` (build local com o DSN mostra o host no `connect-src`)
- [ ] Evidência registrada em `evidencias.md` (host, sem a chave do DSN)

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência do Sentry`

---

#### T15: Asaas de produção

**What**: **Ação do usuário.** Abrir a conta de produção do Asaas, gerar a chave da API e o token do webhook, e gravar `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` como secrets do Worker; a URL do webhook fica para a 17c, depois do deploy.
**Estimativa**: 2h
**Where**: painel do Asaas, `wrangler secret`
**Depends on**: None
**Reuses**: `.specs/etapa-13/pesquisa-asaas.md`; ADR-012
**Requirement**: RN-26; ADR-012

**Done when**:

- [ ] A conta de produção está aprovada (o Asaas pode demorar; se demorar, a tarefa fica pendente sem bloquear a 17c até o fim da 17d)
- [ ] `wrangler secret list` mostra `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` (só nomes)
- [ ] Evidência registrada em `evidencias.md`

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência do Asaas de produção`

---

#### T16: Domínio `controleemcasa.ljssoftware.com.br`

**What**: **Ação do usuário.** Confirmar que a zona `ljssoftware.com.br` está ativa na Cloudflare e preparar o domínio custom do Worker (a rota já está no `wrangler.jsonc`); o certificado é emitido pela Cloudflare no primeiro deploy.
**Estimativa**: 1h
**Where**: painel da Cloudflare
**Depends on**: None
**Reuses**: `wrangler.jsonc` (`routes`)
**Requirement**: PLANO etapa 17 (domínio)

**Done when**:

- [ ] A zona aparece como ativa na mesma conta Cloudflare do token da T11
- [ ] Nenhum registro DNS manual conflita com `controleemcasa` (consulta DNS sem registro prévio)
- [ ] Evidência registrada em `evidencias.md`

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(infra): evidência da zona e do domínio`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 ------→ T2 ------→ T17 -----→ T3 ------→ T18 -----→ T4
Phase 2:  T5 ------→ T6
          T7
          T8
Phase 3:  T9 ------→ T10 -----→ T12
          T9 ------→ T11
Phase 4:  T13
          T14
          T15
          T16
```

Lote 1 (T1 a T8): Neon, Hyperdrive e chaves do app. Lote 2 (T9 a T16): GitHub, segredos, terceiros e domínio. Ao fim, verificação pelo agente `verificador` do que é código (T6, T12) e conferência das evidências das demais, e a aprovação seguir / ajustar / parar.
