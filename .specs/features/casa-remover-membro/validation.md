# Casa: remover membro e sair do lar — Validação

## Validation: casa-remover-membro — PASS ✅

**Data**: 2026-10-29
**Spec**: `.specs/features/casa-remover-membro/spec.md`
**Faixa do diff**: `d99d92c^..c94d532` (8 tarefas, T1 a T8; HEAD `b7b441d`)
**Verificador**: subagente independente (autor ≠ verificador)
**Resultado**: PASS (0 achados bloqueantes, 0 maiores; 3 menores)

Todos os caminhos de teste abaixo são relativos a `frontend/web/`.

---

## Conclusão das tarefas

| Tarefa | Risco | Situação | Notas |
| ------ | ----- | -------- | ----- |
| T1 | baixo | Feita | `src/dados/lar.ts:54-63` |
| T2 | baixo | Feita | `src/rotulos/lar.ts` |
| T3 | alto | Feita | `src/ganchos/useLar.ts:58-94`, `src/ganchos/saidaDaCasa.ts` |
| T4 | alto | Feita | `src/componentes/lar/ListaMembros.tsx` |
| T5 | alto | Feita | `src/paginas/lar/RemoverMembroConectado.tsx`, ligada em `src/paginas/Lar.tsx` |
| T6 | alto | Feita | `src/paginas/lar/SairDaCasaConectado.tsx`, ligada em `src/paginas/Lar.tsx`; aviso em `src/paginas/AreaAutenticada.tsx` |
| T7 | alto | Feita | `e2e/lar.spec.ts:83-140` |
| T8 | alto | Feita | `e2e/lar.spec.ts:143-203` |

Todos os "Done when" de `tasks.md` estão marcados `[x]` e cada um foi rastreado até uma asserção (tabelas abaixo). Nenhum bloqueio ou parcial.

---

## Critérios de aceite ancorados na spec

### P1: Titular remove o membro

