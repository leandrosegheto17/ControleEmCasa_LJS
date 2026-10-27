# Publicação 17a: repositório pronto para produção — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tarefas com a skill `tlc-spec-driven`: **ative-a pelo nome e siga o fluxo Execute e as Critical Rules dela.** Não procure os arquivos da skill pelo caminho no disco.

**Se a skill não puder ser ativada, PARE e avise o usuário. Não siga sem ela.**

---

**Design**: não há `design.md` próprio. A base é a etapa 17 do `.md/PLANO.md`, o roteiro `.specs/etapa-17/neon.md`, o `docs/runbook.md` e os ADRs 015 e 016. A divisão da etapa 17 em 17a a 17d está registrada no AD-001 (`.specs/STATE.md`).
**Status**: Approved (2026-10-27)

Escopo: só o que dá para fazer **no repositório, antes de existir produção**, e que as features 17b (infra), 17c (primeiro deploy e medições) e 17d (abertura ao público) vão usar. Nenhuma tarefa aqui toca em conta externa, segredo ou produção.

---

## Test Coverage Matrix

> Gerada a partir do código (amostra: `backend/scripts/src/operacao/*.test.ts`, `backend/api/src/saude-e-cabecalhos.test.ts`, `backend/scripts/src/operacao/wrangler-deploy-unico.test.ts`) e do `.claude/CLAUDE.md` (testes inegociáveis). Diretrizes: `.claude/CLAUDE.md`, `.md/GUARDRAILS.md`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Configuração do Worker (`wrangler.jsonc`) | unit | Toda chave nova afirmada; nenhum segredo no arquivo | `backend/scripts/src/operacao/*.test.ts` | `pnpm --filter @controle/scripts test` |
| Middleware da API (cabeçalhos) | unit (workerd) | Caminho feliz, sem DSN, DSN inválido | `backend/api/src/*.test.ts` | `pnpm --filter @controle/api test` |
| Scripts de operação | unit + integration (Postgres 18 local) | Funções puras 1:1 com os critérios; erro claro em cada falha; banco real quando o script consulta o banco | `backend/scripts/src/operacao/*.test.ts` | `EXIGIR_BANCO=1 pnpm --filter @controle/scripts test` |
| Workflow do GitHub (`deploy.yml`) | unit (leitura do YAML) | Ordem dos passos e conteúdo de cada passo novo | `backend/scripts/src/deploy-workflow.test.ts` | `pnpm --filter @controle/scripts test` |
| Documentação (`docs/runbook.md`) | none | Só o gate de build (Prettier) | - | `pnpm lint` |

## Gate Check Commands

> Gerados a partir de `package.json`, `.specs/projeto/testes.json` e `.github/workflows/ci.yml`.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tarefa com teste unitário só de um pacote | `pnpm --filter <pacote> test` |
| Full | Tarefa que consulta o banco ou mexe na API | `EXIGIR_BANCO=1 pnpm test` (Docker no ar: `docker compose up -d`) |
| Build | Fim de Phase, documentação e fim da feature | `pnpm lint && pnpm typecheck && EXIGIR_BANCO=1 pnpm test`, e com tudo commitado `python .claude/scripts/trava-testes.py --rodar` |

---

## Execution Plan

As Phases rodam em sequência e as tarefas de cada Phase rodam em ordem. São 7 tarefas, 1 lote, cerca de 11 h de trabalho humano.

### Phase 1: Configuração do Worker

O que o primeiro deploy precisa encontrar pronto no `wrangler.jsonc` e nos cabeçalhos.

```
T1
T2
```

### Phase 2: Scripts de conferência e medição

Ferramentas que a 17b (conferir o banco) e a 17c (medir) vão rodar contra produção.

```
T3
T5
T6
```

### Phase 3: Deploy e runbook

Fumaça do deploy mais completa e o roteiro de ativação que junta tudo.

```
T4 → T7
```

---

## Task Breakdown

### Phase 1: Configuração do Worker

#### T1: Domínio custom do Worker no `wrangler.jsonc`

**What**: Declarar `routes` com `{ "pattern": "controleemcasa.ljssoftware.com.br", "custom_domain": true }` no `wrangler.jsonc`, com teste que lê o arquivo.
**Estimativa**: 1h
**Where**: `wrangler.jsonc`
**Depends on**: None
**Reuses**: leitura do `wrangler.jsonc` de `backend/scripts/src/operacao/wrangler-deploy-unico.test.ts`
**Requirement**: PLANO etapa 17 (domínio); ADR-015

**Done when**:

- [x] Teste novo falha antes da mudança e passa depois: exatamente uma rota, `custom_domain: true`, host `controleemcasa.ljssoftware.com.br`, nenhuma rota com `*`
- [x] O `URL_PUBLICA` injetado no `deploy.yml` bate com o host da rota (asserção no mesmo teste)
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(deploy): domínio custom do Worker`

---

#### T2: Host do Sentry na CSP, derivado do `SENTRY_DSN`

**What**: Acrescentar ao `connect-src` da CSP o host de ingestão tirado do `SENTRY_DSN` do Worker (só o host exato; sem DSN, nada muda), com a linha de exceção no Log do GUARDRAILS (decisão do usuário de 2026-10-27).
**Estimativa**: 2h
**Where**: `backend/api/src/middleware/cabecalhos.ts`
**Depends on**: None
**Reuses**: `backend/api/src/saude-e-cabecalhos.test.ts`; limpeza de `backend/contrato/src/observabilidade.ts`
**Requirement**: RNF-06, RNF-08; GUARDRAILS (exceção de host na CSP)

**Done when**:

- [x] Testes novos: com DSN válido o `connect-src` ganha `https://<host do DSN>` e nada mais; sem DSN fica só `'self'`; DSN malformado não muda a CSP nem derruba a resposta
- [x] Nenhum teste existente de cabeçalhos alterado
- [x] Linha no Log de Alterações do `.md/GUARDRAILS.md`
- [x] Gate full verde

