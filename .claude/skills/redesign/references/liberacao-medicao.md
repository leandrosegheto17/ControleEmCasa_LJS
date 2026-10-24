# Liberação e medição (fase 10)

Responde: **a meta foi atingida, e mantemos, ajustamos ou revertemos?**

## 1. Liberar (skill `liberacao`)

Uso próprio, sem outros usuários: ligue a flag com confirmação, registre em `integracao.md` e siga para a medição. Com usuários, acione a skill `liberacao` levando ao plano:

| Item | O que o redesign acrescenta |
|---|---|
| **Estratégia** | flag ligada aos poucos: interno → grupo voluntário → porcentagem → todos (de `migracao.md`); por etapa ou tudo junto |
| **A/B** (quando planejado) | grupo de controle (interface antiga) e grupo novo sorteados por usuário, não por visita; métrica primária = a da meta; **tamanho da amostra e duração decididos antes** (pelo menos um ciclo semanal) e não encerrar cedo porque o número parece bom; guardas medidas nos dois grupos |
| **Monitoramento** | métricas da meta e guardas (desempenho da página, erros no navegador, conversão das telas fora do foco), chamados de suporte sobre as telas novas, feedback |
| **Critério de parada** | guarda pior que o limite de `redesign.md`; erro acima do normal; reclamação recorrente que impede tarefa; violação de acessibilidade crítica achada em produção |
| **Reversão** | desligar a flag (para um grupo ou para todos), **testada** antes de ampliar |
| **Comunicação** | aviso na própria interface ("visual novo; voltar ao antigo" se a opção existir), suporte avisado com as mudanças e as respostas, nota para clientes quando for o caso |

Cada aumento de alcance é uma confirmação nova (regra da `liberacao`). Ligar para qualquer grupo é ação externa.

## 2. Medir contra a linha de base

Com o alcance planejado atingido e o prazo de `redesign.md` cumprido, grave `medicao.md`:

- Cada métrica da meta: mesma forma de medir da linha de base, mesmo período de comparação (ex.: 30 dias antes × 30 dias depois, ou grupo de controle × novo no A/B). Diferença pequena dentro da oscilação normal não é ganho: diga.
- Guardas: valor depois e se ficou dentro do limite.
- Teste com usuários repetido (mesmas tarefas), quando houve na pesquisa.
- Feedback recebido, agrupado por tela e tipo (anonimizado; bruto em `evidencias/`).
- Acessibilidade: contagem automática e critérios atendidos, contra a linha de base da fase 2.

## 3. Decidir

Pergunte via `AskUserQuestion`:

- **Manter** (Recomendado quando a meta foi atingida e as guardas seguraram): segue para a remoção.
- **Ajustar**: as telas com problema voltam à fase 3 ou 6 (motivo em `redesign.md`), e as fases 7 a 10 se repetem para elas; o resto fica ligado.
- **Reverter**: flag desligada para todos; pergunte se o código novo fica inerte (para retomar depois) ou sai numa etapa de remoção do **novo**. **Resultado** `revertido — <motivo>`.

## 4. Remoção do antigo e fechamento (com manter)

1. **Convivência mínima**: a flag fica no código por um período combinado (ex.: duas semanas com todos) para reverter rápido.
2. **Etapa R** pelas fases 8 e 9 (branch `redesign/<slug>-remocao`): apagar telas, componentes e CSS antigos que nada mais usa, e a flag; testes parametrizados passam a uma posição (mudança aprovada na fase 7); `checar-tokens.py` passa a rodar sobre a interface inteira no CI; suíte verde; integração com a checagem final.
3. **Mockup de referência**: o mockup do redesign passa a ser o do projeto. Se `.specs/mockup/` existe, mova-o para `.specs/redesign/<slug>/mockup-anterior/`; depois mova `.specs/redesign/<slug>/mockup/` para `.specs/mockup/` (`git mv`, num commit `docs:`). Anote **Mockup promovido** em `redesign.md`.
4. **Contexto do projeto** (`CLAUDE.md` ou equivalente), nas seções do modelo de `documentar/references/contexto-ia.md`: onde ficam tokens e componentes, "só tokens" com o comando do `checar-tokens.py`, como rodar a comparação visual e os testes de acessibilidade. Atualize o `inventario.md` (componentes novos, os antigos removidos).
5. **Resultado** `concluído (<data>) — mantido`; fases 10 `feita`.

## Modelo de `medicao.md`

```markdown
# Medição: <slug>

- **Liberado para**: <alcance e datas> · **Forma**: <antes e depois | A/B (amostra, duração)>

## Meta

| Métrica | Linha de base | Depois (valor, data, fonte) | Alvo | Atingido? |
|---|---|---|---|---|

## Guardas

| Guarda | Antes | Depois | Limite | Dentro? |
|---|---|---|---|---|

## Teste com usuários

| Tarefa | Antes (concluíram, tempo) | Depois | Observação |
|---|---|---|---|

## Feedback

- <tema> — <quantas menções> — <tela>

## Decisão

- **Decisão**: <manter | ajustar (telas) | reverter> — <AAAA-MM-DD> — <motivo>
```