| Critério | Resultado definido pela spec | `arquivo:linha` + asserção | Resultado |
| -------- | ---------------------------- | -------------------------- | --------- |
| 1. Titular com outro membro vê "Remover" ao lado desse membro | botão "Remover" na linha do outro membro | `src/paginas/Lar.test.tsx:277` `expect(within(itens[1]!).getByRole('button', { name: 'Remover' })).toBeInTheDocument()`; `src/componentes/lar/ListaMembros.test.tsx:36-38` (um só "Remover", na linha do membro; sem botão na linha do titular `:35`) | ✅ PASS |
| 2. "Remover" abre confirmação destrutiva com nome e os 4 efeitos | título e texto com o nome; efeitos: perde o conjunto, individual some em 30 dias, "Ex-membro", só por novo convite | `src/paginas/Lar.test.tsx:281-285` `toHaveAccessibleName('Remover Beatriz da casa?')` e `toHaveAccessibleDescription('Beatriz perde o acesso ao que é do conjunto da casa. O que é só de Beatriz some em 30 dias. As despesas conjuntas que Beatriz pagou ficam como "Ex-membro". Para voltar, só com um novo convite.')`; `src/rotulos/lar.test.ts:14-18,24-26` (quatro regex) | ✅ PASS |
| 3. Confirmar chama `DELETE /api/lar/membros/:id` com o id, recarrega a lista e avisa "Membro removido" | DELETE com id; lista relida; aviso | `src/paginas/Lar.test.tsx:322` `expect(remocoes()).toEqual([expect.objectContaining({ url: '/api/lar/membros/${ID_BEATRIZ}', metodo: 'DELETE' })])`; `:333` `findByText('Membro removido')`; `:335-336` `membros()).toHaveLength(1)` e `toHaveTextContent('Ana')`; `e2e/lar.spec.ts:100-103` (DELETE, url e cabeçalho; aviso `:95`) | ✅ PASS |
| 4. Cancelar, véu e Esc fecham sem chamar a API | diálogo fechado, zero chamadas | `src/paginas/Lar.test.tsx:289-304` (it.each Cancelar/Esc/véu) `expect(remocoes()).toHaveLength(0)` e `alertdialog` ausente; `e2e/lar.spec.ts:107-120` `expect(escritas.filter(...)).toHaveLength(0)`; véu: `src/componentes/base/DialogoConfirmacao.test.tsx:362-365` | ✅ PASS |
| 5. Em andamento: confirmar inerte, sem segundo envio | um só DELETE; `aria-disabled` durante a chamada | `src/paginas/Lar.test.tsx:315` `expect(confirmar).toHaveAttribute('aria-disabled', 'true')`, `:316-318` segundo clique e Esc ignorados, `:322` exatamente uma chamada (segura a resposta com `segurar`, sem atraso fixo) | ✅ PASS |
| 6. `registro_invalido` recarrega a lista e mostra "Este membro já não está na casa" | aviso exato; lista relida | `src/paginas/Lar.test.tsx:350` `findByText('Este membro já não está na casa')`, `:352` `membros()).toHaveLength(1)`, `:353` sem "Membro removido"; `e2e/lar.spec.ts:133-136` | ✅ PASS |
| 7. Falha de rede/servidor: confirmação aberta com erro, lista inalterada | alerta no diálogo; 2 membros | `src/paginas/Lar.test.tsx:372-377` `within(dialogo).findByRole('alert')).toHaveTextContent(mensagem)` ("Sem conexão. Tente de novo" / "Serviço indisponível no momento. Tente de novo em instantes"), `alertdialog` presente, `membros()).toHaveLength(2)`, `servidor.lar.membros).toHaveLength(2)` | ✅ PASS |
| 8. Sem "Remover" para o titular nem para quem não é titular | nenhum botão | `src/componentes/lar/ListaMembros.test.tsx:35` (linha do titular sem botão) e `:61` (membro: `queryByRole('button', { name: 'Remover' })` ausente); `src/paginas/Lar.test.tsx:400` (página como membro) | ✅ PASS |

### P1: Membro sai da casa

| Critério | Resultado definido pela spec | `arquivo:linha` + asserção | Resultado |
| -------- | ---------------------------- | -------------------------- | --------- |
| 1. Membro não titular vê "Sair da casa" | botão na própria linha | `src/paginas/Lar.test.tsx:471` `within(itens[1]!).getByRole('button', { name: 'Sair da casa' })`; `src/componentes/lar/ListaMembros.test.tsx:58-60` | ✅ PASS |
| 2. Confirmação destrutiva com os 4 efeitos | texto dos efeitos | `src/paginas/Lar.test.tsx:475-479` `toHaveAccessibleName('Sair da casa?')` e `toHaveAccessibleDescription('Você perde o acesso ao que é do conjunto da casa. O que é só seu some em 30 dias. As despesas conjuntas que você pagou ficam como "Ex-membro". Para voltar, só com um novo convite.')`; `src/rotulos/lar.test.ts:28-31` | ✅ PASS |
| 3. Confirmar chama `POST /api/lar/sair`, renova a sessão, vai a `/app/bem-vindo` com "Você saiu da casa" | POST; sessão relida; rota; aviso | `src/paginas/Lar.test.tsx:528` `expect(local()).toBe('/app/bem-vindo')`, `:529` `findByText('Você saiu da casa')`, `:531-533` leituras de `/api/sessao` aumentaram; `:516-517` POST único sem corpo; `e2e/lar.spec.ts:154-162` (URL, aviso, "Criar meu lar", 1 POST, cabeçalho) | ✅ PASS |
| 4. Cancelar, véu e Esc fecham sem chamar a API | zero chamadas; segue em `LAR` | `src/paginas/Lar.test.tsx:483-498` `expect(saidas()).toHaveLength(0)` e `expect(local()).toBe(LAR)`; `e2e/lar.spec.ts:164-181` | ✅ PASS |
| 5. Em andamento: confirmar inerte | um só POST | `src/paginas/Lar.test.tsx:509` `aria-disabled` `'true'`, `:516` `expect(saidas()).toEqual([expect.objectContaining({ url: '/api/lar/sair', metodo: 'POST' })])` | ✅ PASS |
| 6. `registro_invalido` ou `sem_lar`: renova a sessão e segue o destino que ela indicar, sem erro | sessão relida; destino da sessão; sem alerta | `src/paginas/Lar.test.tsx:552-581` (sem_lar → `/app/bem-vindo`; registro_invalido → `LAR`; leitura de sessão aumenta `:567-572`, `expect(local()).toBe(destino)` `:572`, nenhum alerta com texto `:575-577`, sem "Você saiu da casa" `:579`); `src/ganchos/useLar.test.tsx:104` `resolves.toBe('sem_vinculo')` e `invalidada(CHAVE_SESSAO)` | ✅ PASS |
| 7. Falha de rede/servidor: confirmação aberta com erro, membro na casa | alerta; 2 membros; sem saída | `src/paginas/Lar.test.tsx:600-605` `findByRole('alert')).toHaveTextContent(mensagem)`, `local()).toBe(LAR)`, `membros()).toHaveLength(2)`, `servidor.saiuDoLar).toBeFalsy()` | ✅ PASS |
| 8. Sem "Sair da casa" ao titular | nenhum botão | `src/paginas/Lar.test.tsx:614` `queryByRole('button', { name: 'Sair da casa' })).not.toBeInTheDocument()`; `src/componentes/lar/ListaMembros.test.tsx:38` | ✅ PASS |

