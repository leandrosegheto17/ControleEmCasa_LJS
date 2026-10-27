---
name: roteiro
description: Quebra um escopo grande em features ordenadas e grava o roteiro do produto em .specs/projeto/roadmap.md — cada feature uma fatia vertical que entrega valor testável, com ordem, dependências, tamanho (P, M, G) e os requisitos que ela cobre — antes de qualquer feature receber design e tarefas. Use na fase 6b do projeto novo (fluxo 1), na fase 3b do uso próprio (fluxo 2) e quando uma feature pedida nos fluxos 3 e 4 for grande demais para uma spec, ou quando um tasks.md passar do limite. Não use para escopo que cabe em uma feature (siga direto para o tlc-spec-driven) nem para detalhar tarefas.
model: opus
effort: high
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash(python .claude/scripts/progresso.py:*)
---

# Roteiro: do produto às features

O `tlc-spec-driven` cuida de **uma feature** (Specify, Design, Tasks, Execute). Esta skill cuida do nível acima: **quais features, em que ordem e de que tamanho**. Sem ela, cada projeto inventa sua própria quebra (plano em etapas, uma feature gigante, decisão solta no `STATE.md`).

## Vocabulário (vale em todo o projeto)

| Termo | Significa |
|---|---|
| **Roteiro** | A lista ordenada das features do produto, em `.specs/projeto/roadmap.md` |
| **Feature** | Unidade do roteiro: entrega de valor com spec, design e tarefas próprios em `.specs/features/<slug>/` |
| **Fase do fluxo** | Passo do processo (1 a 11 do fluxo 1; 1 a 9 do fluxo 2) |
| **Phase** | Agrupamento de tarefas dentro de um `tasks.md` (termo do tlc) |
| **Tarefa** | `T<n>`, atômica, com teste |

## 0. Modelo

Esta fase pede **Opus**: aplique a trava de modelo do `CLAUDE.md` antes de qualquer trabalho.

## 1. Decidir se precisa de roteiro

Leia a spec do MVP (`.specs/features/<mvp>/spec.md`), ou o pedido da feature. **Pule a skill** e vá direto ao tlc quando o escopo cabe em **uma feature**: um fluxo de valor só, que dá para validar e liberar como uma unidade, por maior que seja a quantidade de tarefas. Diga em uma linha por que pulou.

Em dúvida, pergunte via `AskUserQuestion`: "Este escopo cabe em uma feature ou vira um roteiro?"

## 2. Quebrar em features

Critérios, exemplos e anti-padrões em [references/criterios.md](references/criterios.md). Em resumo:

- Cada feature é uma **fatia vertical**: do dado à tela, com valor que o usuário percebe e critério de aceite testável. Nada de "primeiro todo o banco, depois toda a API".
- **Ordem** por dependência e por risco: o que destrava os outros e o que tem a maior incerteza vêm antes.
- **Tamanho:** P, M ou G, relativo, pelo esforço total estimado (a soma das **Estimativa** das tarefas, quando já houver). Não há limite de tarefas por feature; o limite é o tamanho de cada tarefa (regra de Tarefas do `CLAUDE.md`).
- **Rastreabilidade:** cada requisito da spec do MVP cai em exatamente uma feature (coluna **Requisitos**).
- A primeira feature costuma ser a **fundação** (esqueleto ponta a ponta, CI, ambiente), só se o projeto ainda não tem isso.

## 3. Gravar

1. `.specs/projeto/roadmap.md` no formato de [references/modelo.md](references/modelo.md): todas as features `Não começada`. Em projeto existente, preserve as linhas que já tiverem situação.
2. Uma decisão `AD-NNN` na seção `## Decisions` de `.specs/STATE.md` (edição parcial: só acrescente): a quebra escolhida, a alternativa descartada e o motivo.

## 4. Aprovar

Resumo curto (as features em ordem, com tamanho e dependências) e a pergunta **seguir / ajustar / parar** via `AskUserQuestion`. Inclua as linhas de `python .claude/scripts/progresso.py`.

Aprovado o roteiro, só a **primeira feature** (a de situação `Em andamento`, a que você marcou) recebe spec, design e tarefas agora. As demais ficam como linhas do roteiro até chegar a vez delas: é por isso que o total de tarefas cresce ao longo do projeto.

## 5. Voltar ao roteiro

Ao integrar ou liberar uma feature (regra de progresso do `CLAUDE.md`):

- troque a Situação dela para `Concluída` no mesmo commit;
- releia o roteiro: a ordem ainda faz sentido? O que se aprendeu muda alguma feature seguinte?
- mudança de ordem, divisão ou feature nova é **decisão nova**: registre um `AD-NNN` e ajuste o `roadmap.md`, com aprovação.
- escolha a próxima feature e marque `Em andamento`. Marco de troca de sessão: depois de fechar uma feature, vale oferecer sessão nova (`fluxo/references/marcos.md`).

## 6. Tarefa grande demais

Quando o `progresso.py` avisar tarefa acima de 2h (ou sem **Estimativa**), a correção é dividir a **tarefa** no `tasks.md`, não a feature. Só proponha dividir a feature no roteiro se ela deixou de ser um fluxo de valor único que se valida e libera junto.
