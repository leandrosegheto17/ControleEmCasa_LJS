# Casa: remover membro e sair do lar — Tarefas

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tarefas com a skill `tlc-spec-driven`: **ative-a pelo nome e siga o fluxo de Execute e as Critical Rules.** Não procure arquivos da skill por caminho. Se a skill não puder ser ativada, PARE e avise o usuário.

---

**Design**: nenhum (mudança só de front sobre padrões existentes: `DialogoConfirmacao`, `useComandoCadastro`, `useAviso`, `useConectado`)
**Spec**: `.specs/features/casa-remover-membro/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada do código do projeto e da spec. Diretrizes encontradas: `.claude/CLAUDE.md` (Testes inegociável), `frontend/web/package.json`, `.specs/projeto/testes.json`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Dados (cliente HTTP) | unit | Cada rota chamada com método, caminho e corpo certos; erro de regra e de rede repassados; id inválido recusado | `frontend/web/src/dados/*.test.ts` | `pnpm -C frontend/web test <arquivo>` |
| Rótulos (textos) | unit | Cada texto exigido pela spec presente; nome do membro entra no texto | `frontend/web/src/rotulos/*.test.ts` | `pnpm -C frontend/web test <arquivo>` |
| Ganchos | unit | Invalida as chaves certas só em sucesso; roda sem pausa offline | `frontend/web/src/ganchos/*.test.tsx` | `pnpm -C frontend/web test <arquivo>` |
| Componentes e páginas | unit (RTL) | 1:1 com os critérios da spec; todo caso limite e todo erro listado | `frontend/web/src/{componentes,paginas}/**/*.test.tsx` | `pnpm -C frontend/web test <arquivo>` |
| Fluxo no navegador | e2e | Caminho feliz e erro de cada história P1 | `frontend/web/e2e/*.spec.ts` | `pnpm -C frontend/web e2e <arquivo>` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tarefa só com testes unitários | `pnpm -C frontend/web test <arquivos da tarefa>` e `pnpm -C frontend/web typecheck` |
| Full | Tarefa com e2e | Quick + `pnpm -C frontend/web e2e e2e/lar.spec.ts` |
| Build | Fim de fase | `pnpm test` (suíte inteira) + `pnpm -C frontend/web typecheck` + lint do projeto |

---

## Execution Plan

### Phase 1: Dados, textos e ganchos

```
T1 → T2 → T3
```

### Phase 2: Tela

```
T4 → T5 → T6
```

### Phase 3: Fluxo no navegador

```
T7 → T8
```

---

## Task Breakdown

### T1: Chamadas da API de remoção e saída

**What**: Funções `removerMembro(id)` e `sairDoLar()` no cliente de dados do lar.
**Estimativa**: 45 min
**Risco**: baixo
**Where**: `frontend/web/src/dados/lar.ts`
**Depends on**: None
**Reuses**: `revogarConvite` (valida uuid, `chamar`) em `dados/lar.ts`
**Requirement**: CASA-01, CASA-03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [x] `removerMembro(id)` chama `DELETE /api/lar/membros/:id`; id que não é uuid lança `REGISTRO_INVALIDO` sem chamar a rede
- [x] `sairDoLar()` chama `POST /api/lar/sair` sem corpo
- [x] Erros de regra (`registro_invalido`, `sem_lar`) e de rede chegam intactos a quem chamou
- [x] Gate quick passa e o total de testes não diminui

**Tests**: unit
**Gate**: quick

---

### T2: Textos de confirmação, avisos e rótulo offline

**What**: Arquivo de rótulos com título e texto das duas confirmações (com o nome do membro), os avisos "Membro removido" e "Você saiu da casa", "Este membro já não está na casa" e "Precisa de conexão para esta ação".
**Estimativa**: 30 min
**Risco**: baixo
**Where**: `frontend/web/src/rotulos/lar.ts`
**Depends on**: T1
**Reuses**: `rotulos/conta.ts` (AVISO_TITULAR, AVISO_CONVIDADO) como padrão de estilo
**Requirement**: CASA-01, CASA-03, CASA-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] O texto da remoção traz o nome do membro e os quatro efeitos da spec (perde o conjunto; individual some em 30 dias; despesas conjuntas ficam como "Ex-membro"; só volta por novo convite)
- [ ] O texto da saída traz os mesmos quatro efeitos
- [ ] Os quatro avisos têm o texto exato da spec
- [ ] Gate quick passa e o total de testes não diminui

**Tests**: unit
**Gate**: quick

---

### T3: Ganchos de remover e sair

**What**: `useRemoverMembro` (invalida a chave do lar) e `useSairDoLar` (invalida a sessão), ambos sem pausa offline.
**Estimativa**: 45 min
**Risco**: alto
**Where**: `frontend/web/src/ganchos/useLar.ts`
**Depends on**: T2
**Reuses**: `useComandoCadastro`, `CHAVES.lar`, `CHAVE_SESSAO`
**Requirement**: CASA-02, CASA-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Remover bem-sucedido invalida só a chave do lar; falha não invalida nada
- [ ] Sair bem-sucedido invalida a sessão (a guarda leva ao primeiro acesso)
- [ ] `registro_invalido` na saída também leva à sessão renovada (spec, sair, critério 6)
- [ ] Sem rede o erro `rede` chega à tela em vez de a mutação ficar pausada
- [ ] Gate quick passa e o total de testes não diminui

**Tests**: unit
**Gate**: quick

---

### T4: Botões Remover e Sair da casa na lista de membros

**What**: `ListaMembros` mostra "Remover" ao titular no outro membro e "Sair da casa" ao membro não titular em si mesmo, desativados sem conexão com o aviso.
**Estimativa**: 1,5h
**Risco**: alto
**Where**: `frontend/web/src/componentes/lar/ListaMembros.tsx`
**Depends on**: None (a fase anterior termina antes)
**Reuses**: `useConectado`, `Botao`, `lista.module.css`
**Requirement**: CASA-01, CASA-03, CASA-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Titular com outro membro vê "Remover" só nesse membro; nunca em si mesmo
- [ ] Membro não titular vê "Sair da casa" só em si mesmo; titular nunca vê "Sair da casa"
- [ ] Titular sozinho na casa não vê botão nenhum
- [ ] Sem conexão os botões ficam desativados e o aviso "Precisa de conexão para esta ação" aparece
- [ ] Os botões só avisam o pai (`aoRemover(id)`, `aoSair()`); nenhuma chamada de API aqui
- [ ] Gate quick passa e o total de testes não diminui

**Tests**: unit
**Gate**: quick

---

### T5: Fluxo de remover o membro na página

**What**: Confirmação destrutiva, chamada, aviso de sucesso e tratamento de erro da remoção em `Lar`.
**Estimativa**: 2h
**Risco**: alto
**Where**: `frontend/web/src/paginas/lar/RemoverMembroConectado.tsx`
**Depends on**: T4
**Reuses**: `DialogoConfirmacao`, `useAviso`, padrão de `paginas/lar/ConviteConectado.tsx`
**Requirement**: CASA-01, CASA-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] "Remover" abre a confirmação com o nome do membro e o texto dos efeitos
- [ ] Cancelar, véu e Esc fecham sem chamar a API
- [ ] Confirmar chama a remoção uma vez; durante a chamada o botão fica inerte (sem segundo envio)
- [ ] Sucesso: lista relida e aviso "Membro removido"; o formulário de convite volta a aparecer
- [ ] `registro_invalido`: lista relida e aviso "Este membro já não está na casa"
- [ ] Falha de rede ou do servidor: confirmação aberta, mensagem de erro, lista inalterada
- [ ] Componente ligado em `paginas/Lar.tsx`
- [ ] Gate quick passa e o total de testes não diminui

**Tests**: unit
**Gate**: quick

---

### T6: Fluxo de sair da casa na página

**What**: Confirmação destrutiva, chamada, volta ao primeiro acesso com o aviso "Você saiu da casa" e tratamento de erro da saída.
**Estimativa**: 2h
**Risco**: alto
**Where**: `frontend/web/src/paginas/lar/SairDaCasaConectado.tsx`
**Depends on**: T5
**Reuses**: `DialogoConfirmacao`, `useAviso`, guardas de `ganchos/guardas.ts` (`ROTA_BEM_VINDO`)
**Requirement**: CASA-03, CASA-04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] "Sair da casa" abre a confirmação com o texto dos efeitos
- [ ] Cancelar, véu e Esc fecham sem chamar a API
- [ ] Confirmar chama a saída uma vez; durante a chamada o botão fica inerte
- [ ] Sucesso: sessão renovada, o app vai a `/app/bem-vindo` e o aviso "Você saiu da casa" aparece lá
- [ ] `registro_invalido` ou `sem_lar`: sessão renovada e segue o destino da sessão, sem mensagem de erro
- [ ] Falha de rede ou do servidor: confirmação aberta, mensagem de erro, membro continua na casa
- [ ] Componente ligado em `paginas/Lar.tsx`
- [ ] Gate quick passa e o total de testes não diminui

**Tests**: unit
**Gate**: quick

---

### T7: E2E: titular remove o membro

**What**: Cenário em `lar.spec.ts` em que o titular remove o membro e vê a lista só com ele; mais o cenário de erro `registro_invalido`.
**Estimativa**: 1,5h
**Risco**: alto
**Where**: `frontend/web/e2e/lar.spec.ts`
**Depends on**: None (a fase anterior termina antes)
**Reuses**: mocks `/api/*` e apoios de `frontend/web/e2e/apoio/`
**Requirement**: CASA-01, CASA-02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Remover chega em 2 toques (Remover, Confirmar) e a lista volta só com o titular
- [ ] Cancelar não faz nenhuma chamada a `DELETE /api/lar/membros/:id`
- [ ] `registro_invalido` mostra "Este membro já não está na casa"
- [ ] Gate full passa e o total de testes não diminui

**Tests**: e2e
**Gate**: full

---

### T8: E2E: membro sai da casa

**What**: Cenário em `lar.spec.ts` em que o membro sai e cai no primeiro acesso; mais o cenário sem conexão com os botões desativados.
**Estimativa**: 1,5h
**Risco**: alto
**Where**: `frontend/web/e2e/lar.spec.ts`
**Depends on**: T7
**Reuses**: mesmos apoios de T7
**Requirement**: CASA-03, CASA-04, CASA-05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Sair leva a `/app/bem-vindo` com o aviso "Você saiu da casa"
- [ ] Cancelar não faz nenhuma chamada a `POST /api/lar/sair`
- [ ] Sem conexão (modo offline do Playwright) os dois botões ficam desativados e nada é enfileirado
- [ ] Gate full passa e o total de testes não diminui

**Tests**: e2e
**Gate**: full

---

## Rastreabilidade

| Requisito | Tarefas |
| --- | --- |
| CASA-01 | T1, T2, T4, T5, T7 |
| CASA-02 | T3, T5, T7 |
| CASA-03 | T1, T2, T4, T6, T8 |
| CASA-04 | T3, T6, T8 |
| CASA-05 | T2, T4, T8 |