### P2: Sem conexão

| Critério | Resultado definido pela spec | `arquivo:linha` + asserção | Resultado |
| -------- | ---------------------------- | -------------------------- | --------- |
| 1. Sem conexão, os dois botões desativados e o aviso "Precisa de conexão para esta ação" | `disabled`; texto exato | `src/componentes/lar/ListaMembros.test.tsx:78-87` `expect(botao).toBeDisabled()`, `getByText(AVISO)`, `toHaveAccessibleDescription(AVISO)`; `src/paginas/Lar.test.tsx:419-420` e `:624-625`; `e2e/lar.spec.ts:191-192` (modo offline real do Playwright, `context.setOffline(true)`) | ✅ PASS |
| 2. Remoção e saída nunca vão para a fila offline | nenhuma escrita; mutação roda sem pausa | `src/ganchos/useLar.test.tsx:69-77,126-134` `expect(result.current.isPaused).toBe(false)` com `onlineManager` offline; `src/paginas/Lar.test.tsx:423-424,628-629` (sem diálogo, zero chamadas); `e2e/lar.spec.ts:201` `expect(escritas.filter((e) => e.url.startsWith(rota))).toHaveLength(0)` após voltar a rede | ✅ PASS |

**Situação**: ✅ 18/18 critérios com `arquivo:linha` e valor esperado conforme a spec. Nenhuma lacuna de precisão da spec: todo resultado esperado (textos, rotas, métodos) está definido de forma exata.

### Casos limite

| Caso limite | Evidência | Situação |
| ----------- | --------- | -------- |
| Titular sozinho: nenhum botão de remoção ou saída | `src/componentes/lar/ListaMembros.test.tsx:46-50` `queryByRole('button')` ausente e sem aviso; `src/paginas/Lar.test.tsx:408-409` | ✅ |
| Depois de remover, volta o formulário de convite (RN-23) | `src/paginas/Lar.test.tsx:338` `expect(await campo()).toBeInTheDocument()`; `e2e/lar.spec.ts:98` `getByLabel('E-mail de quem vai participar')).toBeVisible()` | ✅ |
| Sessão expirada na ação: tratamento existente, sem repetir a chamada | `src/paginas/Lar.test.tsx:440-441` (`local()` casa `/^\/entrar\?volta=/`, `remocoes()).toHaveLength(1)`) e `:645-646` (`saidas()).toHaveLength(1)`) | ✅ |

