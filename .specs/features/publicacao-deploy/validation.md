# publicacao-deploy Validação (parcial: T17)

**Data**: 2026-10-29
**Spec**: `.specs/features/publicacao-deploy/tasks.md` (não há `spec.md` na pasta; a fonte da verdade são os "Done when" da T17, em `tasks.md:283-286`)
**Diff range**: `bda98a2^..bda98a2` (T17), com HEAD em `3d24e42`
**Verificador**: subagente independente (autor ≠ verificador)

## Validation: publicacao-deploy (T17) - PASS

**Escopo**: este relatório cobre só a tarefa de código T17 (etapa 17c). As demais tarefas (ações do usuário, medições, evidências) não foram avaliadas aqui. Também foi conferida a edição de comentário de `medir-cpu-publicado.ts` do commit `3d24e42`.

---

## Conclusão das tarefas

| Tarefa | Status | Notas |
| ------ | ------ | ----- |
| T17 | ✅ Feita | `bda98a2`: `deploy.yml` (+5/-2), `deploy-workflow.test.ts` (+28/-2), `operacao/conferir-asaas-url.ts` (novo), `operacao/conferir-asaas-url.test.ts` (novo), `backend/scripts/package.json` (+1 script), `docs/runbook.md`, `wrangler.jsonc` (comentário) |

---

## Critérios de aceite (Done when)

| Critério | Resultado esperado | `arquivo:linha` + asserção | Resultado |
| -------- | ------------------ | -------------------------- | --------- |
| 1a. `deploy.yml` lê `ASAAS_API_URL` de `vars.ASAAS_API_URL` | variável do environment `producao`, sem valor fixo | `.github/workflows/deploy.yml:71` `ASAAS_API_URL: ${{ vars.ASAAS_API_URL }}` (env do job `publicar`, que tem `environment: producao`); prova: `backend/scripts/src/deploy-workflow.test.ts:134` `expect(publicar).toMatch(/^ {6}ASAAS_API_URL: \$\{\{ vars\.ASAAS_API_URL \}\}$/m)`, `:135` `expect(semComentarios.match(/ASAAS_API_URL:\s/g)).toHaveLength(1)`, `:136` `expect(semComentarios).not.toMatch(/https?:\/\/api(-sandbox)?\.asaas\.com/)`, `:130` `--var "ASAAS_API_URL:${ASAAS_API_URL}"` na publicação | ✅ PASS |
| 1b. Falha antes de qualquer passo de produção se o valor não for um dos dois | passo 0 depois do `pnpm install` e antes de build, cache, dump, migração e publicação; sem `secrets.`, `if:` nem `continue-on-error` | `deploy.yml:84-85` (passo 0); `deploy-workflow.test.ts:141-150` `expect(instalar).toBeLessThan(conferir)` e `for (const p of producao) expect(conferir).toBeLessThan(p)`; `:153-155` `expect(passo).not.toMatch(/secrets\.|if:|continue-on-error/)`; `:152` `expect(inicio).toBeGreaterThan(instalar)` | ✅ PASS |
| 1c. Variável vazia também falha | `''` e ausente recusados; `main` devolve 1 com `::error` | `operacao/conferir-asaas-url.ts:18` `valor === undefined \|\| !ASAAS_URLS_PERMITIDAS.includes(valor)`; testes: `conferir-asaas-url.test.ts:45` `expect(() => conferirAsaasUrl(valor)).toThrow(/ASAAS_API_URL/)` (casos `ausente` `:27`, `vazio` `:28`, `só espaço` `:29`); `:64` `expect(main(ambiente)).toBe(1)` (casos `ausente` `:58`, `vazio` `:59`); `:65` `expect(erro).toHaveBeenCalledTimes(1)`; `:67` `toMatch(/^::error title=[^:]+::/)` | ✅ PASS |
| 1d. Só aceita exatamente os dois endereços | lista = `https://api.asaas.com/v3` e `https://api-sandbox.asaas.com/v3` | `conferir-asaas-url.ts:11-14` (lista); `conferir-asaas-url.test.ts:19` `expect([...ASAAS_URLS_PERMITIDAS].sort()).toEqual([SANDBOX, PRODUCAO].sort())` | ✅ PASS |
| 1e. Passo ligado ao comando | `pnpm --filter @controle/scripts conferir-asaas-url` aponta para o arquivo | `backend/scripts/package.json:21`; `conferir-asaas-url.test.ts:81` `expect(scripts['conferir-asaas-url']).toBe('tsx src/operacao/conferir-asaas-url.ts')` e `:82` `existsSync(...)` | ✅ PASS |
| 2. Teste existente alterado só no que muda, com motivo no commit | endereço fixo vira "vem da variável"; nada apagado, pulado ou enfraquecido | `git show bda98a2 -- backend/scripts/src/deploy-workflow.test.ts`: o único `it` alterado é o da publicação (título trocado "ASAAS_API_URL de produção" para "da variável"); a única asserção removida é `toMatch(/ASAAS_API_URL: https:\/\/api\.asaas\.com\/v3\n/)` (`-1`), trocada por 3 asserções mais rígidas (`:134-136`); as demais `expect` do `it` ficaram (`:127-133`). Um `it` novo foi acrescentado (`:139`). Nenhum `.skip`, `.todo` ou comentário de teste. Motivo e aprovação do usuário (2026-10-28) no corpo do commit e em `deploy-workflow.test.ts:123-124` | ✅ PASS |
| 3. Testes novos: aceitos (produção e sandbox) | `conferirAsaasUrl(v)` devolve `v`; `main` devolve 0 sem `::error` | `conferir-asaas-url.test.ts:22-23` `it.each([PRODUCAO, SANDBOX])` `expect(conferirAsaasUrl(valor)).toBe(valor)`; `:50-54` `expect(main({ ASAAS_API_URL: valor })).toBe(0)` e `expect(erro).not.toHaveBeenCalled()` | ✅ PASS |
| 3. Testes novos: recusados (vazio, `http://`, host diferente, barra final) | lança com `ASAAS_API_URL` na mensagem; `main` devolve 1 | `conferir-asaas-url.test.ts:28` vazio; `:30-31` http (produção e sandbox); `:32-33` host diferente; `:34-35` barra final; além disso `:36-44` espaço no fim e no início, `\n` no fim, sem `/v3`, `/v2`, maiúsculas, porta, credencial; todos por `:45` `toThrow(/ASAAS_API_URL/)`. Mensagem lista os dois endereços e não repete o valor recebido: `:68-71` | ✅ PASS |
| 4. Suíte dos scripts verde | 0 falhas | `pnpm --filter @controle/scripts test` na cópia isolada de HEAD (`3d24e42`): 24 arquivos passaram, 12 pulados; 297 testes passaram, 297 pulados, 0 falharam (os pulados são `describe.skipIf(!temBanco)`, que exigem Postgres real; ver observação 3). Os dois arquivos da T17 sozinhos: 46 de 46 | ✅ PASS (gate do pacote) |

