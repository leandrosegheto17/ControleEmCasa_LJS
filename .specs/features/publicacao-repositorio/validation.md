# Publicação 17a: repositório pronto para produção — Validação

**Data**: 2026-10-27
**Spec**: `.specs/features/publicacao-repositorio/tasks.md` (não há `spec.md`; a fonte da verdade são os `Done when` de T1 a T7)
**Intervalo**: `d17534b..HEAD` (350037f), 8 commits (5ad1f0f, 743236f, c3677a1, 8047e38, 99963df, 3de1981, 6a78abe, 350037f)
**Verificador**: subagente independente (autor ≠ verificador)

## Validation: publicacao-repositorio — FAIL ❌

Todos os critérios `Done when` têm prova localizada e o gate completo está verde. O veredito é FAIL porque o sensor de discriminação deixou **sobreviver dois mutantes de comportamento** (M2c, na CSP; M3g/M3k, no filtro de roles) e um terceiro de configuração (M3j). A regra é não declarar a feature pronta com mutante vivo. Nenhum defeito de código foi encontrado: o que falta é teste.

---

## Conclusão das tarefas

| Tarefa | Situação | Notas |
| ------ | -------- | ----- |
| T1 | Feita | `routes` em `wrangler.jsonc:16` |
| T2 | Feita, com lacuna de teste | Mutante M2c sobreviveu |
| T3 | Feita, com lacuna de teste | Mutantes M3g/M3k e M3j sobreviveram |
| T4 | Feita | Todos os mutantes do `deploy.yml` mortos (M4j é limite do tipo de teste, ver abaixo) |
| T5 | Feita | Um mutante irrelevante (M5h) |
| T6 | Feita | Um mutante defensivo (M6f) |
| T7 | Feita | Comandos conferidos um a um |

---

## Critérios `Done when` → evidência

| Tarefa | Critério | Resultado esperado | Evidência (`arquivo:linha` + asserção ou comando) | Resultado |
| ------ | -------- | ------------------ | ------------------------------------------------ | --------- |
| T1 | Teste novo, falha antes e passa depois: uma rota, `custom_domain: true`, host certo, sem `*` | `routes == [{pattern: 'controleemcasa.ljssoftware.com.br', custom_domain: true}]` | `backend/scripts/src/operacao/wrangler-dominio.test.ts:15` `expect(config.routes).toEqual([{ pattern: HOST, custom_domain: true }])` e `:16` `expect(r.pattern).not.toContain('*')`. "Falha antes": M1c (remover a rota) derruba os 2 testes | ✅ |
| T1 | `URL_PUBLICA` do `deploy.yml` bate com o host da rota | `https://<host da rota>` | `wrangler-dominio.test.ts:22` `expect(url).toBe(\`https://${config.routes![0]!.pattern}\`)`; valor real em `.github/workflows/deploy.yml:68` | ✅ |
| T1 | Gate quick verde | - | `wrangler-dominio.test.ts` e `deploy-workflow.test.ts`: 51 passaram na cópia | ✅ |
| T2 | DSN válido: `connect-src` ganha `https://<host>` e mais nada | CSP exata com `connect-src https://o1.ingest.us.sentry.io` | `backend/api/src/saude-e-cabecalhos.test.ts:~100` `expect(r.csp).toBe(\`default-src 'none'; connect-src https://o1.ingest.us.sentry.io; frame-ancestors 'none'; base-uri 'none'; form-action 'none'\`)` | ✅ |
| T2 | Sem DSN a CSP não muda | CSP sem `connect-src` | `saude-e-cabecalhos.test.ts` `expect((await csp()).csp).toBe(SEM_DSN)` e `expect((await csp('')).csp).toBe(SEM_DSN)` | ⚠️ Lacuna de precisão da spec (ver abaixo) |
| T2 | DSN malformado não muda a CSP nem derruba a resposta | status 200 e CSP igual à sem DSN | `saude-e-cabecalhos.test.ts` `it.each([...])` com `expect(r.status).toBe(200)` e `expect(r.csp).toBe(SEM_DSN)` (4 DSNs). **Os 4 casos não exercitam a regex de host** (ver M2c) | ⚠️ Parcial |
| T2 | Nenhum teste existente de cabeçalhos alterado | só acréscimo | `git diff d17534b..HEAD -- backend/api/src/saude-e-cabecalhos.test.ts`: `+30 / -0`, bloco novo no fim do arquivo | ✅ |
| T2 | Linha no Log do GUARDRAILS | linha nova de 2026-10-27 sobre G-35 | `.md/GUARDRAILS.md:275` ("G-35: a CSP devolvida pelo Worker em `/api/*` ganha `connect-src https://<host de ingestão do Sentry>`...") | ✅ |
| T2 | Gate full verde | - | Gate completo abaixo: 3889 testes, 0 falhas | ✅ |
| T3 | Integração no Postgres 18: passa no migrado; falha com mensagem clara com `BYPASSRLS` e com tabela sem `FORCE` | exit 0; mensagens `Role X com atributo proibido: rolbypassrls.` e `Tabela app.lancamento sem RLS forçada (FORCE).` | `backend/scripts/src/operacao/conferir-banco.test.ts:88` `expect(await main(...)).toBe(0)`; `:106` `toContain(\`Role ${role} com atributo proibido: rolbypassrls.\`)`; `:116` `toContain('Tabela app.lancamento sem RLS forçada (FORCE).')`; `:121-130` migration pendente | ✅ |
| T3 | Saída nunca contém URL nem senha | nenhuma ocorrência | `conferir-banco.test.ts:144-146` `for (const proibido of [senha, 'dono_x', urlRuim, banco.owner, u.password, u.host]) expect(tudo).not.toContain(proibido)`. M3e e M3f (vazar a URL) mortos. Execução real sem banco migrado: saída genérica, 0 ocorrências da senha | ✅ |
| T3 | Script `conferir-banco` no `package.json` | entrada presente | `backend/scripts/package.json:17` `"conferir-banco": "tsx --env-file-if-exists=../../.env src/operacao/conferir-banco.ts"`. **Nenhum teste guarda a entrada** (M3j sobreviveu) | ✅ por leitura; ⚠️ sem guarda |
| T3 | Gate full verde | - | Gate abaixo; `conferir-banco.test.ts` rodou com banco (15 testes, nenhum pulado) | ✅ |
| T5 | Testes do parser (feliz, sem dados, erro da API) e da regra do teto | p50 1,5 e p99 8,2 ms de 1500/8200 µs; `null` sem dados; erro com mensagem; teto 10 inclusive | `backend/scripts/src/operacao/medir-cpu-publicado.test.ts:25` `toEqual({ requisicoes: 1200, p50Ms: 1.5, p99Ms: 8.2 })`; `:29-30` `toBeNull()`; `:34-36` `toThrow('A API de análise respondeu com erro: não autorizado')`; `:47-50` `TETO_CPU_MS toBe(10)`, `dentroDoTeto(m(2, 10)) true`, `(2, 10.01) false`, `(10.5, 3) false` | ✅ |
| T5 | Token e conta só por ambiente; token fora de qualquer saída | sem `TOKEN` na saída | `medir-cpu-publicado.ts:130,135` lê `ambiente[...]`; teste `:99-108` `expect(tudo).not.toContain(TOKEN)` e `toContain('[removido]')`; `:67` `expect(init.body).not.toContain(TOKEN)`. M5e e M5k mortos | ✅ |
| T5 | Consulta à API simulada | `fetch` injetado | `medir-cpu-publicado.test.ts:62` `vi.fn().mockResolvedValue(...)`; `:65-66` URL e `Authorization`. Nenhuma chamada real | ✅ |
| T5 | Gate quick verde | - | `medir-cpu-publicado.test.ts`: 9 passaram | ✅ |
| T6 | Função de resumo (primeira contra mediana das seguintes) e escolha da rota | `{900, 50, 850}` e `{500, 50, 450}` | `backend/scripts/src/operacao/medir-retomada-a-frio.test.ts:11-12` `toEqual({ primeiraMs: 900, medianaSeguintesMs: 50, diferencaMs: 850 })` (par e ímpar); `:29-34` `rotaQueTocaBanco` | ✅ |
| T6 | Recusa rodar contra `/api/health` | exit 1, sem requisição | `medir-retomada-a-frio.test.ts:66` `rejects.toThrow(/\/api\/health não serve/)`; `:67` `expect(buscar).not.toHaveBeenCalled()`; `:71` `expect(codigo).toBe(1)`. M6a e M6d mortos | ✅ |
| T6 | Gate quick verde | - | `medir-retomada-a-frio.test.ts`: 8 passaram | ✅ |
| T4 | Testes afirmam rotas, cabeçalhos e ordem antes do rollback | `/api/health`, `/`, `/app/` com `curl -fsS`; CSP, HSTS, `no-store`; passo 7 entre a publicação e o rollback | `backend/scripts/src/deploy-workflow.test.ts:198-207` (rotas), `:209-217` (`toContain` dos 3 cabeçalhos, `::error title=`, `exit 1`), `:219-227` (`publicacao < passo7 < rollback`, sem `if:`/`continue-on-error`) | ✅ |
| T4 | Nenhuma asserção existente alterada | só acréscimo | `git diff d17534b..HEAD -- backend/scripts/src/deploy-workflow.test.ts`: `+40 / -0`, bloco no fim | ✅ |
| T4 | Ações continuam fixadas por SHA | `@[0-9a-f]{40}` | `deploy-workflow.test.ts:186` (asserção antiga, intocada, passa); o diff do `deploy.yml` não mexe em `uses:` | ✅ |
| T4 | Gate quick verde | - | `deploy-workflow.test.ts`: 17 passaram | ✅ |
| T7 | Cada comando citado existe no `package.json` ou no workflow | ver tabela da conferência abaixo | `docs/runbook.md:334-354` | ✅ |
| T7 | Prettier verde | - | `pnpm lint` saiu com 0 (`All matched files use Prettier code style!`) | ✅ |
| T7 | Gate build verde e trava de testes registrada no commit final | - | Gate build rodado por mim (abaixo). A trava (`trava-testes.py --rodar`) **não foi rodada por mim** (muda estado de commit); não confirmada neste relatório | ⚠️ não verificado |

