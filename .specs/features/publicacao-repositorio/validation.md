# Publicação 17a: repositório pronto para produção — Validação

**Data**: 2026-10-27
**Spec**: `.specs/features/publicacao-repositorio/tasks.md` (não há `spec.md`; a fonte da verdade são os `Done when` de T1 a T14)
**Verificador**: subagente independente (autor ≠ verificador)
**Histórico**: as duas rodadas anteriores (FAIL por lacunas de teste, fechadas pelas tarefas T8 a T14) estão em `validation-historico.md`.

## Validation: publicacao-repositorio — PASS ✅

Veredito corrente, depois de três rodadas de verificação. Evidências file:line na tabela abaixo; o sensor de discriminação da última rodada matou 10 de 10 mutações, e o gate completo esteve verde (trava de testes registrada no commit `eee51c6`).

---

## Reverificação final (T12 a T14): detalhe

**Verificador**: subagente independente (não escreveu o código). **Commits**: feb480f (T12), 7559c01 (T13), eee51c6 (T14), sobre 7b7a8fa. As 3 lacunas da rodada anterior estão fechadas: o `public/_headers` voltou a UTF-8 e o teste compara bytes, a linha de comando do gerador tem teste (C01 a C06 mortos) e os três DSNs de host (`;` com sufixo válido, `"`, `,`) são recusados em teste novo (G15, G19, G22 mortos).

### Critérios `Done when` → evidência

| Tarefa | Critério | Evidência | Resultado |
| ------ | -------- | --------- | --------- |
| T12 | `public/_headers` é UTF-8 válido (`TextDecoder` fatal) | `gerar-headers.test.mjs`, bloco `codificação do public/_headers`: `expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes)).not.toThrow()`; `git show feb480f` troca os bytes Latin-1 da linha 3 por `ingestão`, `válido`, `está`, `exceção` | ✅ |
| T12 | Teste compara `Buffer` original x gerado sem DSN e falha com Latin-1 | mesmo bloco: `it.each([undefined, '', 'isso nao e url'])` com `expect(Buffer.from(conteudo, 'utf8').equals(bytes)).toBe(true)`. Mutante L1 (arquivo regravado em Latin-1 na cópia): 7 testes falham | ✅ |
| T12 | Gate quick (pacote web) | `frontend/web` `vitest run`: 221 arquivos, 2135 testes, 0 falhas (2124 anteriores + 4 da CLI + 7 de T12/T14) | ✅ |
| T13 | DSN válido: `https://<host>` no `connect-src`, sem aviso | `gerar-headers-cli.test.mjs`, teste "DSN válido": `expect(r.stderr).toBe('')` e `expect(r.saida.toString('utf8')).toBe(original...replace("connect-src 'self'", "connect-src 'self' https://o1.ingest.us.sentry.io"))` | ✅ |
| T13 | DSN com `;`: idêntico ao original e aviso no `stderr` | teste "DSN com ponto e vírgula": `expect(r.stderr).toContain('[gerar-headers] VITE_SENTRY_DSN ignorado')`, `expect(r.saida.equals(original)).toBe(true)` | ✅ |
| T13 | Sem DSN: idêntico, sem aviso; lê `VITE_SENTRY_DSN` e não `SENTRY_DSN` | testes "sem DSN" (`stderr` vazio, `equals(original)`) e "lê VITE_SENTRY_DSN e não SENTRY_DSN" (só `SENTRY_DSN` na env espera o original e `stderr` vazio) | ✅ |
| T13 | C01 a C06 fazem o teste falhar | tabela de mutantes abaixo: 6 de 6 mortos | ✅ |
| T13 | Gate quick | o mesmo run do pacote web (processo filho com `env` mínimo, pasta temporária apagada no `finally`) | ✅ |
| T14 | 3 DSNs recusados com aviso e `connect-src` fica `'self'` | `gerar-headers.test.mjs`, bloco `host do DSN: âncora inicial, aspas e vírgula`: `expect(aviso).toMatch(/VITE_SENTRY_DSN ignorado/)`, `expect(conteudo).toBe(original)`, `expect(cspDe(conteudo)).toContain("connect-src 'self';")` para `https://x@a;b.com/1`, `https://x@a".com/1`, `https://x@a,b.com/1` | ✅ |
| T14 | Cada teste falha com o estrago correspondente | G15, G19, G22 mortos (tabela abaixo) | ✅ |
| T14 | Nenhum teste existente alterado | `git diff 7b7a8fa..HEAD --numstat -- '*.test.*'`: `gerar-headers-cli.test.mjs` +57/-0 (novo) e `gerar-headers.test.mjs` +29/-0; nenhuma linha removida, nenhum arquivo apagado | ✅ |
| T14 | Gate quick | idem | ✅ |

