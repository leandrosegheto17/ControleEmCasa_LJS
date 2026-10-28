# publicacao-infra Validação (parcial: T6 e T12)

**Data**: 2026-10-28
**Spec**: `.specs/features/publicacao-infra/tasks.md` (não há `spec.md` na pasta; a fonte da verdade são os "Done when" de T6 e T12)
**Diff range**: `a1bf1ea^..a1bf1ea` (T6) e `697a921^..697a921` (T12), com HEAD em `a8fa5fa`
**Verificador**: subagente independente (autor ≠ verificador)

## Validation: publicacao-infra (T6 e T12) - PASS

**Escopo**: este relatório cobre só as tarefas de código T6 e T12. As demais tarefas da 17b (ações do usuário, evidências, T14 adiada, 17c) não foram avaliadas aqui.

---

## Conclusão das tarefas

| Tarefa | Status | Notas |
| ------ | ------ | ----- |
| T6  | ✅ Feita | `a1bf1ea`: `wrangler.jsonc`, `wrangler-dominio.test.ts` (+12), `cache-hyperdrive.test.ts` (1 teste invertido) |
| T12 | ✅ Feita | `697a921`: `segredos-workflows.test.ts` (novo, 83 linhas), `docs/runbook.md` (+26, tabela entre marcadores) |

---

## Critérios de aceite (Done when)

### T6: Id real do Hyperdrive

| Critério | Resultado esperado | `arquivo:linha` + asserção | Resultado |
| -------- | ------------------ | -------------------------- | --------- |
| Teste novo falha com o id fictício (`/^0+$/`) e passa com o real | id 32 hex e não só zeros | `backend/scripts/src/operacao/wrangler-dominio.test.ts:19` `expect(h!.id).toMatch(/^[0-9a-f]{32}$/)` e `:20` `expect(h!.id).not.toMatch(/^0+$/)`. Mutação M1 (id fictício) falha; o real passa. | ✅ PASS |
| `localConnectionString` continua local | aponta para localhost | `wrangler-dominio.test.ts:21` `expect(h!.localConnectionString).toMatch(/@localhost:\d+\//)`; `:16` `toHaveLength(1)`; `:18` binding `HYPERDRIVE`. Mutação M3 (host remoto) falha. | ✅ PASS |
| Comentário do `wrangler.jsonc` sobre o id fictício atualizado | não diz mais "fictício" | `wrangler.jsonc:4` e `wrangler.jsonc:20` ("é o real (17b T5)", "Id do Hyperdrive `controle` de produção, sem cache"); nenhum comentário de id fictício restante. Sem asserção (critério de texto), conferido no diff. | ✅ PASS |
| Um teste existente alterado, com aprovação, sem afrouxar a exigência | exigência igual ou mais rígida | `cache-hyperdrive.test.ts:56-61`: antes `toThrow(/fictício/)` sobre o `wrangler.jsonc` real; agora `idDoHyperdrive(real)` não lança, `:59` `toMatch(/^[0-9a-f]{32}$/)`, `:60` `not.toMatch(/^0+$/)`. É mais estrita (o id agora é exigido, antes só se exigia o erro). O teste `cache-hyperdrive.test.ts:50-54` (`idDoHyperdrive` recusa só zeros, formato e quantidade) ficou intacto. Mutações M1 e M2 falham nele. | ✅ PASS |
| Gate quick verde | suíte do pacote verde | `pnpm --filter @controle/scripts test`: 33 arquivos, 526 testes, 0 falhas | ✅ PASS |

Id no `wrangler.jsonc:21` (`8ebd63783fae414eb31b4d2f14a48bfb`) igual ao registrado em `evidencias.md` (linha da T5), 32 hex.

### T12: Consistência da lista de segredos

| Critério | Resultado esperado | `arquivo:linha` + asserção | Resultado |
| -------- | ------------------ | -------------------------- | --------- |
| Falha quando um workflow lê secret ou variável fora da lista | `foraDaLista` lista o item novo | `backend/scripts/src/operacao/segredos-workflows.test.ts:63` `expect(d.foraDaLista).toEqual(['secret:NOVO_SEGREDO', 'variavel:NOVA_VAR'])` e `:64` `semLeitor` vazio; teste contra os arquivos reais em `:57` `toEqual({ foraDaLista: [], semLeitor: [] })`. Mutações M4 e M5 (secret e variável extras em `purga.yml` e `backup.yml`) derrubam `:57`. | ✅ PASS |
| Falha quando o runbook cita um que nenhum workflow lê | `semLeitor` lista o item | `segredos-workflows.test.ts:73` `expect(d.semLeitor).toEqual(['secret:SEGREDO_FANTASMA'])` e `:74` `foraDaLista` vazio. Mutação M6 (item órfão no runbook) derruba `:57`. | ✅ PASS |
| Extrai todo `secrets.*` e `vars.*` de `deploy.yml`, `backup.yml`, `purga.yml` | lista real = runbook (13 itens) | `segredos-workflows.test.ts:56` `expect(lidos.size).toBeGreaterThan(0)` e `:57`. Conferido à mão: os `grep` dos 3 workflows batem com a tabela de `docs/runbook.md:~230-243`. Tipo trocado (M8) também falha. | ✅ PASS |
| Ignora `GITHUB_TOKEN`, `github.*` e comentários | só `variavel:X_1` | `segredos-workflows.test.ts:81` `expect([...lidos]).toEqual(['variavel:X_1'])`. Mutação M9 (acrescentar `secrets.GITHUB_TOKEN`) continua verde, como esperado; M8 (comentar o único uso de `PURGA_ATIVA`) falha. | ✅ PASS |
| Nenhum teste existente alterado | só arquivo novo de teste | `git show --stat 697a921`: `segredos-workflows.test.ts` (novo), `docs/runbook.md`, `tasks.md`. Nenhum `*.test.ts` existente tocado. | ✅ PASS |
| Gate quick verde | suíte do pacote verde | mesma execução: 33 arquivos, 526 testes, 0 falhas | ✅ PASS |