**Tests**: unit
**Gate**: full
**Commit**: `feat(api): CSP libera só o host de ingestão do Sentry`

---

### Phase 2: Scripts de conferência e medição

#### T3: Script `conferir-banco` para o banco de produção

**What**: Script que, com a URL do owner, falha se alguma role `controle_*` tiver `rolsuper`, `rolbypassrls`, `rolcreaterole` ou `rolcreatedb`, se faltar RLS ligada e forçada em alguma tabela de `app` com política, ou se houver migration pendente; imprime só contagens, nunca a URL.
**Estimativa**: 2h
**Where**: `backend/scripts/src/operacao/conferir-banco.ts`
**Depends on**: None
**Reuses**: `backend/scripts/src/banco.test.ts` (consultas de catálogo); padrão de `cache-hyperdrive.ts`
**Requirement**: RNF-07; ADR-005; roteiro `.specs/etapa-17/neon.md` passos 2 e 5

**Done when**:

- [x] Teste de integração no Postgres 18 local: passa no banco migrado; falha com mensagem clara quando uma role ganha `BYPASSRLS` e quando uma tabela perde o `FORCE`
- [x] Teste de que a saída nunca contém a URL nem a senha
- [x] Script `conferir-banco` no `backend/scripts/package.json`
- [x] Gate full verde

**Tests**: integration
**Gate**: full
**Commit**: `feat(operacao): conferir roles e RLS do banco de produção`

---

#### T5: Script `medir-cpu-publicado`

**What**: Script que consulta as métricas do Worker publicado na API de análise da Cloudflare (CPU por requisição, p50 e p99, por janela) e diz se passa do teto de 10 ms; a consulta e o nome do conjunto de dados são conferidos na documentação na hora de implementar.
**Estimativa**: 2h
**Where**: `backend/scripts/src/operacao/medir-cpu-publicado.ts`
**Depends on**: None
**Reuses**: `backend/scripts/src/medir-cpu.ts` (formato do relatório); padrão de chamada à API de `cache-hyperdrive.ts`
**Requirement**: RNF-04; SDD §10 (medição publicada, pendente desde a etapa 9)

**Done when**:

- [x] Testes do parser da resposta (feliz, sem dados na janela, resposta de erro da API) e da regra do teto
- [x] Token e conta só por variável de ambiente; o token não aparece em nenhuma saída (teste)
- [x] Consulta à API simulada no teste; a consulta real fica para a 17c
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(operacao): medir a CPU do Worker publicado`

---

#### T6: Script `medir-retomada-a-frio`

**What**: Script que mede a primeira requisição que toca o banco depois de um tempo parado (Neon suspenso) contra as seguintes, e registra a diferença; `/api/health` não serve, porque não toca o banco.
**Estimativa**: 1,5h
**Where**: `backend/scripts/src/operacao/medir-retomada-a-frio.ts`
**Depends on**: None
**Reuses**: `backend/scripts/src/medir-cpu.ts`
**Requirement**: RNF-05

**Done when**:

- [x] Testes da função de resumo (primeira contra mediana das seguintes) e da escolha da rota que toca o banco
- [x] Teste de que o script recusa rodar contra `/api/health`
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(operacao): medir a retomada a frio do banco`

---

### Phase 3: Deploy e runbook

#### T4: Fumaça ampliada no fim do deploy

**What**: O passo 7 do `deploy.yml` passa a conferir, além de `/api/health`, que `/` e `/app/` respondem 200 e que a API traz CSP, HSTS e `Cache-Control: no-store`; qualquer falha dispara o rollback que já existe.
**Estimativa**: 2h
**Where**: `.github/workflows/deploy.yml`
**Depends on**: T1
**Reuses**: `backend/scripts/src/deploy-workflow.test.ts`
**Requirement**: RNF-06; ADR-015 (saúde e rollback)

**Done when**:

- [x] Testes novos no `deploy-workflow.test.ts` afirmam as rotas e os cabeçalhos conferidos e que o passo continua antes do bloco de rollback
- [x] Nenhuma asserção existente do `deploy-workflow.test.ts` alterada
- [x] Ações continuam fixadas por SHA
- [x] Gate quick verde

**Tests**: unit
**Gate**: quick
**Commit**: `feat(deploy): fumaça confere landing, app e cabeçalhos`

---

#### T7: Roteiro de ativação no runbook

**What**: Seção nova no `docs/runbook.md` com a ordem de ligar produção (`conferir-banco`, Hyperdrive, `DEPLOY_ATIVO`, fumaça, `medir-cpu-publicado`, `medir-retomada-a-frio`, `BACKUP_ATIVO`, `PURGA_ATIVA`), cada passo com o comando e a evidência a guardar.
**Estimativa**: 30 min
**Where**: `docs/runbook.md`
**Depends on**: T3, T4, T5, T6
**Reuses**: `.specs/etapa-17/neon.md`
**Requirement**: PLANO etapa 17; RNF-09

**Done when**:

- [x] Cada comando citado existe no `package.json` ou no workflow (conferido)
- [x] Prettier verde
- [x] Gate build verde e trava de testes registrada no commit final da feature

**Tests**: none
**Gate**: build
**Commit**: `docs(runbook): roteiro de ativação da produção`

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3

Phase 1:  T1   T2
Phase 2:  T3   T5   T6
Phase 3:  T4 ------→ T7
```

Lote único (7 tarefas): cabe num trabalhador só. Ao fim, verificação pelo agente `verificador` e aprovação seguir / ajustar / parar.
