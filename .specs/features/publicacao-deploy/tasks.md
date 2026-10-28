# Publicação 17c: primeiro deploy e medições — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tarefas com a skill `tlc-spec-driven`: **ative-a pelo nome e siga o fluxo Execute e as Critical Rules dela.** Não procure os arquivos da skill pelo caminho no disco.

**Se a skill não puder ser ativada, PARE e avise o usuário. Não siga sem ela.**

---

**Design**: não há `design.md` próprio. A base é o `docs/runbook.md` (seções 2, 3, 4, 5, 9 e 10), os ADRs 015 e 016, o `deploy.yml`, o `backup.yml` e o `purga.yml`. A divisão da etapa 17 está no AD-001 (`.specs/STATE.md`).
**Status**: Approved (2026-10-28)

Escopo: ligar a produção pela primeira vez (deploy, fumaça, webhook do Asaas, e-mail real), medir (CPU, retomada a frio, Início, Lighthouse), ligar monitoramento, backup e purga, e ensaiar a restauração com o primeiro backup real. Fecha as pendências `[A VALIDAR NA 17C]` do runbook.

**Regras desta feature (valem para toda tarefa):**

- Nenhum segredo, senha, chave, token, cookie nem URL de conexão passa pela conversa nem entra no repositório. O usuário grava direto no `wrangler secret`, nos GitHub Secrets ou no ambiente do terminal dele.
- Cada ação externa (push, deploy, flag, secret, mudança em conta de terceiro) precisa da **confirmação própria** do usuário, mesmo com a feature aprovada.
- **Evidência** de tarefa operacional = saída de comando, link de execução do Actions ou captura, sem valor secreto, registrada em `.specs/features/publicacao-deploy/evidencias.md` (criado pelo Claude). Sem evidência, a tarefa não conta como concluída.
- Passo falhou: pare, registre a falha e a causa, não pule para o seguinte.
- Comandos do wrangler: `pnpm --filter @controle/api exec wrangler ... -c ../../wrangler.jsonc`. Comandos de terminal do usuário sempre da raiz do projeto.
- O repositório está público (decisão da 17b) e volta a ser privado no fim do projeto.

---

## Test Coverage Matrix

> Gerada a partir de `.specs/features/publicacao-infra/tasks.md` e do `.claude/CLAUDE.md`. Configuração e operação externas provam o comportamento com execução real e evidência registrada; qualquer ajuste de código leva teste automatizado.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Operação externa (deploy, flags, UptimeRobot, Asaas, Resend) | none (evidência registrada) | Cada tarefa tem uma conferência executada de verdade e o resultado registrado | `.specs/features/publicacao-deploy/evidencias.md` | o comando ou workflow de cada tarefa |
| Scripts de operação (`medir-*`, `restauracao-neon`) | unit | Qualquer correção nasce de um teste que reproduz a falha | `backend/scripts/src/operacao/*.test.ts` | `pnpm --filter @controle/scripts test` |
| Workflows e `wrangler.jsonc` | unit | Teste de estrutura existente segue verde após ajuste | `backend/scripts/src/operacao/*.test.ts` | `pnpm --filter @controle/scripts test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tarefa de código/teste de scripts | `pnpm --filter @controle/scripts test` |
| Full | Tarefa que mexe em API ou web | `EXIGIR_BANCO=1 pnpm test` (Docker no ar) |
| Build | Fim de Phase e fim da feature | `pnpm lint && pnpm typecheck && EXIGIR_BANCO=1 pnpm test`, e com tudo commitado `python .claude/scripts/trava-testes.py --rodar` |

---

## Execution Plan

As Phases rodam em sequência. São 16 tarefas, cerca de 18 h de trabalho humano (mais a TC, condicional, de 2 h). Ações do usuário: T1, T3, T5, T6, T7, T10 (cookie), T11, T12 e T14. Trabalho do Claude: T2, T4, T8, T9, T13, T15, T16 e a TC.

### Phase 1: Push e primeiro deploy

```
T1 → T2 → T3 → T4
          T3 → TC (só se o ratelimits não existir no Free)