---

## Sensor de discriminação

Cópia isolada: `git worktree` temporário (detached em `b7b441d`) com junções para `node_modules`; removido ao fim (`git worktree list` volta a mostrar só a árvore real). `git status --porcelain` da árvore real: vazio antes e depois (idêntico).

| # | Arquivo | Mutação | Testes executados | Resultado |
| - | ------- | ------- | ----------------- | --------- |
| M1 | `src/ganchos/useLar.ts` (`sairOuJaFora`) | `registro_invalido` deixa de contar como "sem vínculo" | `useLar.test.tsx`, `Lar.test.tsx` | ✅ Morta (`useLar.test.tsx` "registro_invalido também renova a sessão", `Lar.test.tsx` "registro_invalido: sessão relida…") |
| M2 | `src/componentes/lar/ListaMembros.tsx` | titular também vê "Remover" em si mesmo (remove `!m.sou_eu`) | `ListaMembros.test.tsx` | ✅ Morta (4 testes) |
| M3 | `src/paginas/lar/RemoverMembroConectado.tsx` | remove a guarda `remover.isPending` de `confirmar` | `Lar.test.tsx` | ⚠️ Sobreviveu: mutante equivalente, ver abaixo |
| M4 | `src/componentes/base/DialogoConfirmacao.tsx` | véu cancela mesmo `ocupado` | `DialogoConfirmacao.test.tsx` | ✅ Morta ("Esc não cancela enquanto ocupado") |
| M5 | `src/ganchos/useLar.ts` (`useRemoverMembro`) | não invalida `CHAVES.lar` | `useLar.test.tsx`, `Lar.test.tsx` | ✅ Morta |
| M6 | `src/paginas/AreaAutenticada.tsx` | não mostra o aviso "Você saiu da casa" | `Lar.test.tsx` | ✅ Morta (2 testes) |
| M7 | `src/ganchos/useLar.ts` (`useSairDoLar`) | remove `removeQueries` (dados da casa anterior ficam no cache) | `useLar.test.tsx` | ✅ Morta |
| M8 | `src/paginas/lar/SairDaCasaConectado.tsx` | remove a guarda `sair.isPending` | `Lar.test.tsx` | ⚠️ Sobreviveu: mutante equivalente, ver abaixo |
| M9 | `src/componentes/lar/ListaMembros.tsx` | `disabled={false}` (botões ativos sem conexão) | `ListaMembros.test.tsx`, `Lar.test.tsx` | ✅ Morta (4 testes) |
| M10 | `src/paginas/lar/RemoverMembroConectado.tsx` | `registro_invalido` não relê a lista | `Lar.test.tsx` | ✅ Morta |
| M11 | `src/rotulos/lar.ts` | "30 dias" vira "60 dias" no texto da remoção | `rotulos/lar.test.ts`, `Lar.test.tsx` | ✅ Morta |
| M12 | `src/dados/lar.ts` (`removerMembro`) | remove a validação de uuid | `dados/lar.test.ts` | ✅ Morta (2 testes de id inválido) |
| M13 | `src/paginas/lar/RemoverMembroConectado.tsx` | remove o aviso "Membro removido" | `Lar.test.tsx` | ✅ Morta |
| M14 | `src/paginas/lar/SairDaCasaConectado.tsx` | remove `fecharNoVeu` | `Lar.test.tsx` | ✅ Morta ("o véu fecha a confirmação sem chamar a API") |
| M15 | `src/ganchos/useLar.ts` (`useSairDoLar`) | remove `networkMode: 'always'` (mutação pausa offline) | `useLar.test.tsx` | ✅ Morta |
| M16 | `src/dados/lar.ts` (`sairDoLar`) | método `DELETE` em vez de `POST` | `dados/lar.test.ts` | ✅ Morta |
| M17 | `RemoverMembroConectado.tsx` + `Botao.tsx` | remove as duas camadas contra envio duplo (guarda em `confirmar` e `if (salvando)` do botão) | `Lar.test.tsx` | ✅ Morta ("confirmar chama DELETE uma vez…") |
| E1 | `src/componentes/lar/ListaMembros.tsx` | `disabled={false}`, rodando o e2e `lar.spec.ts -g "sem conexão"` (Vite da cópia na porta 5199) | e2e | ✅ Morta (os dois cenários: `toBeDisabled()` falhou, valor "enabled") |