**Estado**: sem critério sem evidência. Pendências de qualidade: T2 (parcial), T3 (guarda de `package.json`), T7 (trava de testes não conferida por mim).

### Lacunas de precisão da spec

1. **T2, "sem DSN fica só `'self'`"**: a CSP da API não tem `connect-src` (só `default-src 'none'`). O teste afirma a CSP exata, sem `connect-src`, o que é o comportamento correto, mas o texto do critério ("`'self'`") não descreve a CSP real. Corrigir o texto do critério na próxima revisão do `tasks.md`.
2. **T1, "falha antes da mudança"**: não dá para provar com o histórico (o teste nasceu junto com a rota). A prova usada é a equivalente: M1c, que retira a rota na cópia, derruba os dois testes.

### Conferência da seção 10 do runbook (T7)

| # | Comando ou referência citada | Existe? | Onde |
| - | ---------------------------- | ------- | ---- |
| 1 | `pnpm --filter @controle/scripts conferir-banco`; `DATABASE_URL_OWNER` | Sim | `backend/scripts/package.json:17`; `conferir-banco.ts:116` |
| 2 | `.specs/etapa-17/neon.md`; `cache-hyperdrive` no passo 2 do deploy | Sim | `.specs/etapa-17/neon.md`; `deploy.yml:90-94` |
| 3 | `DEPLOY_ATIVO=true` e disparo manual na `main` | Sim | `deploy.yml:20` `workflow_dispatch`, `:35`, `:60` |
| 4 | Passo 7 do `deploy.yml` com `/api/health`, `/`, `/app/`, CSP, HSTS, `no-store` | Sim | `deploy.yml:122-133` |
| 5 | `medir-cpu-publicado`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `JANELA_HORAS` | Sim | `package.json:18`; `medir-cpu-publicado.ts:130-132` |
| 6 | `medir-retomada-a-frio`, `URL_PUBLICA`, `MEDIR_COOKIE`, rota `/api/sessao` | Sim | `package.json:19`; `medir-retomada-a-frio.ts:90,92`; `GET /api/sessao` existe nas rotas da API |
| 7 | `BACKUP_ATIVO`, `backup.yml`, seção 5 e 9.3 do runbook | Sim | `backup.yml:28`; `runbook.md:175,325` |
| 8 | `PURGA_ATIVA`, `purga.yml` | Sim | `purga.yml:21` |

Nenhum comando inventado. Falta um teste automático dessa conferência (hoje é manual), o que a tarefa não exige (`Tests: none`).

---

## Sensor de discriminação

Cópia isolada: `git worktree` em pasta temporária fora do projeto, com junções para os `node_modules` (removidas antes de apagar o worktree). A checkout em Windows veio com CRLF e quebrava uma asserção antiga; converti para LF só na cópia. Linha de base na cópia: 51 testes verdes em scripts, 16 em `saude-e-cabecalhos` (API).