```

### Phase 2: Integrações em produção

```
T4 → T5
T4 → T6
T4 → T7
```

### Phase 3: Medições e monitoramento

```
T4 → T8 → T9
T4 → T10
T4 → T11
```

### Phase 4: Backup, restauração e purga

```
T4 → T12 → T13 → T14
T4 → T15
```

### Phase 5: Fechamento

```
T5, T6, T7, T9, T10, T11, T14, T15 → T16
```

---

## Task Breakdown

### Phase 1: Push e primeiro deploy

#### T1: Push dos commits novos com a suíte verde

**What**: **Ação do usuário (confirmação específica).** Com tudo commitado, rodar `python .claude/scripts/trava-testes.py --rodar`; com a suíte verde, fazer o push da `main` e esperar o `ci` ficar verde no GitHub.
**Estimativa**: 1h
**Risco**: alto
**Where**: repositório local e GitHub Actions
**Depends on**: None
**Reuses**: `.claude/scripts/trava-testes.py`; `ci.yml`
**Requirement**: ADR 015 (deploy só após `ci` verde)

**Done when**:

- [x] Trava de testes verde no commit a enviar (saída mostrada)
- [x] Push feito só depois da confirmação do usuário
- [x] `ci` verde no commit enviado (link da execução em `evidencias.md`)

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(deploy): evidência do push e do ci verde`

---

#### T2: Conferir o que o primeiro deploy lê, antes de ligar

**What**: Antes de ligar a flag, conferir sem efeito colateral: secrets e variáveis do `producao` contra `segredos-workflows.test.ts`, id do Hyperdrive no `wrangler.jsonc`, secrets do Worker (`wrangler secret list`, só nomes), e `wrangler deploy --dry-run` para ver se o binding `ratelimits` é aceito no plano Free.
**Estimativa**: 1h
**Risco**: baixo
**Where**: terminal; `wrangler.jsonc`; GitHub (nomes de secrets)
**Depends on**: T1
**Reuses**: `docs/runbook.md` seções 7 e 10; `backend/scripts/src/operacao/segredos-workflows.test.ts`
**Requirement**: ADR 015

**Done when**:

- [x] Lista de nomes de secrets do Worker e do `producao` confere com o esperado (sem valores)
- [x] Resultado do `--dry-run` quanto ao `ratelimits` registrado; se recusado, a TC passa a valer
- [x] Evidência registrada

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(deploy): evidência da conferência antes do deploy`

---

#### T3: Ligar o deploy e disparar o primeiro

**What**: **Ação do usuário (confirmação específica).** Definir `DEPLOY_ATIVO=true`, disparar `gh workflow run deploy --ref main` e acompanhar até o fim; confirmar que o job `conferir` consulta o `ci` via `gh api` com `actions: read`, que o passo `cache-hyperdrive` acha o Hyperdrive e que o token da Cloudflare tem o escopo suficiente.
**Estimativa**: 2h
**Risco**: alto
**Where**: GitHub Actions; Cloudflare; Neon (branch `restauracao-*`)
**Depends on**: T2
**Reuses**: `.github/workflows/deploy.yml`; `docs/runbook.md` seção 2
**Requirement**: ADR 015; RNF-09

**Done when**:

- [x] Execução do `deploy.yml` verde (link em `evidencias.md`), com os passos `conferir`, `cache-hyperdrive`, branch de restauração, dump cifrado, migração e `wrangler deploy`
- [x] Escopo do `CLOUDFLARE_API_TOKEN` provado pelo próprio deploy (ou o escopo faltante registrado e corrigido)
- [x] Falha em qualquer passo: parar, registrar a causa e corrigir antes de repetir; correção de código leva teste que a reproduz

**Tests**: none (código só se um passo falhar, então unit)
**Gate**: link da execução verde
**Commit**: `docs(deploy): evidência do primeiro deploy`

---

#### T4: Fumaça no domínio publicado

**What**: Conferir `https://controleemcasa.ljssoftware.com.br`: `/api/health`, `/`, `/app/`, cabeçalhos CSP, HSTS e `Cache-Control: no-store`, e o log do passo de fumaça do deploy.
**Estimativa**: 30 min
**Risco**: baixo
**Where**: terminal (`curl -sI`); log do `deploy.yml`
**Depends on**: T3
**Reuses**: `docs/runbook.md` seção 10 passo 4
**Requirement**: RNF-09

**Done when**:

