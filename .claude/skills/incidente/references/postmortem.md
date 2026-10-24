# Prevenção e post-mortem (fases 7 e 8)

Adaptado do wshobson `postmortem-writing` e `incident-runbook-templates` (atribuição em `ATRIBUICAO.md`).

## Prevenção (fase 7)

Para cada causa e fator contribuinte de `causa-raiz.md`, uma ação, de um destes tipos:

| Tipo | Pergunta | Exemplos |
|---|---|---|
| **Prevenção** | Como impeço que aconteça? | teste do comportamento que faltava, validação, limite, revisão do processo de liberação, checklist de revisão |
| **Detecção** | Como saberia antes do usuário? | alerta na métrica do ponto de risco, alerta ligado a liberação, verificação de saúde |
| **Mitigação** | Como reduzo o dano se voltar? | flag, liberação gradual, reversão mais rápida, disjuntor para terceiro, runbook |

Regras:

- Ao menos uma de prevenção e uma de detecção, ou o motivo de não haver.
- **Alerta acionável**: limite que indica ação real (nem tão alto que chega tarde, nem tão sensível que vira ruído) e **disparo testado** ao menos uma vez.
- Métrica no ponto de risco do incidente, não só CPU e memória.
- Cada ação com **responsável e prazo**, e realista (cabe no prazo). Ação de código segue o fluxo certo (skill `bug`, `feature` ou `legado`), com testes.
- **Runbook**: se o incidente mostrou que faltava um roteiro, crie ou atualize `.specs/runbook.md` (modelo abaixo) e date a última verificação.
- Mesma causa em 2 incidentes ou mais: ação de processo ou de arquitetura (refatoração, skill `refatoracao`).
- Lentidão já contida que pode voltar (pico de carga, consulta que piora com o volume): ação de prevenção pela skill `performance`, gravando `.specs/performance/<slug>/performance.md` com **Chamado por** `incidente <id>`, **Usar em** `prevencao.md` e o **Sintoma** com os números do incidente.

### Modelo de `prevencao.md`

```markdown
# Prevenção: <id>

| Prioridade | Tipo | Ação | Causa que trata | Responsável | Prazo | Onde acompanha |
|---|---|---|---|---|---|---|
| P0 | prevenção | <teste de integração do pool de conexões> | <causa sistêmica> | <pessoa> | <data> | <bug <slug> | feature <nome> | tarefa> |
| P0 | detecção | <alerta de conexões em 70%, disparo testado> | <fator contribuinte> | <pessoa> | <data> | <...> |

- **Recorrência**: <nenhuma | mesma causa em <ids>; ação de processo: <...>>
- **Runbook**: <criado | atualizado | não se aplica>
```

### Modelo de `.specs/runbook.md`

```markdown
# Runbook: <sistema>

- **Última verificação**: <data> · **Dono**: <pessoa> · **Revisar**: após todo incidente P0/P1

## Checklist rápido

- [ ] 1. Severidade e registro do incidente (skill `incidente`)
- [ ] 2. Saúde do serviço: <comando ou painel>
- [ ] 3. Liberações recentes: <onde ver>
- [ ] 4. Reverter se a liberação for suspeita: <comando>
- [ ] 5. Aviso inicial: <canal>

## Onde olhar

- Painéis: <links> · Logs: <onde> · Status de terceiros: <links>

## Procedimentos

### <sintoma>
- **Pré-requisito**: <acesso, contexto configurado>
- **Comando**: `<...>` · **Saída esperada**: <...> · **Se falhar**: <...>
- **Como desfazer**: <...>

## Escalonamento

| Condição | Chamar | Como |
|---|---|---|
| P0 sem contenção em 15 min | <pessoa> | <canal> |
| Suspeita de vazamento | <encarregado de dados> | <canal> |
```

## Post-mortem (fase 8)

**Sem culpa:**

| Com culpa | Sem culpa |
|---|---|
| "Quem causou?" | "Que condições permitiram?" |
| "Alguém errou" | "O sistema deixou o erro passar" |
| Punir pessoas | Melhorar o sistema |
| Esconder | Compartilhar o aprendizado |

Escreva logo (a memória some), com horários e erros exatos, a partir dos artefatos das fases 1 a 7, sem reescrevê-los: resuma e aponte. Para incidente pequeno (P2, curto, sem dado), use só Resumo, Linha do tempo, Causa, Correção e Lições. Revise com o usuário (pessoas citadas pelo papel, não pelo nome) antes de `Status: final`.

Evite: análise rasa (pare só na causa sistêmica), post-mortem sem ação, ação irrealista, ação sem acompanhamento.

### Modelo de `postmortem.md`

```markdown
# Post-mortem: <título>

- **Data**: <AAAA-MM-DD> · **Status**: rascunho | em revisão | final
- **Severidade**: P_ · **Duração do impacto**: <min> · **Incidente**: <id>

## Resumo

<3 a 5 linhas: o que aconteceu, quem foi afetado, a causa raiz, como foi resolvido.>

## Impacto

- **Usuários**: <quantos, o que não conseguiram fazer, por quanto tempo>
- **Negócio**: <dinheiro, chamados, prazo> · **Dados**: <nenhum dado perdido ou exposto | o que aconteceu>

## Linha do tempo

<marcos principais; completa em linha-do-tempo.md>

## Causa raiz

- **Gatilho**: <...> · **Causa sistêmica**: <...> · **Fatores contribuintes**: <...>

## Detecção e resposta

- **Funcionou**: <...>
- **Não funcionou**: <...>
- **Demos sorte em**: <o que poderia ter piorado e não piorou>

## Correção

<correcao.md em uma linha: tipo, onde, desde quando>

## Ações

<tabela de prevencao.md, ou apontar para ela>

## Lições

<1 a 3 frases que alguém deve lembrar no próximo incidente>
```