| # | Arquivo | Falha injetada | Teste que mata | Resultado |
| - | ------- | -------------- | -------------- | --------- |
| M1a | `wrangler.jsonc` | `custom_domain: true` → `false` | `wrangler-dominio.test.ts` rota | ✅ Morto |
| M1b | `wrangler.jsonc` | host trocado por `*.ljssoftware.com.br` | idem, mais o do `URL_PUBLICA` | ✅ Morto |
| M1c | `wrangler.jsonc` | remove a rota | idem | ✅ Morto |
| M1d | `deploy.yml` | `URL_PUBLICA` com host diferente | `wrangler-dominio.test.ts` e `deploy-workflow.test.ts` | ✅ Morto |
| M2a | `cabecalhos.ts` | ignora o DSN (`hostDoSentry(undefined)`) | "com DSN válido, connect-src ganha..." | ✅ Morto |
| M2b | `cabecalhos.ts` | aceita `http:` em vez de `https:` | DSN válido e DSN `http://` | ✅ Morto |
| **M2c** | `cabecalhos.ts` | **remove a regex de host** (`/^[a-z0-9.-]+(:\d+)?$/i`) | **nenhum** | ❌ **Sobreviveu** |
| M2d | `cabecalhos.ts` | acrescenta `'self'` ao `connect-src` | DSN válido | ✅ Morto |
| M2e | `cabecalhos.ts` | DSN malformado lança em vez de devolver `undefined` | DSN malformado | ✅ Morto |
| M2f | `cabecalhos.ts` | devolve `*` como host | DSN válido | ✅ Morto |
| M3a | `conferir-banco.ts` | tira `rolbypassrls` dos atributos | "role com rolbypassrls falha" e o de banco real | ✅ Morto |
| M3b | `conferir-banco.ts` | não acusa tabela sem `FORCE` | puro e banco real | ✅ Morto |
| M3c | `conferir-banco.ts` | não acusa tabela sem `ENABLE` | puro | ✅ Morto |
| M3d | `conferir-banco.ts` | inverte o filtro de migrations pendentes | 10 testes | ✅ Morto |
| M3e | `conferir-banco.ts` | imprime a URL no erro de conexão | "a saída nunca contém a URL" | ✅ Morto |
| M3f | `conferir-banco.ts` | imprime a URL na mensagem de sucesso | idem | ✅ Morto |
| **M3g** | `conferir-banco.ts` | **`like 'controle\\_%'` → `like '%'`** (confere todas as roles) | **nenhum** | ❌ **Sobreviveu** |
| **M3k** | `conferir-banco.ts` | **`like 'controle\\_%'` → `like 'controle_%'`** (volta o curinga que o 6a78abe corrigiu) | **nenhum** | ❌ **Sobreviveu** |
| M3h | `conferir-banco.ts` | consulta de tabelas só em `relkind 'v'` | banco real | ✅ Morto |
| M3i | `conferir-banco.ts` | `main` devolve 0 com problemas | banco real | ✅ Morto |
| **M3j** | `backend/scripts/package.json` | remove a entrada `conferir-banco` | **nenhum** | ❌ **Sobreviveu** |
| M4a | `deploy.yml` | tira a checagem de HSTS | "confere que a API traz CSP, HSTS..." | ✅ Morto |
| M4b | `deploy.yml` | tira a checagem de CSP | idem | ✅ Morto |
| M4c | `deploy.yml` | `no-store` → qualquer `cache-control` | idem | ✅ Morto |
| M4d | `deploy.yml` | tira o `curl` de `/app/` | "confere /api/health, a landing e o app" | ✅ Morto |
| M4e | `deploy.yml` | tira o `curl` de `/` | idem | ✅ Morto |
| M4f | `deploy.yml` | `curl -fsS` → `curl -sS` em `/app/` | idem | ✅ Morto |
| M4g | `deploy.yml` | tira o `exit 1` da checagem | idem | ✅ Morto |
| M4h | `deploy.yml` | rollback com `if: failure()` sem `steps.migrar.outcome` | teste do rollback, existente e novo | ✅ Morto |
| M4i | `deploy.yml` | `continue-on-error: true` no passo 7 | testes antigo e novo | ✅ Morto |
| M4j | `deploy.yml` | o `grep` passa a ler texto vazio (a checagem nunca acha nada) | **nenhum** | ❌ Sobreviveu (limite do tipo de teste, ver abaixo) |
| M4k | `deploy.yml` | cabeçalhos lidos de `/` em vez de `/api/health` | teste dos cabeçalhos | ✅ Morto |
| M5a | `medir-cpu-publicado.ts` | teto 10 → 12 | 3 testes | ✅ Morto |
| M5b | `medir-cpu-publicado.ts` | `<=` → `<` | teto inclusive | ✅ Morto |
| M5c | `medir-cpu-publicado.ts` | só confere o p99 | p50 acima | ✅ Morto |
| M5d | `medir-cpu-publicado.ts` | µs → ms com divisor 100 | caminho feliz | ✅ Morto |
| M5e | `medir-cpu-publicado.ts` | tira a limpeza do token da mensagem | "o token não aparece..." | ✅ Morto |
| M5f | `medir-cpu-publicado.ts` | zero requisições deixa de ser "sem dados" | janela sem dados | ✅ Morto |
| M5g | `medir-cpu-publicado.ts` | ignora HTTP de erro | HTTP 403 | ✅ Morto |
| M5i | `medir-cpu-publicado.ts` | `main` sempre devolve 0 | "main: 0 dentro, 1 acima" | ✅ Morto |
| M5j | `medir-cpu-publicado.ts` | ignora `errors` da API | erro da API | ✅ Morto |
| M5k | `medir-cpu-publicado.ts` | imprime o token no relatório | "o token não aparece..." | ✅ Morto |
| M5l | `medir-cpu-publicado.ts` | conta sem validação de formato | conta ausente | ✅ Morto |
| M5h | `medir-cpu-publicado.ts` | manda o token também em outro cabeçalho da mesma requisição | nenhum | Irrelevante: não é saída nem corpo; o critério fala em saída |
| M6a | `medir-retomada-a-frio.ts` | `/api/health` entra na lista de rotas | rota e recusa | ✅ Morto |
| M6b | `medir-retomada-a-frio.ts` | diferença invertida | resumo | ✅ Morto |
| M6c | `medir-retomada-a-frio.ts` | mediana vira o primeiro valor | resumo | ✅ Morto |
| M6d | `medir-retomada-a-frio.ts` | desliga a recusa de rota | recusa | ✅ Morto |
| M6e | `medir-retomada-a-frio.ts` | desliga a exigência de cookie | sem cookie | ✅ Morto |
| M6g | `medir-retomada-a-frio.ts` | aceita status diferente de 200 | status 401 e 500 | ✅ Morto |
| M6h | `medir-retomada-a-frio.ts` | inverte a ordem (a "primeira" vira a última) | resumo | ✅ Morto |
| M6i | `medir-retomada-a-frio.ts` | erro de um nas repetições | relógio injetado | ✅ Morto |
| M6j | `medir-retomada-a-frio.ts` | imprime o cookie | "nunca o cookie" | ✅ Morto |
| M6k | `medir-retomada-a-frio.ts` | não corta `?query` ao escolher a rota | rota | ✅ Morto |
| M6l | `medir-retomada-a-frio.ts` | aceita só um tempo | "exige pelo menos uma seguinte" | ✅ Morto |
| M6f | `medir-retomada-a-frio.ts` | tira a limpeza do cookie da mensagem de erro | nenhum | Defensivo: nenhuma mensagem de erro leva o cookie hoje; sem caminho para exercitar |