**Status**: ✅ Todos os critérios cobertos, com resultado igual ao definido em `tasks.md`. Nenhuma lacuna de precisão: os "Done when" definem valores verificáveis (os dois endereços, os casos de recusa).

Sobre a parte "trava de testes verde com tudo commitado" do 4º critério (`tasks.md:286` ainda desmarcado): não rodei a suíte inteira do monorepo, como combinado; o pedido informa que ela está verde pela trava no commit `f8c9358`. Isso é declaração do pedido, não medida minha.

---

## Implementações erradas plausíveis que ainda passariam

Procurei por: aceitar prefixo, ignorar espaços, comparar sem o `/v3`, tolerar barra final, ignorar maiúsculas, fallback para produção quando a variável é vazia, aceitar vazio, mensagem repetindo o valor, passo fora de ordem ou com `continue-on-error`/`if: always()`. Todas foram injetadas e morreram (tabela abaixo). Nenhuma sobreviveu.

---

## Sensor de discriminação

Cópia isolada: `git worktree` temporário em HEAD (`3d24e42`) com `pnpm install --frozen-lockfile --offline`; cada mutação aplicada, `pnpm --filter @controle/scripts test` executado e o arquivo restaurado antes da próxima. A cópia foi apagada ao fim (`git worktree list` só mostra a árvore real). A árvore real ficou com `git status --porcelain` vazio, igual ao início.

