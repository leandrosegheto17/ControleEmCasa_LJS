# Motivo e meta (fase 1)

Responde: **por que redesenhar, e como saberemos que melhorou?** Também define o modelo de `redesign.md`, que guarda o estado do redesign inteiro.

## Como conduzir

- Uma pergunta por vez, via `AskUserQuestion`, com sugestão plausível e "Ainda não sei" (vira `[A ESCLARECER]`; métrica ou linha de base `[A ESCLARECER]` não passa da fase 1).
- **Não fale de cores, fontes nem direções agora.** Preferência visual declarada ("quero mais moderno, azul") vai para **Motivo** como `declarada` e é testada na fase 4.
- Leia antes, se existirem: `.specs/projeto/inventario.md`, `.specs/mockup/` (mockup atual), `.specs/STATE.md`, trabalhos anteriores em `.specs/redesign/`.

## Perguntas

1. **Problema**: confusão (usuários erram, pedem ajuda), aparência datada (perde venda ou confiança), conversão baixa (abandono num passo), acessibilidade (exigência legal, reclamação, cliente), marca nova, outro. Peça a **evidência**: número de painel, chamados de suporte, gravação, auditoria, fala de cliente; sem evidência, `PREMISSA`.
2. **O que não muda**: regras de negócio da área (campos, validações, cálculos, permissões, mensagens de regra), dados e integrações, **endereços das páginas** (links salvos, SEO), textos legais. Tudo o que for dito aqui vira teste na fase 7.
3. **Escopo**: o produto inteiro, um fluxo (cadastro, checkout) ou um conjunto de telas. Liste as telas conhecidas; o inventário completa.
4. **Métricas e linha de base** (abaixo). Meça **agora**, antes de qualquer mudança.
5. **Acessibilidade**: nível exigido. Padrão: WCAG 2.2 nível AA, registrado como padrão. Exigência legal ou contratual (Lei Brasileira de Inclusão, eMAG em sites de governo, contrato com cliente) fica `PREMISSA` até o `pesquisador` conferir o texto vigente.
6. **Onde precisa funcionar**: navegadores, tamanhos de tela, aparelhos reais (ex.: Chrome e Safari, celular Android médio). Sem resposta: últimos Chrome, Firefox e Safari, PC 1440 × 900 e celular 390 × 844.
7. **Restrições**: prazo, manual de marca imposto, biblioteca de componentes obrigatória, quem aprova o visual.
8. **Vale o esforço?** Com escopo e meta na mesa, a sessão estima o tamanho (telas × estados, em faixa) e recomenda: seguir, reduzir o escopo (um fluxo primeiro) ou não fazer. O usuário decide.

## Métricas

| Problema | Métricas típicas | Como medir a linha de base |
|---|---|---|
| Confusão | taxa de conclusão da tarefa, tempo na tarefa, erros por tarefa, chamados de suporte sobre a tela | painel de uso (se já existir); teste rápido com 5 pessoas e as mesmas tarefas (roteiro em [pesquisa.md](pesquisa.md)); contagem de chamados por mês |
| Conversão baixa | conversão do funil, abandono por passo | painel de uso, com o período (ex.: últimos 30 dias) |
| Aparência datada | nota de satisfação ou SUS (questionário de usabilidade de 10 perguntas), percepção em teste | questionário com usuários atuais; teste de primeira impressão |
| Acessibilidade | violações por tela (automática), critérios WCAG não atendidos (manual) | `axe`, `pa11y` ou Lighthouse acessibilidade, se instalados; checklist de [acessibilidade.md](acessibilidade.md) numa amostra de telas |
| Consistência | valores visuais soltos, variações do mesmo componente | `python .claude/scripts/checar-tokens.py <pasta da interface>` (contagem); contagem de variações no inventário |

**Guardas** (não podem piorar): desempenho da página (LCP, INP e CLS; ver `performance/references/web.md`), taxa de erro, conversão das telas fora do foco.

- Instalar painel de uso, ferramenta de gravação ou teste A/B é **mudança no produto** e decisão do usuário (dado pessoal, LGPD; com fornecedor externo, skill `integracao-terceiros`).
- Sem como medir uma métrica, ela não entra como meta: vira observação. Pelo menos uma métrica precisa de linha de base medida.

## Modelo de `redesign.md`

```markdown
# Redesign: <alcance>

- **Slug**: <slug> · **Início**: <AAAA-MM-DD> · **Legado**: <sim | não>
- **Mockup**: `.specs/redesign/<slug>/mockup/` · **Mockup aprovado**: <pendente | AAAA-MM-DD>
- **Flag**: <a definir na fase 7 | nome e mecanismo>
- **Liberação**: <a definir na fase 7 | por etapa | ao fim> · **Comparação visual**: <a definir | automática | prints lado a lado>
- **Resultado**: <pendente | concluído (AAAA-MM-DD) — mantido | revertido — <motivo> | parado — <motivo> | virou feature — <motivo>>

## Motivo

- **Problema**: <tipo> — <descrição> · **Evidência**: <fonte e data | PREMISSA>
- **Preferências declaradas**: <...>
- **Restrições**: <prazo, marca, biblioteca obrigatória, quem aprova>

## Meta

| Métrica | Como se mede | Linha de base (valor, data, fonte) | Alvo | Prazo para medir |
|---|---|---|---|---|

- **Guardas**: <métrica — valor atual — piora máxima aceita>

## O que não muda

- **Regras de negócio**: <...>
- **Dados e integrações**: <...>
- **Endereços das páginas**: <mantidos | mudanças previstas com redirecionamento>
- **Outros**: <...>

## Escopo

| Tela | Rota | Fluxo | Prioridade |
|---|---|---|---|

- **Fora**: <telas e pedidos que não entram, inclusive regras novas pedidas no caminho>
- **Acessibilidade**: <WCAG 2.2 AA (padrão) | exigência e fonte>
- **Onde precisa funcionar**: <navegadores, tamanhos, aparelhos>

## Fases

| # | Fase | Situação |
|---|---|---|
| 1 | Motivo e meta | pendente |
| 2 | Inventário | pendente |
| 3 | Pesquisa | pendente |
| 4 | Direções | pendente |
| 5 | Sistema de design | pendente |
| 6 | Mockup completo | pendente |
| 7 | Plano de migração | pendente |
| 8 | Implementação | pendente |
| 9 | Verificação | pendente |
| 10 | Liberação e medição | pendente |

## Etapas

(preenchida na fase 7; modelo em [migracao.md](migracao.md))

## A esclarecer

- [A ESCLARECER: <...>]
```

Situação: `pendente`, `feita (AAAA-MM-DD)` ou `dispensada — <motivo>`. Grave `redesign.md` assim que o alcance tiver nome. Fase 3 só é dispensada com evidência forte já em mãos (ex.: auditoria de acessibilidade recente que é o próprio motivo); fase 4, com identidade visual imposta.