**Profundidade**: leve, ampliada (56 mutações, 6 ou mais por tarefa de código, por haver segurança envolvida).
**Resultado**: 49 mortas, 5 sobreviveram com relevância (M2c, M3g, M3k, M3j, M4j), 2 irrelevantes ou defensivas (M5h, M6f). Isolamento: `git status --porcelain` da árvore real igual ao de antes (vazio); worktree removido, `git worktree list` só mostra a árvore real.

### Mutantes vivos, em ordem de gravidade

1. **M2c (CSP, T2): a regex de host do DSN não é testada.** O exemplo do teste, `"https://x@a.com; script-src *'/1"`, tem espaço, e `new URL` já lança sobre ele; o `try/catch` cobre e a regex nunca é exercitada. Mas `new URL('https://x@a.com;script-src/1').host` devolve `a.com;script-src` (verificado em Node): sem a regex, esse DSN injetaria uma diretiva na CSP (`connect-src https://a.com;script-src;`). A regex é a defesa real e está sem teste. Risco prático baixo (o DSN é variável do operador), mas é o guarda de segurança da tarefa e o teste dele promete cobri-lo.
   **Tarefa de correção**: acrescentar ao `it.each` DSNs `https://x@a.com;script-src/1`, `https://x@a*.com/1` e `https://x@a.com;'unsafe-inline'/1`, esperando CSP igual à sem DSN.
2. **M3g e M3k (T3): o filtro `controle_*` não tem teste.** Nem "roles que não são `controle_*` ficam de fora" nem "`controleX…` não casa" são afirmados. O commit 6a78abe (escapa o `_` do LIKE) mudou comportamento sem teste que falhasse sem ele; vai contra a regra do projeto de teste para toda mudança de comportamento. Hoje o teste "passa no banco migrado" só confere `\d+ roles`.
   **Tarefa de correção**: no teste de banco, criar uma role `controleXfoo` com `BYPASSRLS` (não deve ser acusada) e outra role fora do prefixo com `SUPERUSER`/`BYPASSRLS` (não deve ser acusada), e afirmar o número de roles do resumo.
3. **M3j (T3): nada guarda a entrada `conferir-banco` no `package.json`** (nem `medir-cpu-publicado` e `medir-retomada-a-frio`, que o runbook cita). O critério "Script no package.json" é de presença e foi conferido por leitura (`package.json:17-19`), mas sem guarda. Existe um precedente no repositório (`migracao-aditiva.test.ts:262` afirma o script `migracoes-aditivas`). Gravidade menor.
4. **M4j (T4): a lógica do `grep` do passo 7 só é lida como texto.** Os testes do `deploy.yml` leem o YAML, como o plano da tarefa prevê (matriz: "unit (leitura do YAML)"); não existe teste que execute o laço. Conferi à mão: o laço extraído passa com os 3 cabeçalhos e falha com `::error` e exit 1 sem HSTS ou com `no-cache` (3 execuções). Limite aceito do desenho; registrado, sem tarefa.

---

## Edge cases

- [x] DSN ausente, vazio, malformado e fora de https não mudam a CSP (`saude-e-cabecalhos.test.ts`); o caso de injeção por `;` NÃO está coberto (M2c).
- [x] Janela sem dados na API de análise: `null`, exit 1 com mensagem (`medir-cpu-publicado.test.ts:29-30,83`).
- [x] Resposta HTTP de erro, JSON inválido e formato inesperado da API: mensagem clara (`:36-39,90-96`).
- [x] Cookie ausente e status diferente de 200 na retomada a frio (`medir-retomada-a-frio.test.ts:79-89`).
- [x] Banco com role de atributo proibido, tabela sem `FORCE`, migration pendente (`conferir-banco.test.ts:100-134`).
- [ ] Banco virgem (sem o schema `app`): `conferir-banco` falha com a mensagem genérica "Não foi possível ler o banco... (conexão ou consulta falhou)", porque `'app'::regnamespace` lança. Verificado no banco `controle` local (não migrado). Não há teste desse caminho; o runbook manda migrar antes, mas a mensagem esconde a causa. Observação, sem tarefa.

## Vazamento de segredo ou URL na saída (item 4)

- `conferir-banco`: o `catch` imprime texto fixo, sem a mensagem do driver (`conferir-banco.ts:124-127`). Teste de conexão recusada com senha conhecida (`conferir-banco.test.ts:136-146`); M3e e M3f mortos. Execução real: 0 ocorrências da senha.
- `medir-cpu-publicado`: token só no cabeçalho `Authorization`; `main` troca o token por `[removido]` em qualquer mensagem (`medir-cpu-publicado.ts:149-151`); teste `:99-108`; M5e e M5k mortos. Execução real com conta inválida: só a mensagem de formato.
- `medir-retomada-a-frio`: cookie só no cabeçalho `Cookie`; a URL pública não é impressa; execução real contra porta fechada devolveu só `fetch failed`, sem cookie. Teste `:92-102`; M6j morto. M6f (limpeza do cookie na mensagem de erro) é defensivo, sem caminho que o ative hoje.
- Resultado: nada vaza hoje. Um ponto de atenção: `conferir-banco` aceita `IGNORAR_ROLES` no ambiente (`conferir-banco.ts:130`), pensado para o ensaio local; em produção, se alguém definir essa variável, uma role perigosa pode ser silenciada. Hoje nada a define. Observação de desenho, sem tarefa.

## Integridade dos testes (item 3)