- [x] Respostas e cabeçalhos esperados registrados em `evidencias.md`
- [x] Domínio custom responde com TLS válido

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(deploy): evidência da fumaça em produção`

---

#### TC: Plano B do rate limit (condicional)

**What**: **Só se a T2 ou a T3 mostrarem que o binding `ratelimits` não existe no Workers Free.** Desenhar e implementar a alternativa (limite por tabela no banco ou por Durable Object, escolhida em ADR curto) mantendo os limites do SDD, com teste que falharia sem ela.
**Estimativa**: 2h
**Risco**: alto
**Where**: `backend/api/`; ADR novo
**Depends on**: T3
**Reuses**: limites de `muitas_tentativas` e `muitas_requisicoes` das etapas 4 e 6
**Requirement**: RNF-07

**Done when**:

- [x] (dispensada, o ratelimits foi aceito no Free; ver T3) Teste automatizado que falha sem o plano B e passa com ele
- [x] (dispensada, o ratelimits foi aceito no Free; ver T3) ADR registrado e aprovado pelo usuário
- [x] (dispensada, o ratelimits foi aceito no Free; ver T3) Suíte verde pela trava

**Tests**: unit e integration
**Gate**: Full
**Commit**: `feat(api): limite de requisições sem o binding ratelimits`

---

### Phase 2: Integrações em produção

#### T5: Webhook do Asaas e chave de produção

**What**: **Ação do usuário (confirmação específica).** Gerar um novo token do webhook, gravar no Worker (`wrangler secret put ASAAS_WEBHOOK_TOKEN`) e no painel do Asaas; provar a chave de produção com uma consulta só de leitura e um evento de teste do webhook chegando ao Worker.
**Estimativa**: 1h
**Risco**: alto
**Where**: painel do Asaas; `wrangler secret`
**Depends on**: T4
**Reuses**: ADR 012; `.specs/etapa-13/pesquisa-asaas.md`
**Requirement**: RF de cobrança (etapa 13)

**Done when**:

- [ ] Token novo gravado nos dois lados (o usuário não passa o valor pela conversa)
- [ ] Chamada de leitura com a chave de produção responde 200
- [ ] Evento de teste do Asaas recebido e aceito pelo Worker; evento com token errado recusado (401)
- [ ] Evidência registrada, sem valores

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(deploy): evidência do webhook e da chave do Asaas`

---

#### T6: E-mail real do Resend em produção

**What**: **Ação do usuário.** Cadastrar uma conta real no app publicado, receber o e-mail de confirmação, confirmar e pedir "esqueci minha senha"; registrar onde cada e-mail caiu (caixa de entrada ou spam) e as ressalvas de reputação.
**Estimativa**: 1h
**Risco**: baixo
**Where**: app publicado; painel do Resend
**Depends on**: T4
**Reuses**: evidência da T13 da 17b
**Requirement**: RF de e-mail (etapa 4)

**Done when**:

- [x] Cadastro, confirmação e recuperação de senha funcionam de ponta a ponta no domínio publicado
- [x] Local de entrega dos e-mails registrado (entrada ou spam) e plano de reputação anotado se caiu no spam
- [x] Evidência registrada

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(deploy): evidência do e-mail real`

---

#### T7: Ensaio de rollback do Worker

**What**: **Ação do usuário (confirmação específica).** Ensaiar o rollback do Worker (runbook 3.1) de forma não interativa e conferir que o app volta à versão anterior; anotar o tempo e o comando que funcionou, e confirmar que o `deploy.yml` faz o mesmo sozinho quando a fumaça falha.
**Estimativa**: 90 min
**Risco**: alto
**Where**: Cloudflare (`wrangler rollback`); `deploy.yml`
**Depends on**: T4
**Reuses**: `docs/runbook.md` seção 3.1; ADR 015
**Requirement**: RNF-09

**Done when**:

- [ ] Comando de rollback executado e `/api/health` responde com a versão anterior
- [ ] Redeploy da versão atual feito depois do ensaio
- [ ] Tempo medido e runbook ajustado se o comando documentado não servir

**Tests**: none (unit se o runbook exigir ajuste em script)
**Gate**: evidência registrada
**Commit**: `docs(deploy): evidência do rollback`

---

### Phase 3: Medições e monitoramento

#### T8: Medir a CPU do Worker publicado

**What**: Rodar `medir-cpu-publicado` com `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no ambiente do usuário, depois de tráfego real (cadastro, login, Início, resumo com as 4 consultas do orçamento e metas). Resolver o `[A VALIDAR NA 17C]` do dataset e dos campos da API de análise. Comparar p50 e p99 com o teto de 10 ms (R1 do SDD §10).
**Estimativa**: 2h
**Risco**: baixo
**Where**: `backend/scripts/src/operacao/medir-cpu-publicado.ts`
**Depends on**: T4
**Reuses**: SDD §10 (R1); runbook seção 10 passo 5
**Requirement**: RNF de CPU (R1)