**Status**: ✅ Todos os critérios de T6 e T12 cobertos, com resultado igual ao definido em `tasks.md`. Nenhuma lacuna de precisão: os "Done when" definem valores verificáveis (regex do id, itens exatos).

---

## Integridade dos testes

- T6: único teste existente alterado é `cache-hyperdrive.test.ts:56` (`git diff a1bf1ea^ a1bf1ea`), com aprovação registrada na tarefa e no commit; a exigência subiu, não caiu. `wrangler-dominio.test.ts` só ganhou um `describe` novo (+12 linhas, nada removido).
- T12: nenhum teste existente alterado.
- Contagem: nenhum teste apagado, pulado ou comentado nos dois commits.

---

## Gate

| Comando | Resultado |
| ------- | --------- |
| `pnpm --filter @controle/scripts test` (gate quick do `tasks.md`) | 33 arquivos, 526 testes passaram, 0 falharam, 0 pulados |
| `vitest run` dos 3 arquivos das tarefas (`segredos-workflows`, `wrangler-dominio`, `cache-hyperdrive`) | 3 arquivos, 20 testes passaram |

---

## Sensor de discriminação

Cópia isolada: `git worktree` temporário (HEAD `a8fa5fa`), com junção para os `node_modules`. Baseline verde na cópia. Depois de cada mutação, `git checkout -- .` na cópia. Edições feitas com script Python que preserva CRLF (a primeira rodada com `sed` não casou acentos em M6 e M7 e foi refeita).

| # | Arquivo (na cópia) | Mutação | Morta? |
| - | ------------------ | ------- | ------ |
| M1 | `wrangler.jsonc:21` | id real trocado pelo fictício (32 zeros) | ✅ Morta (2 testes: `wrangler-dominio.test.ts:15` e `cache-hyperdrive.test.ts:56`) |
| M2 | `wrangler.jsonc:21` | id com 31 hex (fora do formato) | ✅ Morta (os mesmos 2 testes) |
| M3 | `wrangler.jsonc:22` | `localConnectionString` apontando para host remoto | ✅ Morta (`wrangler-dominio.test.ts:15`) |
| M4 | `.github/workflows/purga.yml` | `secrets.SEGREDO_NOVO` extra | ✅ Morta (`segredos-workflows.test.ts`, incluindo `:54`) |
| M5 | `.github/workflows/backup.yml` | `vars.VAR_NOVA` extra | ✅ Morta |
| M6 | `docs/runbook.md` | item `ORFA` no runbook que nenhum workflow lê | ✅ Morta |
| M7 | `docs/runbook.md` | remove `PURGA_ATIVA` da lista (workflow ainda lê) | ✅ Morta |
| M8a | `docs/runbook.md` | `NEON_API_KEY` com tipo trocado (secret para variável) | ✅ Morta |
| M8b | `.github/workflows/purga.yml` | único uso de `vars.PURGA_ATIVA` vira comentário | ✅ Morta (runbook cita item sem leitor) |
| M9 | `.github/workflows/purga.yml` | acrescenta `secrets.GITHUB_TOKEN` (controle: deve continuar verde) | ✅ Verde, como previsto |

**Profundidade**: leve, com 9 mutações de comportamento (acima do mínimo de 1 a 3, mais perto do P0 por serem de segurança de configuração).
**Resultado**: 9/9 mortas, 0 sobreviventes - PASS ✅

**Isolamento**: `git status --porcelain` da árvore real vazio antes e depois (idêntico). Cópia removida com `git worktree remove --force` e `git worktree prune`; `git worktree list` mostra só a árvore principal. Os `node_modules` reais seguem intactos (testes rodaram de novo depois).

---

## Observações (não bloqueiam)

1. A tabela do runbook já inclui `ASAAS_API_KEY`, `ASAAS_API_URL`, `VITE_SENTRY_DSN`, `DEPLOY_ATIVO`, `BACKUP_ATIVO` e `PURGA_ATIVA`, que a T10 (`tasks.md` ~343) manda ficar de fora ou vêm de T14/T15 e 17c. Isso é coerente, porque a lista é "o que os workflows leem", e não "o que a T10 gravou". Quem for configurar o GitHub deve usar a tabela, não só a T10.
2. Limite conhecido do extrator de T12: só vê `secrets.NOME` e `vars.NOME`; formas como `secrets['NOME']` ou `toJSON(secrets)` não seriam detectadas. Nenhum workflow atual as usa. Não há critério da tarefa que exija isso.
3. T6 só prova que o id é de formato real, não que existe na Cloudflare. A prova de existência e do cache desligado vem do passo `cache-hyperdrive` do deploy (17c) e da evidência da T5.

## Perguntas para o usuário

Nenhuma.