**M3 e M8 (equivalentes)**: a guarda `isPending` em `confirmar` é redundante com `Botao.tsx:33-37`, que já barra o clique quando `salvando`. Com as duas camadas removidas (M17), o teste de envio duplo falha, logo o teste discrimina o comportamento exigido (critério 5). Não geram tarefa de correção.

**Profundidade do sensor**: leve, ampliada (18 mutações; o caminho envolve dado de pessoa e ação destrutiva, então passou de 3 para cobrir todos os ramos de decisão).
**Resultado**: 16 de 18 mortas, 2 equivalentes documentadas (M3, M8) cobertas por M17. ✅ PASS

---

## Integridade dos testes

- Nenhum teste existente foi apagado, pulado, comentado ou enfraquecido: o diff do intervalo tem 0 linhas de teste removidas (as únicas linhas `-` em arquivos de teste/e2e são a assinatura de `simularApiMetas`, a linha de `/api/sessao` do mock e a linha de `import`, todas ampliadas, não enfraquecidas). Busca por `.skip`, `.only`, `.todo`, `xit`, `xdescribe` e `it.fails` no diff: nada.
- Os testes novos são todos de adição (+805 linhas de teste unitário e +128 de e2e, só de adição), nenhum teste da suíte anterior foi alterado de sentido.
- Troca do atraso fixo por trava (`segurar`, `src/paginas/Lar.test.tsx:49-58`): é a técnica determinística correta; usada em `:307` e `:501`. Rodei `Lar.test.tsx` duas vezes isoladamente (42 de 42 nas duas) e a suíte inteira uma vez (sem falha, inclusive o `MetaFormulario.test.tsx` já conhecido).
- Mudança do véu em `Veu.tsx`/`DialogoConfirmacao.tsx` é opt-in (`fecharNoVeu` padrão `false`, `aoTocar` indefinido): os testes existentes do diálogo, como "véu inerte", seguem passando.
- Todo teste novo mapeia a um critério, caso limite ou "Done when": testes de `saidaDaCasa` (marca lida uma vez) → sair, critério 3; testes de `DialogoConfirmacao` (erro e véu) → remover/sair, critérios 4 e 7; sem testes órfãos.

---

## Qualidade do código

| Princípio | Situação |
| --------- | -------- |
| Mínimo de código / sem funcionalidade além do pedido | ✅ (o `removeQueries` na saída e a marca `saidaDaCasa` vão além do texto literal, mas servem ao critério 3 da saída e ao critério de sucesso "sem dado da casa anterior"; ver achado 2) |
| Mudanças cirúrgicas | ✅ (22 arquivos; `DialogoConfirmacao`/`Veu` ampliados de forma opt-in) |
| Segue os padrões (`useComandoCadastro`, `useAviso`, `useConectado`, `ConviteConectado`) | ✅ |
| `componentes/` não importa `ganchos/` (SDD 9.1) | ✅ (`ListaMembros` recebe `conectado` por prop) |
| Tokens de design | ✅ `python .claude/scripts/checar-tokens.py` nos arquivos novos e alterados: "OK: nenhuma cor ou fonte fora do tokens.css." |
| Diretrizes do projeto | `.claude/CLAUDE.md` (Testes, Revisão por risco), `.specs/projeto/testes.json`, `tasks.md` (Test Coverage Matrix) ✅ |