**Done when**:

- [ ] Relatório com p50, p99 e veredito contra 10 ms registrado
- [ ] Dataset e campos da API de análise validados; correção de script nasce de teste que falha
- [ ] Teto estourado: abrir ajuste de CPU como tarefa nova antes de aprovar a feature

**Tests**: unit (se o script mudar)
**Gate**: Quick
**Commit**: `docs(deploy): medição de CPU do Worker publicado`

---

#### T9: Retomada a frio e Início em até 2 s

**What**: Com o app parado além do tempo de suspensão do Neon, rodar `medir-retomada-a-frio` (`URL_PUBLICA` e `MEDIR_COOKIE` no ambiente do usuário, nunca na conversa) e medir o Início real no navegador; resolver a rota usada em produção (`/api/sessao`).
**Estimativa**: 90 min
**Risco**: baixo
**Where**: `backend/scripts/src/operacao/medir-retomada-a-frio.ts`
**Depends on**: T8
**Reuses**: runbook seção 10 passo 6; PRD (Início ≤ 2 s)
**Requirement**: RNF de desempenho

**Done when**:

- [ ] Relatório da primeira requisição contra a mediana das seguintes
- [ ] Início medido no navegador contra a meta de 2 s
- [ ] Meta estourada: registrar e abrir ajuste

**Tests**: unit (se o script mudar)
**Gate**: Quick
**Commit**: `docs(deploy): medição da retomada a frio`

---

#### T10: Lighthouse no app publicado

**What**: **Ação do usuário (cookie) ou Claude.** Rodar o Lighthouse 11.7.1 (versão fixada) contra a URL publicada e registrar PWA, desempenho, acessibilidade e boas práticas.
**Estimativa**: 1h
**Risco**: baixo
**Where**: terminal; relatório em `evidencias/` fora do git se tiver dado
**Depends on**: T4
**Reuses**: etapa 16, lote 2 (Lighthouse fixado)
**Requirement**: RNF de PWA (nota ≥ 90)

**Done when**:

- [ ] Notas registradas; PWA ≥ 90
- [ ] Nota abaixo da meta: registrar a causa e abrir ajuste

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(deploy): evidência do Lighthouse publicado`

---

#### T11: UptimeRobot

**What**: **Ação do usuário.** Criar o monitor de `https://controleemcasa.ljssoftware.com.br/api/health` com alerta por e-mail, e provar o alerta (pausar e retomar ou apontar para uma URL que falha).
**Estimativa**: 30 min
**Risco**: baixo
**Where**: painel do UptimeRobot
**Depends on**: T4
**Reuses**: `docs/runbook.md` seção 8
**Requirement**: RNF-09

**Done when**:

