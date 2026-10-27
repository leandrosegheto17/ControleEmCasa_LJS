# Roadmap do projeto (`.specs/projeto/roadmap.md`)

O `tasks.md` só cobre o que já foi detalhado em tarefas. O roadmap cobre o resto: uma linha por **unidade** do plano (etapa, feature, marco), mesmo antes de ela ter spec ou tarefas. É o que faz o `/progresso` dizer "Faltam 6 de 18 etapas" em vez de "Sem tarefas ainda".

## Formato

Uma tabela com a coluna **Situação**. As outras colunas são livres; o rótulo da primeira coluna que não seja `#` vira o nome da unidade na frase (`Etapa` → "etapas", `Feature` → "features").

```markdown
# Roadmap

| # | Etapa | Situação | Onde |
|---|---|---|---|
| 0 | Documentos de método | Concluída | `.md/` |
| 1 | Esqueleto do monorepo | Concluída | |
| 2 | Banco: base e identidade | Em andamento | `.specs/features/banco/` |
| 3 | API: esqueleto no Worker | Não começada | |
```

## Vocabulário da Situação (fixo)

| Valor | Quando |
|---|---|
| `Concluída` | Entregue e aprovada (feature: liberada ou integrada) |
| `Em andamento` | Já começou e ainda não foi aprovada; aparece na linha "Em andamento" |
| `Não começada` | Planejada, sem trabalho iniciado |

Qualquer outro valor conta como não concluída. Etapa adiada ou cancelada: escreva `Adiada` ou `Cancelada` e explique na coluna livre; ela entra no total e fica como faltante, então prefira remover a linha se a unidade saiu do plano de vez.

## Quem mantém

- Quem fecha uma unidade (a skill do fluxo ao integrar, ou a sessão ao aprovar a etapa) troca a **Situação** dela no mesmo commit da aprovação.
- Unidade nova entra como `Não começada` quando o plano a incluir.
- O roadmap descreve só o estado; a decisão e o histórico continuam no `STATE.md` e nos artefatos da unidade.

## Limites

- Todas as unidades pesam igual, qualquer que seja o tamanho (uma etapa "G" conta o mesmo que uma "M").
- O percentual do plano mede entregas aprovadas, não esforço restante.