---

## Gate

- **Comando (Build)**: `pnpm test` (suíte inteira, 5 workspaces) + `pnpm typecheck` + `pnpm lint` (eslint e prettier) + e2e `lar.spec.ts`.
- **`pnpm test`**: 0 falhas. Por workspace: 116, 594, 494, **2201 (frontend/web, 224 arquivos)**, 680 testes, todos passando; 0 ignorados.
- **`pnpm typecheck`**: limpo nos 5 workspaces.
- **`pnpm lint`**: eslint sem erros; "All matched files use Prettier code style!".
- **`pnpm -C frontend/web e2e e2e/lar.spec.ts`**: 10 de 10 passaram (7 de lar novos).
- **Contagem de testes**: nenhum teste removido; o frontend ganhou os testes novos de `dados/lar`, `rotulos/lar`, `useLar`, `ListaMembros`, `DialogoConfirmacao`, `Lar` e 7 e2e (delta positivo).
- **Falhas**: nenhuma.

---

## Roadmap

`.specs/projeto/roadmap.md:28`: a etapa 18 está `Em andamento`, coerente com o momento (verificada, ainda não integrada nem aprovada); `progresso.py` mostra "Todas as 8 tarefas concluídas". A troca para `Concluída` cabe à aprovação, no mesmo commit.

---

## Achados (todos menores, nenhum bloqueia)

1. **Menor — descrição da linha da 18 no roadmap defasada.** `.specs/projeto/roadmap.md:28` diz "~6,5h, 4 tarefas previstas"; `tasks.md` tem 8 tarefas e 10,5h de estimativa. Atualizar o texto junto com a Situação na aprovação.
2. **Menor — `removeQueries` apaga todo o cache, exceto a sessão, também no caminho `sem_vinculo`** (`src/ganchos/useLar.ts:90-91`). Está coberto por teste e é o desejado (nada da casa anterior pode aparecer), mas é comportamento além do literal da spec; vale registrar. Sem ação.
3. **Menor — `tasks.md` ainda diz `**Status**: Draft` e os "Objetivos" do `spec.md` continuam com `[ ]`.** Apenas higiene de artefato; a Rastreabilidade do `spec.md` já está `Implementado`.

Observação (não é achado): a remoção com resposta `sem_lar` não é tratada à parte; cai no erro genérico do diálogo. A spec só exige `registro_invalido` nesse caso (remover, critério 6), então está conforme.

---

## Atualização da rastreabilidade

| Requisito | Antes | Depois |
| --------- | ----- | ------ |
| CASA-01 | Implementado | ✅ Verificado |
| CASA-02 | Implementado | ✅ Verificado |
| CASA-03 | Implementado | ✅ Verificado |
| CASA-04 | Implementado | ✅ Verificado |
| CASA-05 | Implementado | ✅ Verificado |

(Não alterei o `spec.md`: a única escrita desta verificação é este arquivo.)

---

## Resumo

**Geral**: ✅ Pronto

**Critérios ancorados na spec**: 18/18 com resultado conforme a spec, 3/3 casos limite, 0 lacunas de precisão.
**Sensor**: 16/18 mortas, 2 equivalentes documentadas (M3, M8), cobertas pela M17.
**Gate**: suíte inteira verde (4.085 testes no total, 2.201 no frontend), typecheck, lint, tokens e e2e `lar.spec.ts` (10/10) passaram.

**O que funciona**: remoção pelo titular (confirmação com os efeitos, aviso, relê a lista, corrida `registro_invalido`), saída do membro (sessão renovada, primeiro acesso com aviso de uma vez só, `registro_invalido` e `sem_lar` sem erro), modo sem conexão (botões desativados, nada na fila, comprovado no navegador).

**Próximo passo**: aprovar a etapa e, no mesmo commit, trocar a Situação da 18 para `Concluída` e corrigir a descrição no roadmap (achado 1).
