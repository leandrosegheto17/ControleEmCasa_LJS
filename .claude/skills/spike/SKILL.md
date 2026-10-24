---
name: spike
description: Orquestra a prova de conceito (spike) — uma pergunta técnica única e verificável, critério de sucesso definido antes, limite de tempo respeitado, experimento descartável no agente implementador (modo spike), observação honesta, veredito com nível de confiança, registro curto e descarte do código (promoção só reescrevendo com testes por outro fluxo) — descobrindo a fase pelos artefatos em .specs/spikes/<slug>/ e pedindo aprovação a cada bloco. Também é chamada por outros fluxos (viabilidade técnica, escolha de tecnologia, integração) com a pergunta pronta, devolvendo o registro ao chamador. Use quando só testando se sabe a resposta, ou via /fluxo. Não use para dúvida que se resolve lendo documentação (agente pesquisador), para escolher entre tecnologias sem pergunta concreta (escolha de tecnologia) nem para construir algo que vai ficar (feature, projeto novo).
---

# Prova de conceito, spike (fluxo 17)

Você é o **orquestrador**. As 8 fases e seus critérios estão em [references/fases.md](references/fases.md); leia-o na primeira vez que acionar esta skill na sessão.

Princípio: **o produto do spike é a resposta, não o código.** O código é descartável, fica isolado e nunca é integrado. Resultado negativo também é sucesso, e estourar o prazo também é resposta.

## 1. Qual spike

Liste `.specs/spikes/`. Em andamento são os que não têm `registro.md` com **Destino do código** preenchido.

- Nenhum em andamento: spike novo, fase 1.
- Um ou mais: pergunte via `AskUserQuestion` qual retomar, com a opção **Spike novo**.
- Spike novo: slug curto em kebab-case a partir da pergunta (ex.: `api-pix-50-rps`); se a pasta existir, acrescente `-2`. Nunca sobrescreva outra pasta.
- **Várias perguntas:** um spike por pergunta. Liste-as, pergunte a ordem e faça um de cada vez.

### Chamado por outro fluxo

Viabilidade técnica (fluxo 1, fase 4), escolha de tecnologia (fluxo 25, fase 6, um spike por finalista) e integração (fluxo 6, contrato no sandbox) gravam `.specs/spikes/<slug>/spike.md` no formato de [references/preparacao.md](references/preparacao.md), com a pergunta e o contexto, preenchendo **Chamado por** e **Usar em**, e acionam esta skill. A preparação só completa o que falta (critério, prazo) e vira **uma confirmação**: o prazo é sempre decisão do usuário. Ao concluir a fase 8, responda ao chamador com o caminho de `registro.md`, o veredito e a confiança, e pare. Promoção, quando houver, fica "a cargo de <chamador>".

## 2. Descobrir a fase

A **primeira linha que se aplica** define a fase (campos conforme os modelos em `references/`):

| Situação em `.specs/spikes/<slug>/` | Fase atual |
|---|---|
| `registro.md` com **Destino do código** preenchido | encerrado (mostre o resumo; se `mantido até <data>` vencida, ofereça o descarte) |
| sem `spike.md`, ou **Preparação aprovada** pendente | 1-3 Pergunta, critério e prazo |
| sem `resultado.md`, ou **Situação** `em andamento` | 4-5 Experimento e observação |
| sem `registro.md`, ou **Veredito** pendente | 6-7 Conclusão e registro |
| **Destino do código** pendente | 8 Descarte ou promoção |

Ao retomar um spike em andamento, compare a hora atual com o **Limite** de `spike.md` antes de qualquer coisa (seção 4, prazo).

## 3. Situar o usuário

"**Spike <slug>, fase N de 8, <fase>. Prazo: <prazo> (limite <data e hora> | ainda não começou).**" Avise a troca de modelo:

- fases 1-3 e 6-7: "Esta fase rende melhor em Opus: use `/model opus`."
- fases 4-5 e 8: "Esta fase pode seguir em Sonnet: use `/model sonnet`."

## 4. Acionar a peça da fase