`git diff d17534b..HEAD -- '*.test.*'`: 6 arquivos, **454 linhas acrescentadas, 0 removidas**. Quatro são arquivos novos (`wrangler-dominio.test.ts`, `conferir-banco.test.ts`, `medir-cpu-publicado.test.ts`, `medir-retomada-a-frio.test.ts`); dois são acréscimos ao fim de arquivos existentes (`deploy-workflow.test.ts` +40, `saude-e-cabecalhos.test.ts` +30). Nenhum teste apagado, pulado, comentado ou enfraquecido. O total de testes depois da feature é 3889 (gate abaixo); não medi o total anterior, mas como o diff só acrescenta testes e não remove nenhum, a contagem não pode ter caído. Não há `skip`/`only` novo.

## Estimativas (item 5)

Presentes em todas as 7 tarefas e todas ≤ 2 h: T1 1 h, T2 2 h, T3 2 h, T5 2 h, T6 1,5 h, T4 2 h, T7 30 min (`tasks.md:82,103,127,149,171,194,216`). O diff de `tasks.md` só marca as caixas `[x]`; nada mais mudou.

---

## Gate

- **Comando**: `pnpm lint && pnpm typecheck && EXIGIR_BANCO=1 pnpm test` (Docker no ar, Postgres 18 na 55432), na árvore real, com tudo commitado.
- **lint**: saída 0 (ESLint e Prettier verdes).
- **typecheck**: saída 0.
- **test**: saída 0.

| Pacote | Arquivos | Testes | Falhas | Pulados |
| ------ | -------- | ------ | ------ | ------- |
| contrato | 11 | 116 | 0 | 0 |
| scripts | 28 | 487 | 0 | 0 |
| dominio | 14 | 494 | 0 | 0 |
| frontend/web | 219 | 2106 | 0 | 0 |
| api | 54 | 686 | 0 | 0 |
| **Total** | **326** | **3889** | **0** | **0** |

Os testes instáveis sob carga conhecidos (lancamentos-lancar, MetaFormulario, acesso-senha, Landing, resumo, Inicio) passaram nesta rodada; não houve falha a relatar.
A trava `python .claude/scripts/trava-testes.py --rodar` não foi executada por mim (é o registro de estado do commit, a cargo de quem integra).

---

## Achados (não são defeito do código)

1. **A CSP do app mora em `frontend/web/public/_headers`, não no Worker.** `frontend/web/public/_headers:5` fixa `connect-src 'self'` para os arquivos estáticos (`/` e `/app/`). A CSP que o navegador aplica ao app é a do documento HTML; é ela que decide se o SDK do Sentry no navegador pode enviar eventos. Por isso o `connect-src` com o host do DSN que a T2 acrescenta na CSP de `/api/*` é **inócuo para o Sentry do navegador**: essa CSP só vale para as respostas JSON da API, que ninguém renderiza. Ela só ajudaria um cliente que carregasse a resposta da API como documento, o que não ocorre. O comentário de `_headers:3` ("A etapa 16 acrescenta o host de ingestão do Sentry em connect-src") continua pendente: o host não foi acrescentado lá, e `deploy.yml` não o injeta no `_headers`. Resultado esperado em produção: o `VITE_SENTRY_DSN` do build (`frontend/web/src/configuracao/observabilidade.ts`) faria o SDK tentar enviar e o navegador bloquearia pela CSP do app. Decisão para a 17b ou 17c: gerar o `connect-src` do `_headers` no build a partir do DSN, ou usar um túnel same-origin. A exceção do GUARDRAILS (`.md/GUARDRAILS.md:275`) fala só da CSP do Worker.
2. **Banco virgem dá mensagem genérica em `conferir-banco`** (ver Edge cases).
3. **`IGNORAR_ROLES`** em `conferir-banco` (ver vazamento).
4. **Checkout em Windows**: com `core.autocrlf=true`, uma cópia nova do repositório vem com CRLF e a asserção antiga `deploy-workflow.test.ts:129` (`...br\n/`) falha; na árvore real, o arquivo está em LF e passa. Não afeta o CI (Linux).
5. **Estilo**: `conferir-banco.ts:57-58` tem dois comentários JSDoc seguidos, e o primeiro ("Resumo só com contagens") ficou sobre a função errada (`semRoles`). Cosmético.

## Qualidade do código

| Princípio | Situação |
| --------- | -------- |
| Mínimo de código, sem recurso além do pedido | ✅ (`IGNORAR_ROLES` e `semRoles` vão além do critério, mas servem ao ensaio local; registrado como achado 3) |
| Mudanças cirúrgicas, só os arquivos da tarefa | ✅ (16 arquivos, todos ligados às tarefas) |
| Segue os padrões do repositório (`cache-hyperdrive`, `medir-cpu`) | ✅ |
| Testes mapeiam critérios e não são rasos | ⚠️ (M2c, M3g/k) |
| Mudança de comportamento com teste que falharia sem ela | ⚠️ commit 6a78abe sem teste |
| Diretrizes seguidas | `.claude/CLAUDE.md` (testes inegociáveis), `.md/GUARDRAILS.md` (G-35) |

---

## Tarefas de correção propostas

1. **Fix 1 (Maior)**: reforçar o teste da CSP com DSN de injeção que `new URL` aceita (`;`, `*`, `'`), em `backend/api/src/saude-e-cabecalhos.test.ts`. Pronto quando: M2c é morto.
2. **Fix 2 (Maior)**: teste de banco para o filtro `controle_*` (role `controleXfoo` e role fora do prefixo, ambas com atributo proibido, não acusadas; contagem de roles do resumo), em `conferir-banco.test.ts`. Pronto quando: M3g e M3k são mortos.
3. **Fix 3 (Menor)**: teste que afirma as três entradas novas do `backend/scripts/package.json` (padrão de `migracao-aditiva.test.ts:262`). Pronto quando: M3j é morto.
4. **Opcional (Menor)**: corrigir o texto do critério T2 ("só `'self'`") no `tasks.md`; registrar a decisão sobre o `_headers` para a 17b ou 17c.

## Rastreabilidade

Sem `spec.md` com IDs; requisitos citados nas tarefas: RNF-04 (T5, medir CPU), RNF-05 (T6), RNF-06/RNF-08 (T2, T4), RNF-07 (T3), RNF-09 (T7). Todos implementados; RNF-06/RNF-08 e RNF-07 ficam com a ressalva dos mutantes vivos.

## Resumo

