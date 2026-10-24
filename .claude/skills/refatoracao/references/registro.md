# Integração e registro (fases 8 e 9)

## Fase 8: integração (uma por etapa)

**PRs pequenos e frequentes em vez de um grande.** Cada etapa entra sozinha.

0. **Checagem final de testes:** na branch da etapa, com tudo commitado, `python .claude/scripts/trava-testes.py --rodar`, e mostre o resultado. Falha volta à fase 6. (Falha preexistente de `protecao.md` precisa ser corrigida ou excluída da suíte com aprovação do usuário antes, porque a trava exige suíte verde.)
1. **Forma de integrar:** pergunte via `AskUserQuestion`: **merge local** na branch principal, **PR no GitHub** (push e abertura do PR são ações externas, com confirmação específica) ou **manter a branch**. Use `finishing-a-development-branch`. A descrição do PR diz que é refatoração sem mudança de comportamento, a meta, a métrica antes e depois e como reverter.
2. **Trecho crítico** (pagamento, login, dados, alto tráfego, ou `arqueologia.md` indica risco, ou modo grande com troca por flag): skill `liberacao`, com a estratégia mais reversível (flag ou gradual, a sequência sombra → canário → ampliar do `plano.md`). Sem produção (biblioteca, uso local): a integração basta. Ferramenta pessoal: skill `implantacao`.
3. Acrescente a entrada da etapa em `integracao.md`.
4. Há próxima etapa: crie a branch `refatoracao/<slug>-etapa-<N+1>` a partir da principal atualizada e volte à fase 6.

### Modelo de `integracao.md`

```markdown
# Integração: <slug>

## Etapa <N> — <AAAA-MM-DD>
- **Forma**: <merge local | PR <link> | branch mantida>
- **Commit final**: <hash> · **Suíte na checagem final**: <N passaram, 0 falharam>
- **Liberação**: <não se aplica | entrada em `.specs/liberacao.md` (<data>)>
- **Reverter**: `<git revert <intervalo> | desligar a flag <nome>>`
```

## Fase 9: registro

**O que ficou melhor e o que sobrou?**

1. **Meta:** compare **antes**, **depois** e **alvo** em `refatoracao.md`. Atingida: **Resultado** `concluída`. Parcial: `meta parcial — <motivo>`.
2. **Contexto do projeto** (`CLAUDE.md` ou equivalente, nas seções de `.claude/skills/documentar/references/contexto-ia.md`; crie um mínimo se não existir): o padrão novo a seguir, onde mora agora a regra que estava espalhada, o que não fazer para a dívida não voltar. Mostre o diff ao usuário.
3. **Inventário:** atualize `.specs/projeto/inventario.md` nas áreas que mudaram (peça nova, duplicação removida, coluna "Usar").
4. **Dívida:** em `.specs/projeto/dividas.md`, marque a dívida paga (data e pasta) e acrescente a que sobrou ou foi vista no caminho (**Achados fora do escopo**), com pontuação.
5. **Prevenção:** proponha ao menos uma forma de a dívida não voltar, ou registre por que não há: regra de lint ou limite de complexidade, checagem de imports ou de ciclos no CI, regra no contexto do projeto, teste de contrato. Mudar o CI ou o lint é mudança no projeto: com aprovação, em commit próprio (`chore:`), com a suíte verde.
6. **Chamado por outro fluxo:** responda ao chamador com o caminho da pasta, a meta atingida e o commit integrado, e registre o retorno em **Usar em**.

Grave **Resultado** em `refatoracao.md` e peça a aprovação final.