| Fase | Acione | Observações |
|---|---|---|
| 1-3 Pergunta, critério e prazo | conversa guiada por [references/preparacao.md](references/preparacao.md) | Primeiro, **é spike?** (se a documentação responde, despache o `pesquisador` e encerre). Uma pergunta só, com resposta sim/não ou número. Critério de sucesso **antes** do experimento, com "deu certo", "deu errado" e "inconclusivo". Prazo curto. Uma pergunta por vez, via `AskUserQuestion`. Grave `spike.md`. |
| 4-5 Experimento e observação | agente `implementador` em **modo spike**, com o pedido de [references/experimento.md](references/experimento.md) | Código em `.specs/spikes/<slug>/codigo/`, fora do git (ou worktree descartável, se precisar do código do projeto). Grave **Início** e **Limite** ao despachar. Na volta, rode de novo a medição principal você mesmo e grave `resultado.md`. |
| 6-7 Conclusão e registro | [references/registro.md](references/registro.md) | Compare o resultado com o critério **congelado**; nunca mova o alvo depois de ver o número. Veredito, confiança, explicações concorrentes, o que ficou sem resposta, riscos. Grave `registro.md` e leve a resposta ao **Usar em**. |
| 8 Descarte ou promoção | seção de descarte de `references/registro.md` | Descartar é o padrão. Promover = abrir o trabalho no fluxo certo e reescrever com testes; o código do spike não é copiado. |

### Prazo (decisão central)

- O prazo é fixado na preparação, em tempo de relógio e em número de tentativas (abordagens diferentes), e vale o que estourar primeiro.
- Ao despachar o experimento, grave em `spike.md` **Início** (data e hora atuais, pelo comando `date`) e **Limite**. O `implementador` confere o relógio antes de cada tentativa e para ao passar do limite.
- **Estourou:** pare o experimento, grave `resultado.md` com **Situação**: `prazo estourado` e o que se sabe até ali, e siga para a conclusão. Isso é resposta ("mais difícil do que parecia"), não falha.
- **Estender** só por decisão explícita do usuário via `AskUserQuestion` (opções: **concluir com o que há (Recomendado)**, estender uma vez com novo limite, parar), com o motivo registrado em `spike.md`. No máximo uma extensão: o segundo estouro é o veredito.

### Isolamento do código

- Padrão: `.specs/spikes/<slug>/codigo/`. No primeiro spike do projeto, garanta a linha `.specs/spikes/*/codigo/` no `.gitignore` e mostre o diff. Os `.md` do spike são versionados; o código, nunca.
- Precisa do código do projeto (biblioteca dentro do app, contrato com o cliente HTTP existente): worktree fora do repositório, `git worktree add ../<repo>-spike-<slug> -b spike/<slug>`. A branch `spike/<slug>` **nunca** recebe merge, push ou PR (a trava de testes também bloqueia o merge).
- Nada de produção: dados falsos ou sandbox. Criar conta, gastar dinheiro, chamar API real de terceiro ou usar credencial exige confirmação específica. Segredo só em variável de ambiente, nunca em arquivo do spike.

## 5. Fechar a fase

Apresente o que foi produzido (caminho e 3 a 5 linhas) e o critério de passagem, e pergunte via `AskUserQuestion`: **seguir / ajustar / parar**. Antes de declarar uma fase concluída, aplique `verification-before-completion`. Parar é resultado válido: grave `registro.md` com **Veredito**: `parado — <motivo>` e descarte o código (com confirmação).

## Regras

- Uma pergunta, um spike. Pergunta nova que surgir no meio vira outro spike, anotada em `resultado.md`.
- Critério e prazo antes do experimento; nenhum dos dois muda depois de ver o resultado. Mudar o critério invalida o spike: vira um spike novo.
- Quem faz o experimento (`implementador`) não dá o veredito: a sessão compara a evidência com o critério.
- Qualidade de código não importa; honestidade do resultado, sim. Número sem o comando que o produziu não é evidência.
- Spike é exceção à regra de testes **só enquanto descartável**. Nada do código do spike entra no projeto: a promoção reescreve, com testes nascidos dos critérios de aceite, por outro fluxo.
- Apagar código, worktree ou branch do spike exige confirmação específica (o que será apagado).
- Tudo em português.