**Geral**: ⚠️ Problemas (veredito FAIL até os Fix 1 a 3).
**Critérios**: todos os `Done when` com evidência localizada; 2 lacunas de precisão da spec; T2 e T3 com cobertura parcial (mutantes vivos).
**Sensor**: 56 mutações, 49 mortas, 5 vivas relevantes, 2 irrelevantes ou defensivas.
**Gate**: 3889 passaram, 0 falharam, 0 pulados.

**O que funciona**: domínio custom, CSP com host do Sentry, `conferir-banco` (detecta `BYPASSRLS`, `FORCE` faltando e migration pendente num Postgres 18 real), medição de CPU e de retomada a frio com recusa de `/api/health`, fumaça ampliada com rollback, runbook sem comando inventado.
**Próximos passos**: Fix 1 a 3, depois nova verificação (rápida: só os três mutantes). A trava de testes do commit final fica para quem integrar.

---

# Reverificação (lote de correção T8 a T11)

**Data**: 2026-10-27
**Intervalo**: `393e388..8ad9164` (c8a3016, e2764b3, 6c7c52a, 8ad9164, cf49eb0, dbdc2de)
**Verificador**: subagente independente (não escreveu o código)

## Validation: publicacao-repositorio (reverificação) — FAIL ❌

Os 4 mutantes da primeira rodada (M3g, M3k, M3j e o equivalente de M2c) estão **mortos**, e o gate está verde (3905 testes, 0 falhas). O veredito continua FAIL por dois motivos novos, ambos na T9:

1. **O `public/_headers` ficou com bytes inválidos em UTF-8** (comentário da linha 3, introduzido em e2764b3), então o `dist/_headers` gerado **não é idêntico** ao original, que é o critério da T9 ("sem DSN o arquivo gerado é idêntico ao de `public/_headers`"). Verificado no build real. O teste não pega porque lê os dois lados como texto UTF-8.
2. **A entrada de linha de comando do gerador (ler `VITE_SENTRY_DSN`, imprimir o aviso, gravar `dist/_headers`) não tem nenhum teste.** 6 mutantes sobrevivem, entre eles "DSN inválido sem avisar" e "ignora a variável do DSN". Só a função pura e a string do script `build` são testadas.

## Tarefas T8 a T11: `Done when` → evidência

| Tarefa | Critério | Evidência | Resultado |
| ------ | -------- | --------- | --------- |
| T8 | `cabecalhos.ts` e `saude-e-cabecalhos.test.ts` voltam ao estado anterior à T2 | `git diff 5ad1f0f -- backend/api/src/middleware/cabecalhos.ts backend/api/src/saude-e-cabecalhos.test.ts` vazio (rodado por mim) | ✅ |
| T8 | Nenhum teste de antes da T2 alterado | o mesmo diff vazio; `git diff d17534b..HEAD -- '*.test.*'` não lista mais `saude-e-cabecalhos.test.ts` | ✅ |
| T8 | Linha da T2 no Log do GUARDRAILS sai junto, motivo no corpo do commit | `git show c8a3016`: `.md/GUARDRAILS.md | 1 -`; o corpo explica "A CSP da API só vale para respostas JSON" | ✅ |
| T8 | Gate quick verde | pacote `api` no gate: 54 arquivos, 680 testes (686 menos os 6 do revert), 0 falhas | ✅ |
| T9 | DSN válido põe `https://<host>` no `connect-src` e mais nada; sem DSN o arquivo é idêntico | `frontend/web/scripts/gerar-headers.test.mjs:10-14` `expect(conteudo).toBe(original.replace("connect-src 'self'", "connect-src 'self' https://o1.ingest.us.sentry.io"))`; `:16-18` `expect(gerarHeaders(original, dsn)).toEqual({ conteudo: original, aviso: undefined })`. **No build real o `dist/_headers` sem DSN difere do `public/_headers` em bytes** (char 239, linha 3) | ⚠️ função ✅; arquivo real ❌ (achado 1) |
| T9 | Injeção: `;`, `*`, `'`, espaço, quebra de linha, `http:` recusados, aviso, CSP sem diretiva extra | `gerar-headers.test.mjs:32-50`, `it.each` de 12 casos: `expect(aviso).toMatch(/VITE_SENTRY_DSN ignorado/)`, `expect(conteudo).toBe(original)`, `expect(cspDe(conteudo)).toBe(cspDe(original))`. Nos mutantes abaixo: `;`, `*`, `'`, `http:`, `wss:`, localhost, DSN inteiro e "sem aviso" mortos; `"`, `,` e lixo antes do host sobrevivem | ⚠️ parcial (achado 3) |
| T9 | `build` usa o script; `_headers` final mantém HSTS, nosniff e demais linhas | `gerar-headers.test.mjs:54-57` `expect(pkg.scripts.build).toBe('vite build && node scripts/gerar-headers.mjs')`; `:20-30` `toContain` de HSTS, nosniff, Referrer-Policy e Permissions-Policy. B01, B02, B03 e H01 a H03 mortos. Build real: `exit=0`, `dist/_headers` com todas as linhas | ✅ |
| T9 | Linha no Log do GUARDRAILS | `.md/GUARDRAILS.md:275` (G-35: o `connect-src` do `dist/_headers` ganha o host exato de `VITE_SENTRY_DSN`) | ✅ |
| T9 | Gate quick (pacote web) | `pnpm --filter @controle/web exec vitest run scripts/gerar-headers.test.mjs`: 18 passaram; o arquivo entra pelo `frontend/web/vite.config.ts:89` (`scripts/**/*.test.mjs`, já existente) | ✅ |
| T10 | Teste novo passa e falha com `like '%'` e sem o escape do `_` | `backend/scripts/src/operacao/conferir-banco.test.ts:112-138` (`controleXfoo` com `bypassrls createrole`, `outra_fora` com `bypassrls createdb`): `expect(await main(...)).toBe(0)`, `not.toContain(quaseCasa)`, `not.toContain(fora)`, `expect(contagem()).toBe(antes + 1)`. M3g e M3k: `AssertionError: expected 1 to be +0`, só esse teste falha | ✅ |
| T10 | Roles temporárias sempre derrubadas | `finally` com `drop role if exists` (`:133-137`); depois dos mutantes (que fazem o teste falhar), `pg_roles` do banco local só tem `controle_owner`, `controle_app`, `controle_backup_ro` | ✅ |
| T10 | Nenhum teste existente alterado | `git diff 393e388..HEAD -- backend/scripts/src/operacao/conferir-banco.test.ts`: `+28 / -0` | ✅ |
| T11 | Falha quando uma das três entradas some ou aponta para outro arquivo; o arquivo existe | `backend/scripts/src/operacao/scripts-package.test.ts:13-22` `expect(partes[0]).toBe('tsx')`, `expect(partes.at(-1)).toBe(arquivo)`, `expect(existsSync(...)).toBe(true)`. M3j1 a M3j7 mortos | ✅ |
| T1 a T7 | Continuam entregues | Pacotes `scripts` (491) e `api` (680) verdes no gate, incluindo `wrangler-dominio`, `deploy-workflow`, `medir-*` e `conferir-banco`; o diff da CSP da API contra `5ad1f0f` vazio (a T2 sai de propósito, o resto não é tocado) | ✅ |

