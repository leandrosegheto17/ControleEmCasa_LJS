---
name: progresso
description: Mostra quanto do trabalho já foi concluído, do produto até a tarefa (Produto, Feature, Phase, Tarefa), com percentual, tarefa atual, ritmo e previsão (ex.: "Faltam 45 de 180 tarefas: 75% concluído"), e a linha de fim de tarefa e de fim de lote com tempo gasto e estimado. Use quando o usuário digitar /progresso ou perguntar quanto falta, no resumo de fim de fase, na retomada de sessão e depois de cada tarefa e lote da construção. Não use para planejar nem alterar tarefas.
model: sonnet
effort: low
allowed-tools:
  - Bash(python .claude/scripts/progresso.py:*)
  - Read
  - Glob
---

# Progresso

Só lê. Não altera `tasks.md`, `STATE.md` nem nenhum artefato.

## 1. Rodar

```
python .claude/scripts/progresso.py
```

Para outra feature que não a da Retomada: `--item .specs/features/<pasta>`.

Na construção (seção Execução do `CLAUDE.md`), o trabalhador do lote roda `--tarefa` depois de cada tarefa e a sessão principal roda `--lote` depois de cada lote:

```
python .claude/scripts/progresso.py --tarefa        # a última concluída; ou --tarefa T12
python .claude/scripts/progresso.py --lote          # o da última concluída; ou --lote 3
```

## 2. Mostrar

**Responda só com as linhas que o script imprimiu, copiadas como estão**: sem tabela, sem título, sem recalcular, sem analisar o projeto por conta própria. Mesmo formato em todo projeto (Produto, Feature, Phase, Tarefa):

```
Produto: Faltam 6 de 18 etapas: 67% concluído
Em andamento: 12 Front: telas do app
Feature atual (.specs/features/importar-extrato): Faltam 3 de 4 tarefas: 25% concluído
Phase atual (Phase 2: Core): Falta 1 de 2 tarefas: 50% concluído
Tarefa atual: T3 — Importar o arquivo (estimada 1h)
Última tarefa: T2 há 12 min (38 min; estimada 1h)
Ritmo: 4,1 tarefas/h · faltam ~3h de trabalho humano estimado · previsão ~1h no ritmo atual
Projeto: Faltam 45 de 180 tarefas: 75% concluído
```

- **Produto** e **Em andamento** só existem em projeto com `.specs/projeto/roadmap.md` ([formato e vocabulário](references/roadmap.md)); contam as etapas ou features do roteiro, inclusive as ainda sem tarefas.
- **Feature atual** conta as tarefas do `tasks.md`; **Phase atual** é a primeira Phase com tarefa pendente (some se o `tasks.md` não tem Phases); **Tarefa atual** é a primeira pendente com as dependências prontas.
- **Última tarefa** e **Ritmo** vêm do `git log` do `tasks.md` e somem sem git. O tempo é o intervalo desde a conclusão anterior; intervalo acima de 90 min é pausa e aparece como "tempo não medido".
- **Projeto** só aparece quando há mais de um `tasks.md` (senão repetiria a feature atual).

Os V2 de `--tarefa` e `--lote` são **uma linha**, para copiar como saíram:

```
T12 concluída: 38 min (estimada 1h) · Phase 3: 2 de 5 tarefas · Feature: 52 de 170 tarefas (31%)
Lote 3 de 7 concluído: 12 tarefas em 3h10 (estimado 14h) · Feature: 52 de 170 tarefas (31%)
```

Linhas começadas por `Aviso:` (tarefa acima de 2h ou sem **Estimativa**) também são do script: copie-as. Só acrescente algo nestes casos, em **uma linha**:

- **"Sem tarefas ainda" sem linha de Produto:** o projeto não usa `tasks.md` nem tem roadmap. Diga isso, sugira criar `.specs/projeto/roadmap.md` e pare; não invente percentual a partir de outros arquivos. Se a Retomada não existir, descubra a fase pelos arquivos da feature (a skill do fluxo explica como).
- **Feature atual sem tarefas, projeto com tarefas:** diga que a feature ainda não tem `tasks.md`.
- **Linha de Retomada que contradiz os arquivos** (ex.: fase já concluída): avise que a Retomada está desatualizada.
- **`--tarefa` ou `--lote` sem resposta** (saída 1): a tarefa ou o lote não existe na feature atual; diga qual foi pedido e pare.

## 3. Se perguntarem como é calculado

Só então explique: o **Produto** conta as linhas da tabela do roadmap com Situação `Concluída`; a **Feature atual** e o **Projeto** contam títulos `### T<n>:` dos `tasks.md` de `.specs/`; tarefa concluída = todas as caixas `Done when` marcadas (ou `**Status**` concluído, sem caixas); só entram tarefas já planejadas, então o total cresce quando uma feature nova é planejada; todas pesam igual na contagem. O **lote** são Phases inteiras seguidas somando até 14h de **Estimativa** (sem estimativa, 1h por tarefa). A **previsão** multiplica as horas estimadas pendentes pelo fator real ÷ estimado das últimas 10 tarefas com tempo medido; sem estimativas, usa o ritmo em tarefas por hora.

## 4. Onde mais isso aparece

- **Fim de fase:** o resumo antes da pergunta seguir / ajustar / parar traz essas linhas (regra do `CLAUDE.md`).
- **Troca de sessão:** a seção `## Retomada` de `.specs/STATE.md` grava a linha do projeto e o `/fluxo` a repete ao retomar (ver `fluxo/references/marcos.md`).
