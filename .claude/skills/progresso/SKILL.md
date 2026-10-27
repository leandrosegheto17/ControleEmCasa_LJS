---
name: progresso
description: Mostra quanto do trabalho já foi concluído — etapas do plano e tarefas feitas e faltantes, com percentual, no item em andamento e no projeto todo (ex.: "Faltam 45 de 180 tarefas: 75% concluído"). Use quando o usuário digitar /progresso ou perguntar quanto falta, e no resumo de fim de fase e na retomada de sessão. Não use para planejar, estimar prazo nem alterar tarefas.
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

Para outro item que não o da Retomada: `--item .specs/features/<pasta>`.

## 2. Mostrar

**Responda só com as linhas que o script imprimiu, copiadas como estão**: sem tabela, sem título, sem recalcular, sem analisar o projeto por conta própria. Mesmo formato em todo projeto:

```
Plano: Faltam 6 de 18 etapas: 67% concluído
Em andamento: 12 Front: telas do app
Item atual (.specs/features/importar-extrato): Faltam 3 de 4 tarefas: 25% concluído
Projeto: Faltam 45 de 180 tarefas: 75% concluído
```

As duas primeiras linhas só existem em projeto com `.specs/projeto/roadmap.md` ([formato e vocabulário](references/roadmap.md)); sem ele, só as duas últimas. O **Plano** conta as etapas ou features do roteiro, inclusive as ainda sem tarefas; o **Projeto** conta só as tarefas já detalhadas em `tasks.md`. Por isso os dois percentuais diferem, e isso é esperado.

Só acrescente algo nestes casos, em **uma linha**:

- **"Sem tarefas ainda" sem linha de Plano:** o projeto não usa `tasks.md` nem tem roadmap. Diga isso, sugira criar `.specs/projeto/roadmap.md` e pare; não invente percentual a partir de outros arquivos. Se a Retomada não existir, descubra a fase pelos arquivos do item (a skill do fluxo explica como).
- **Item atual sem tarefas, projeto com tarefas:** diga que o item ainda não tem `tasks.md`.
- **Linha de Retomada que contradiz os arquivos** (ex.: fase já concluída): avise que a Retomada está desatualizada.

## 3. Se perguntarem como é calculado

Só então explique: o **Plano** conta as linhas da tabela do roadmap com Situação `Concluída`; o **Projeto** conta títulos `### T<n>:` dos `tasks.md` de `.specs/`; tarefa concluída = todas as caixas `Done when` marcadas (ou `**Status**` concluído, sem caixas); só entram tarefas já planejadas, então o total cresce quando uma feature nova é planejada; todas pesam igual.

## 4. Onde mais isso aparece

- **Fim de fase:** o resumo antes da pergunta seguir / ajustar / parar traz essas linhas (regra do `CLAUDE.md`).
- **Troca de sessão:** a seção `## Retomada` de `.specs/STATE.md` grava a linha do projeto e o `/fluxo` a repete ao retomar (ver `fluxo/references/marcos.md`).