## Mutantes da reverificação

Cópia isolada: `git worktree` em pasta fora do projeto (`core.autocrlf=false`; o `pnpm exec` criou ali o próprio `node_modules`), `EXIGIR_BANCO=1` contra o Postgres 18 local. Linha de base na cópia: 19 testes verdes em `conferir-banco` e `scripts-package`, 18 em `gerar-headers`. Cópia apagada e `git worktree prune` feito; `git status --porcelain` da árvore real vazio antes e depois.

### Primeira rodada (M3g, M3k, M3j)

| # | Falha injetada | Teste que mata | Resultado |
| - | -------------- | -------------- | --------- |
| M3g | `like 'controle\\_%'` → `like '%'` | `conferir-banco.test.ts:112` ("só confere roles controle_*...") | ✅ Morto |
| M3k | `like 'controle\\_%'` → `like 'controle_%'` | o mesmo | ✅ Morto |
| M3j1 | remove a entrada `conferir-banco` | `scripts-package.test.ts` | ✅ Morto |
| M3j2 | remove `medir-cpu-publicado` | idem | ✅ Morto |
| M3j3 | remove `medir-retomada-a-frio` | idem | ✅ Morto |
| M3j4 | `conferir-banco` aponta para `cache-hyperdrive.ts` | idem | ✅ Morto |
| M3j5 | `medir-cpu-publicado` aponta para `src/medir-cpu.ts` | idem | ✅ Morto |
| M3j6 | `medir-retomada-a-frio` aponta para arquivo inexistente | idem | ✅ Morto |
| M3j7 | `medir-retomada-a-frio` troca `tsx` por `node` | idem | ✅ Morto |

### Validação do host na T9 (o equivalente de M2c)

| # | Falha injetada (`gerar-headers.mjs`) | Resultado |
| - | ------------------------------------ | --------- |
| G01, G02, G03 (rótulo todo) | as classes de caractere do host aceitam `;`, `*`, `'` (troca `a-z0-9` por `a-z0-9;` etc. em todas as classes) | ✅ Mortos (3). As versões que mexem só no primeiro rótulo eram mal formadas (o `;` cai no segundo rótulo) e foram descartadas |
| G04 | regex do host vira `/.*/` | ✅ Morto (5 testes) |
| G05 | aceita `http:` | ✅ Morto |
| G06 | remove a checagem de protocolo | ✅ Morto (http e wss) |
| G07 | aceita host sem ponto (`localhost`) | ✅ Morto |
| G08, G09 | `https://` fixo vira `http://` ou `wss://` | ✅ Mortos |
| G10 | escreve o DSN inteiro no `_headers` | ✅ Morto |
| G11 | recusa sem aviso (a função devolve `aviso: undefined`) | ✅ Morto (12 testes) |
| G16 | regex sem âncora final | ✅ Morto |
| G17 | `new URL` falha e o texto cru vira host | ✅ Morto |
| **G15** | regex sem âncora inicial (`a;b.com` passa) | ❌ **Sobreviveu**. Nenhum caso tem lixo antes de um sufixo de host válido. Deixaria entrar um nome de diretiva com ponto na CSP (inócuo no navegador, mas é a defesa que o teste promete cobrir) |
| **G19** | aceita `"` no host (`new URL('https://x@a".com/1').host` devolve `a".com`) | ❌ **Sobreviveu**. Só há caso com `'`, não com `"` |
| **G22** | aceita `,` no host (`new URL(...).host` devolve `a.com,b.com`) | ❌ **Sobreviveu**. Vírgula separa políticas no cabeçalho CSP |
| G12, G13 | remove a checagem de espaço e controle do DSN cru | Sobreviveu, **equivalente**: `new URL` descarta tab e `\n`, e o host que sobra tem de passar na regex; a saída só leva host validado. Defesa em profundidade |
| G14 | porta aceita lixo | Sobreviveu, **equivalente**: `new URL` já lança em porta não numérica |
| G18 | tira o `toLowerCase` do host | Sobreviveu, **equivalente**: `URL` já devolve o host em minúsculas |
| G20 | aceita espaço no host | Sobreviveu, **equivalente**: `new URL` lança com espaço no host |
| G21 | aceita `_` no host | Sobreviveu, **irrelevante** para a CSP; sem critério |

### Novos mutantes da T9 (comportamento e build)

| # | Falha injetada | Resultado |
| - | -------------- | --------- |
| H01, H02, H03 | perde HSTS e nosniff / só nosniff / só HSTS ao gerar | ✅ Mortos |
| H04, H05, H06 | sem DSN o arquivo deixa de ser idêntico (`+ '\n'`, `trim()`, vazio) | ✅ Mortos (15 testes cada) |
| H07, H08, H09, H10 | o host vem com `script-src` extra, no `default-src`, com `'unsafe-inline'`, ou o `'self'` some | ✅ Mortos |
| H11 | DSN em branco passa a ser recusado com aviso | ✅ Morto |
| B01 | `build` deixa de chamar o gerador | ✅ Morto |
| B02 | gerador roda antes do `vite build` (o vite sobrescreveria) | ✅ Morto |
| B03 | `vite build ; node ...` | ✅ Morto |
| **C01** | a linha de comando não imprime o aviso (silencioso no build) | ❌ **Sobreviveu** |
| **C02** | a linha de comando ignora `VITE_SENTRY_DSN` | ❌ **Sobreviveu** |
| **C03** | grava o original em vez do gerado | ❌ **Sobreviveu** |
| **C04** | não grava nada | ❌ **Sobreviveu** |
| **C05** | lê `SENTRY_DSN` em vez de `VITE_SENTRY_DSN` | ❌ **Sobreviveu** |
| **C06** | com DSN inválido grava o DSN cru no `connect-src` | ❌ **Sobreviveu** |

**Placar**: 54 mutações. 36 mortas; 9 sobreviveram com relevância (C01 a C06, G15, G19, G22); 6 sobreviventes equivalentes ou irrelevantes (G12, G13, G14, G18, G20, G21); 3 mal formadas (G01 a G03 do primeiro rótulo, substituídas pelas versões de rótulo inteiro, mortas).