| # | Arquivo | Mutação | Resultado do teste | Morta? |
| - | ------- | ------- | ------------------ | ------ |
| M1 | `conferir-asaas-url.ts:18` | `includes(valor)` vira `some(u => valor.startsWith(u))` (aceita prefixo) | 5 falharam | ✅ |
| M2 | `conferir-asaas-url.ts:18` | `includes(valor.trim())` (ignora espaços) | 3 falharam | ✅ |
| M3 | `conferir-asaas-url.ts:12` | produção sem `/v3` (`https://api.asaas.com`) | 8 falharam | ✅ |
| M4 | `conferir-asaas-url.ts:18` | aceita vazio (`valor !== '' && ...`) | 3 falharam | ✅ |
| M5 | `conferir-asaas-url.ts` `main` | `return 1` vira `return 0` no erro | 4 falharam | ✅ |
| M6 | `conferir-asaas-url.ts:20` | mensagem de erro repete o valor recebido | 2 falharam | ✅ |
| M7 | `conferir-asaas-url.ts:13` | retira o sandbox da lista | 8 falharam | ✅ |
| M8 | `conferir-asaas-url.ts:12` | retira a produção da lista | 7 falharam | ✅ |
| M9 | `conferir-asaas-url.ts:18` | `toLowerCase()` (ignora maiúsculas) | 1 falhou | ✅ |
| M10 | `conferir-asaas-url.ts:18` | tolera barra final (`replace(/[/]$/, '')`) | 3 falharam | ✅ |
| M11 | `conferir-asaas-url.ts` `main` | `main` não chama `conferirAsaasUrl` (lê o valor direto) | 4 falharam | ✅ |
| M12 | `conferir-asaas-url.ts` `main` | remove o prefixo `::error title=...::` | 4 falharam | ✅ |
| M13 | `deploy.yml:84-85` | remove o passo 0 | 1 falhou | ✅ |
| M14 | `deploy.yml:71` | volta ao valor fixo de produção | 1 falhou | ✅ |
| M15 | `deploy.yml:71` | `${{ vars.ASAAS_API_URL \|\| 'https://api.asaas.com/v3' }}` (fallback quando vazio) | 1 falhou | ✅ |
| M16 | `deploy.yml:84` | `continue-on-error: true` no passo 0 | 2 falharam | ✅ |
| M17 | `deploy.yml:84` | `if: always()` no passo 0 | 1 falhou | ✅ |
| M18 | `deploy.yml:84` | passo 0 depois do build | 1 falhou | ✅ |
| M19 | `deploy.yml:82-84` | passo 0 antes da instalação | 1 falhou | ✅ |
| M20 | `deploy.yml:119` | publicação sem `--var "ASAAS_API_URL:..."` | 1 falhou | ✅ |
| M21 | `deploy.yml:71` | `secrets.ASAAS_API_URL` no lugar de `vars.` | 5 falharam | ✅ |
| M22 | `deploy.yml:84` | passo 0 com `secrets.CLOUDFLARE_API_TOKEN` | 1 falhou | ✅ |
| M23 | `package.json:21` | script aponta para outro arquivo | 1 falhou | ✅ |
| M24 | `conferir-asaas-url.ts:33` | remove `if (import.meta.main)` (o script nunca executaria `main`) | 1 falhou | ✅ |

**Profundidade do sensor**: P0 completo (tarefa de risco alto)
**Resultado**: 24/24 mortas, 0 sobreviveram - PASS ✅

(A primeira passada de M4 quebrou a sintaxe e a suíte caiu antes de rodar os testes; por isso M4 foi refeita com mutação válida, e o resultado acima é o da segunda passada. M7, M8 e M24 foram refeitas porque o arquivo `.ts` tem CRLF e o padrão não casou na primeira passada.)

---

## Edição de comentário em `medir-cpu-publicado.ts` (commit `3d24e42`)

`git show 3d24e42 -- backend/scripts/src/operacao/medir-cpu-publicado.ts`: 4 linhas removidas e 4 acrescentadas, todas dentro de comentários JSDoc (o cabeçalho "[A VALIDAR NA 17C]" virou "Validado na 17c (2026-10-29)" e o comentário de `CONSULTA`). `CONSULTA`, `lerResposta` e demais linhas de código ficaram intactos. Comportamento não mudou; a suíte dos scripts inclui `medir-cpu-publicado.test.ts` e passou.

---

## Qualidade do código

| Princípio | Estado |
| --------- | ------ |
| Mensagem de erro não repete o valor vindo de fora (nada externo vira comando do workflow no log) | ✅ `conferir-asaas-url.ts:20`, provado em `conferir-asaas-url.test.ts:70-71` |
| Passo sem segredo, sem `if`, sem `continue-on-error` | ✅ `deploy-workflow.test.ts:155` |
| Comparação exata (sem normalização) | ✅ `includes` sobre lista fixa |
| Sem teste apagado, pulado ou enfraquecido | ✅ conferido no diff de `bda98a2` |

---

## Observações (não bloqueiam o PASS)

1. **Lacuna residual de teste, baixa gravidade**: nenhum teste executa o passo 0 de ponta a ponta no runner (impossível sem o GitHub Actions); a prova é o texto do `deploy.yml` mais a lógica de `main`. O primeiro deploy real com `vars.ASAAS_API_URL` vazia seria a prova definitiva (a variável precisa existir no environment `producao`; runbook, seção 7).
2. **`tasks.md` repete o mesmo conteúdo três vezes**: `## Task Breakdown` aparece em `tasks.md:89`, `:376` e `:744` (arquivo com 1167 linhas), e a T17 aparece em `:271`, `:558` e `:926`, com texto idêntico. Defeito de formato do artefato, anterior a este relatório e fora do código; pode confundir quem marca tarefas.
3. **Suíte "verde" inclui 297 testes pulados** (exigem Postgres real, `describe.skipIf(!temBanco)`, por exemplo `banco.test.ts:73`). `tasks.md:286` cita 554 testes; aqui rodam 297 e 297 são pulados (594 no total), por falta de banco nesta máquina. Os testes da T17 não dependem de banco e rodaram todos.
4. **Teste da ordem fixa já divergiu do commit da T17**: em `bda98a2` o teste novo ainda procurava `restauracao-neon`; os commits `02b0e15` e `165ec6e` (posteriores, fora do escopo) o ajustaram quando a branch de restauração saiu. A validação foi feita em HEAD, onde tudo passa.