Observação: a âncora inicial `^` da regex do host **já estava** no `gerar-headers.mjs` antes de eee51c6; esse commit só acrescentou testes (o gerador não mudou nele). O critério de comportamento vale do mesmo jeito, e a mutação G15 (remover o `^`) mostra que o teste novo é quem protege a âncora.

## Evidência por arquivo:linha (levantada pela sessão principal no commit eee51c6)

| Critério | Evidência |
| -------- | --------- |
| T12: `public/_headers` é UTF-8 válido | `frontend/web/scripts/gerar-headers.test.mjs:69` e `:70` (decodificação fatal) |
| T12: gerado sem DSN idêntico ao original, byte a byte | `frontend/web/scripts/gerar-headers.test.mjs:73` a `:77` (`Buffer.equals`) |
| T13: DSN válido grava `https://<host>`, sem aviso | `frontend/web/scripts/gerar-headers-cli.test.mjs:29` |
| T13: DSN com `;` grava o original e avisa no `stderr` | `frontend/web/scripts/gerar-headers-cli.test.mjs:38` |
| T13: sem DSN grava o original, sem aviso | `frontend/web/scripts/gerar-headers-cli.test.mjs:45` |
| T13: lê `VITE_SENTRY_DSN`, não `SENTRY_DSN` | `frontend/web/scripts/gerar-headers-cli.test.mjs:52` |
| T14: âncora, aspas e vírgula no host recusadas | `frontend/web/scripts/gerar-headers.test.mjs:53` a `:64` |
| Padrão de produção intacto (variáveis opcionais) | `frontend/web/scripts/gerar-headers.mjs:41` e `:42` |
| `build` roda o gerador depois do vite | `frontend/web/package.json:11` e `frontend/web/scripts/gerar-headers.test.mjs:83` |

### Mutantes

Cópia isolada: `git worktree` em pasta temporária fora do projeto (`node_modules` por junção, removida antes de apagar a cópia), linha de base na cópia com 41 testes verdes em `scripts/`. Cópia apagada, `git worktree prune` feito, `git status --porcelain` da árvore real vazio antes e depois.

| # | Falha injetada | Teste que mata | Resultado |
| - | -------------- | -------------- | --------- |
| L1 | `public/_headers` regravado em Latin-1 (bytes inválidos) | 7 falhas: `é UTF-8 válido`, 3x `idêntico ao original byte a byte`, e 3 da CLI | ✅ Morto |
| C01 | a CLI não imprime o aviso | CLI: "DSN com ponto e vírgula..." | ✅ Morto |
| C02 | a CLI ignora `VITE_SENTRY_DSN` (passa `undefined`) | CLI: DSN válido e DSN com `;` | ✅ Morto |
| C03 | grava o original em vez do gerado | CLI: "DSN válido..." | ✅ Morto |
| C04 | não grava | CLI: 4 falhas | ✅ Morto |
| C05 | lê `SENTRY_DSN` em vez de `VITE_SENTRY_DSN` | CLI: 3 falhas, entre elas "lê VITE_SENTRY_DSN e não SENTRY_DSN" | ✅ Morto |
| C06 | estrago real: com DSN, grava o DSN inteiro e cru no `connect-src` (`connect-src 'self' <DSN>`) | CLI: "DSN válido" e "DSN com ponto e vírgula" | ✅ Morto |
| G15 | remove o `^` da regex do host | "recusa lixo antes de um sufixo de host válido" e "recusa vírgula" | ✅ Morto |
| G19 | aceita `"` no host (em todas as classes da regex) | "recusa aspas duplas" (só esse falha) | ✅ Morto |
| G22 | aceita `,` no host (em todas as classes) | "recusa vírgula" (só esse falha) | ✅ Morto |