- [ ] Monitor ativo e verde
- [ ] Alerta de queda recebido pelo usuário (captura ou relato)
- [ ] Evidência registrada

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(deploy): evidência do monitor de disponibilidade`

---

### Phase 4: Backup, restauração e purga

#### T12: Ligar o backup diário e conferir o primeiro

**What**: **Ação do usuário (confirmação específica).** Definir `BACKUP_ATIVO=true`, disparar o `backup.yml` à mão uma vez, baixar o artefato cifrado e conferir tamanho, retenção de 30 dias e nome (runbook seção 5).
**Estimativa**: 1h
**Risco**: alto
**Where**: GitHub Actions
**Depends on**: T4
**Reuses**: `backup.yml`; `docs/runbook.md` seção 5
**Requirement**: RNF-09

**Done when**:

- [ ] Execução do `backup.yml` verde (link) e artefato com retenção de 30 dias confirmada
- [ ] Artefato baixado pelo usuário para o ensaio da T13

**Tests**: none
**Gate**: link da execução verde
**Commit**: `docs(deploy): evidência do primeiro backup`

---

#### T13: Ensaio de restauração com o primeiro backup real

**What**: Decifrar o artefato com a chave privada `age` da guarda offline (o usuário, sem passar a chave), restaurar numa branch nova do Neon com a role owner e conferir com a seção 4.3; fechar o `[A VALIDAR NA ETAPA 17]` da seção 9.3 do runbook com data, comandos e resultado, e conferir o `search_path` das roles.
**Estimativa**: 2h
**Risco**: alto
**Where**: `docs/runbook.md` seções 4.2 e 9; branch de ensaio no Neon (apagar no fim)
**Depends on**: T12
**Reuses**: ensaios 9.1 e 9.2
**Requirement**: RNF-09

**Done when**:

- [ ] Restauração concluída e conferência 4.3 sem acusação
- [ ] Seção 9.3 do runbook atualizada com o resultado
- [ ] Branch de ensaio apagada

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(runbook): ensaio de restauração com o primeiro backup real`

---

#### T14: Restaurar pela branch `restauracao-*` e medir RTO e RPO

**What**: **Ação do usuário (confirmação específica).** Restaurar a partir de uma branch `restauracao-*` criada pelo deploy real (runbook 4.1), medir o tempo do alerta ao app de volta (RTO) e o intervalo de dados perdidos (RPO), e conferir a janela de restauração do Neon Free (6 h). Apontar de volta para a `main` ao final.
**Estimativa**: 90 min
**Risco**: alto
**Where**: Neon; Hyperdrive; `docs/runbook.md` seção 4.1
**Depends on**: T13
**Reuses**: `restauracao-neon`; runbook 4.1
**Requirement**: RNF-09

**Done when**:

- [ ] Caminho que funcionou, RTO e RPO medidos e registrados na seção 9.3
- [ ] App de volta à `main` e `conferir-banco` sem acusação

**Tests**: none
**Gate**: evidência registrada
**Commit**: `docs(runbook): RTO e RPO medidos na restauração pela branch`

---

#### T15: Ligar a purga diária

**What**: **Ação do usuário (confirmação específica).** Definir `PURGA_ATIVA=true`, disparar o `purga.yml` uma vez e conferir que roda sem apagar nada indevido (sem conta em janela de exclusão, o esperado é zero).
**Estimativa**: 30 min
**Risco**: alto
**Where**: GitHub Actions
**Depends on**: T4
**Reuses**: `purga.yml`; ADR 013
**Requirement**: LGPD (CA-26.5)

**Done when**:

- [ ] Execução do `purga.yml` verde (link) com resultado conferido
- [ ] Evidência registrada

**Tests**: none
**Gate**: link da execução verde
**Commit**: `docs(deploy): evidência da primeira purga`

---

### Phase 5: Fechamento

#### T16: Fechar a 17c: runbook, evidências, ressalvas e roadmap

**What**: Consolidar `evidencias.md`, retirar os marcadores `[A VALIDAR NA 17C]` do runbook e dos scripts, anotar nos ADRs 015 e 016 o que a produção confirmou, trocar a Situação da 17c no `roadmap.md` e registrar o fim da 17c no `STATE.md`. Pedir a verificação independente (agente `verificador`) do que for código; as demais tarefas são conferidas pelas evidências.
**Estimativa**: 90 min
**Risco**: baixo
**Where**: `docs/runbook.md`; `.specs/projeto/roadmap.md`; `.specs/STATE.md`
**Depends on**: T5, T6, T7, T9, T10, T11, T14, T15
**Reuses**: `validation.md` da 17b como modelo
**Requirement**: AD-001

**Done when**:

- [ ] Nenhum `[A VALIDAR NA 17C]` restante, ou cada restante com motivo e destino (17d)
- [ ] Situação da 17c no roadmap trocada no mesmo commit da aprovação
- [ ] Trava de testes verde (`python .claude/scripts/trava-testes.py --rodar`) e `validation.md` com PASS, se houve código

**Tests**: none (unit nos scripts, se mudaram)
**Gate**: Build
**Commit**: `docs(infra): 17c verificada e aprovada`