## Build real do front (item 3)

`cd frontend/web && VITE_SENTRY_DSN=... pnpm build`, três vezes. `dist/` é ignorado (`.gitignore:4`); `git status --porcelain` vazio depois.

| Caso | Saída do gerador | `connect-src` em `dist/_headers` |
| ---- | ---------------- | -------------------------------- |
| DSN válido `https://chave@o1.ingest.us.sentry.io/123` | nenhum aviso, `exit=0` | `connect-src 'self' https://o1.ingest.us.sentry.io;` |
| DSN com `;`: `https://x@a.com;script-src/1` | `[gerar-headers] VITE_SENTRY_DSN ignorado (host inválido); a CSP fica sem o host do Sentry.`, `exit=0` | `connect-src 'self';` |
| Sem DSN (variável vazia) | nenhum aviso, `exit=0` | `connect-src 'self';` |

Nos três casos as linhas que não são comentário são idênticas às de `public/_headers`. **Mas `cmp dist/_headers public/_headers` acusa diferença nos três (char 239, linha 3)**: o `public/_headers` tem bytes Latin-1 soltos no comentário da linha 3 (`ingest\xE3o`, `v\xE1lido`, `est\xE1`, `exce\xE7\xE3o`), num arquivo que no resto é UTF-8. `decode('utf8')` do `public/_headers` no HEAD falha com `invalid continuation byte`; no `393e388` o arquivo era UTF-8 válido. O gerador lê como `utf8`, troca esses bytes por U+FFFD (`efbf bd`) e grava o resultado. O comentário é ignorado pelo Cloudflare, então o efeito prático é estético, mas o arquivo commitado ficou corrompido e o critério "idêntico" falha na letra.

## Integridade dos testes (item 4)

- `git diff d17534b..HEAD -- '*.test.*'`: 7 arquivos, **533 linhas acrescentadas, 0 removidas** (`saude-e-cabecalhos.test.ts` nem aparece mais: o revert da T8 o devolve ao estado de `d17534b`). Nenhum teste apagado, pulado, comentado ou enfraquecido.
- `git diff 393e388..HEAD -- '*.test.*'`: a única remoção é o bloco de 30 linhas do `saude-e-cabecalhos.test.ts` (os 6 testes da T2 revertidos na T8, criados dentro da própria feature, em 743236f). Esperado e registrado. O resto é acréscimo: `conferir-banco.test.ts` +28, `scripts-package.test.ts` +23, `gerar-headers.test.mjs` +58.
- A contagem fecha: 3889 antes, menos 6 (API 686 → 680), mais 4 (scripts 487 → 491) e mais 18 (web 2106 → 2124, o novo `gerar-headers.test.mjs`) = 3905.

## `tasks.md` (item 5)

11 tarefas (T1 a T11). Estimativas todas ≤ 2 h (`tasks.md:92,113,139,161,183,206,228,251,272,295,317`: 1h, 2h, 2h, 2h, 1,5h, 2h, 30 min, 30 min, 2h, 1h, 30 min). `python .claude/skills/tlc-spec-driven/scripts/validate_tasks.py publicacao-repositorio`: **0 erros, 1 aviso** (T7, `Tests: none`, esperado: a matriz de cobertura diz `none` para documentação).

## Gate

`pnpm lint && pnpm typecheck && EXIGIR_BANCO=1 pnpm test` na árvore real, um processo por vez, Postgres 18 na 55432.

| Pacote | Arquivos | Testes | Falhas |
| ------ | -------- | ------ | ------ |
| contrato | 11 | 116 | 0 |
| scripts | 29 | 491 | 0 |
| dominio | 14 | 494 | 0 |
| frontend/web | 220 | 2124 | 0 |
| api | 54 | 680 | 0 |
| **Total** | **328** | **3905** | **0** |

`lint` e `typecheck` com saída 0. Nenhum teste instável falhou nesta rodada. A trava `trava-testes.py --rodar` não foi rodada por mim (registra estado de commit).

## Achados em ordem de gravidade

1. **(Maior) `public/_headers` com bytes inválidos em UTF-8**, e por isso o `dist/_headers` sem DSN não é idêntico ao original. `frontend/web/public/_headers:3`, commit e2764b3. Falta também um teste que compare o arquivo gerado byte a byte (hoje os dois lados são lidos como texto). **Correção proposta**: regravar a linha 3 em UTF-8 e acrescentar um teste que roda o gerador e compara o `Buffer` de `dist/_headers` com o de `public/_headers` sem DSN.
2. **(Maior) A linha de comando do gerador não tem teste** (`gerar-headers.mjs`, bloco `if (process.argv[1] === ...)`): C01 a C06 sobrevivem. Sem teste, o aviso pode sumir, a variável pode ser lida errada ou o arquivo pode nem ser gravado, e o `build` continua verde. **Correção proposta**: teste que executa `node scripts/gerar-headers.mjs` com `VITE_SENTRY_DSN` válido, com `;` e ausente, afirmando o `connect-src`, o aviso no `stderr` e o arquivo gravado (origem e destino configuráveis, ou rodar sobre o `dist/` ignorado).
3. **(Médio) Três lacunas na validação do host**: G15 (âncora inicial; caso `https://x@a;b.com/1`), G19 (`"`) e G22 (`,`). **Correção proposta**: acrescentar esses três DSNs ao `it.each` de recusa.
4. **(Menor) Equivalentes** G12 a G14, G18, G20: a defesa é redundante com `new URL` e a regex; sem tarefa.
5. **Observações herdadas, sem tarefa**: banco virgem dá mensagem genérica em `conferir-banco`; `IGNORAR_ROLES`; checkout com CRLF no Windows (a cópia isolada com `core.autocrlf=false` rodou limpa).

## Resumo da reverificação

**Geral**: ⚠️ FAIL (2 lacunas na T9; T8, T10 e T11 completas).
**Critérios**: T8, T10, T11 e T1 a T7 com evidência; T9 com o critério "idêntico" falho no build real e a injeção parcial.
**Sensor**: 54 mutações, 36 mortas, 9 vivas relevantes, 6 equivalentes ou irrelevantes, 3 mal formadas e descartadas.
**Gate**: 3905 passaram, 0 falharam.
**Próximo passo**: Fix A (encoding do `_headers` e teste byte a byte), Fix B (teste da linha de comando), Fix C (3 DSNs a mais no `it.each`); depois nova rodada só nos mutantes C01 a C06, G15, G19 e G22.