Nota de método: a primeira tentativa de G19 (`"` só no miolo do rótulo) sobreviveu, mas era mutação mal formada: em `a".com` o `"` cai no fim do rótulo, que a regex exige alfanumérico, então a mutação não admitia o DSN. A versão que aceita `"` em todas as classes (a que de fato admite `a".com`) é morta. Uma primeira versão global de G19/G22 também saiu errada (escape `\.` perdido no literal JS, regex virou "qualquer caractere") e foi descartada; a versão final usa `String.raw` e checa que o texto mudou.

**Placar**: 10 mutações válidas, 10 mortas, 0 sobreviveram (2 tentativas mal formadas descartadas).

### Build real do front (`cd frontend/web && pnpm build`, um processo por vez)

| Caso | Saída do gerador | `connect-src` em `dist/_headers` |
| ---- | ---------------- | -------------------------------- |
| `VITE_SENTRY_DSN=https://chave@o1.ingest.us.sentry.io/123` | nenhum aviso | `connect-src 'self' https://o1.ingest.us.sentry.io;` |
| `VITE_SENTRY_DSN=https://x@a.com;script-src/1` | `[gerar-headers] VITE_SENTRY_DSN ignorado (host inválido); a CSP fica sem o host do Sentry.` | `connect-src 'self';`; `cmp public/_headers dist/_headers` sem diferença |
| sem DSN | nenhum aviso, `exit=0` | `connect-src 'self';`; `cmp public/_headers dist/_headers` sem diferença (byte a byte) |

`git check-ignore -v frontend/web/dist/_headers` devolve `.gitignore:4:dist/`. `git status --porcelain` vazio depois.

### Integridade e escopo

- `git diff 7b7a8fa..HEAD -- '*.test.*'`: 2 arquivos, 86 linhas acrescentadas, 0 removidas, nenhum arquivo apagado. Nenhum teste apagado, pulado, comentado ou enfraquecido.
- `gerar-headers.mjs` mudou só nas duas linhas de caminho: `process.env.HEADERS_ORIGEM ?? new URL('../public/_headers', ...)` e `process.env.HEADERS_DESTINO ?? new URL('../dist/_headers', ...)`. O padrão de produção (`public/_headers` para `dist/_headers`) fica igual (confirmado no build real acima).
- `frontend/web/package.json`: `"build": "vite build && node scripts/gerar-headers.mjs"` (gerador depois do `vite build`), também protegido pelo teste existente do script `build`.

### `tasks.md` e gate

- 14 tarefas (`grep -c '^#### T'` = 14); estimativas: 5 de 30 min, 3 de 1h, 1 de 1,5h, 5 de 2h, todas ≤ 2h. `validate_tasks.py publicacao-repositorio`: 0 erros, 1 aviso (T7, `Tests: none`, esperado e herdado). Itens de T12 a T14 marcados `[x]`.
- `pnpm lint` (eslint + prettier): saída 0. `pnpm typecheck`: saída 0.
- Pacote `frontend/web` inteiro: 221 arquivos, 2135 testes, 0 falhas (nenhum instável falhou). Suíte de banco não rodada, por instrução; os pacotes `api`, `scripts`, `dominio` e `contrato` não foram tocados desde 7b7a8fa.

### Achados

1. (Menor, sem tarefa) O texto da T14 pede "ancorar o início da regex", mas a âncora já existia; a tarefa entregou só os testes. Registro para não confundir o histórico.
2. (Menor, sem tarefa) Os equivalentes G12 a G14, G18, G20 e G21 da rodada anterior continuam equivalentes, sem mudança.

### Resumo da Reverificação 2

**Geral**: PASS ✅ (as 3 lacunas fechadas).
**Critérios**: T12, T13 e T14 com evidência localizada e valor esperado conferido.
**Sensor**: 10 mutações, 10 mortas, 0 vivas.
**Gate**: web 2135 passaram, 0 falharam; lint e typecheck 0; validador de tarefas 0 erros.
