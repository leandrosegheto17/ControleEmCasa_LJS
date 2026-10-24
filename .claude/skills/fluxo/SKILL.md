---
name: fluxo
description: Ponto de entrada dos fluxos de trabalho — abre um menu de opções (tipo de trabalho e depois o fluxo) ou vai direto ao fluxo por atalho (/fluxo bug, /fluxo 12), e aciona a skill do fluxo escolhido. Use quando o usuário digitar /fluxo, disser que quer começar algo sem dizer como, ou perguntar quais fluxos existem.
argument-hint: "[atalho ou número do fluxo, ex.: bug, 12, feature]"
---

# Fluxo: menu de entrada

Argumento recebido: `$ARGUMENTS`

## 0. Retomada

Antes de tudo, sem texto antes, procure a seção `## Retomada` em `.specs/STATE.md` (gravada num marco de troca de sessão; procedimento em [references/marcos.md](references/marcos.md)). Se existir e o item ainda estiver em andamento (a skill do fluxo diz pelos arquivos), e o argumento não pedir outro fluxo, a primeira pergunta (via `AskUserQuestion`) é: **Retomar <fluxo> <item> na fase <N> (Recomendado)** ou **Outro trabalho** (segue para os passos 1 e 2). Ao retomar, acione a skill do fluxo, diga em uma linha o que estava combinado na conversa (campo da retomada) e aplique a trava de modelo do `CLAUDE.md` com o modelo indicado para a fase.

## 1. Com argumento: atalho

Se o argumento for um **número** ou uma **palavra** da tabela de fluxos (seção 4), vá direto ao passo 3 com esse fluxo. Se casar com mais de um fluxo, pergunte qual (via `AskUserQuestion`, uma opção por fluxo). Se não casar com nenhum, siga para o menu.

Se o usuário descreveu o que quer em texto livre (ex.: "o login quebrou"), escolha o fluxo mais provável e confirme numa pergunta com essa opção primeiro, marcada "(Recomendado)", e a segunda mais provável.

## 2. Sem argumento: menu em dois cliques

**A primeira ação é a pergunta**, sem texto antes. Use `AskUserQuestion`.

**Clique 1**: "O que você quer fazer?"

| Opção | Descrição |
|---|---|
| Começar algo novo | Produto para vender, ferramenta pessoal, estudo, teste técnico ou automação |
| Mudar projeto existente | Feature, integração, redesign, desempenho, refatoração ou documentação |
| Corrigir ou atender | Bug, incidente, suporte, sugestão ou pedido de feature |
| Avaliar ou decidir | Segurança, revisão de código, escolha de tecnologia, projeto de terceiros |

**Clique 2**: "Qual fluxo?", com as opções da categoria escolhida. Na descrição de cada opção, diga quando usar e, se não estiver pronto, termine com "(em preparação)". Categorias com mais de 4 fluxos mostram 3 e a opção **Mais opções**, que abre os demais numa nova pergunta.

| Categoria | Opções do clique 2 | Mais opções |
|---|---|---|
| Começar algo novo | 1 Projeto para vender · 2 Uso próprio · 17 Prova de conceito | 8 Aprendizado · 30 Automação |
| Mudar projeto existente | 3 Feature (projeto IA) · 4 Feature (legado) · 13 Refatoração | 6 Integração · 7 Redesign · 5 Performance · 14 Documentar |
| Corrigir ou atender | 12 Bug · 9 Incidente · 11 Pedido de feature | 32 Suporte · 10 Sugestão de terceiros |
| Avaliar ou decidir | 24 Revisão de código · 16 Auditoria de segurança · 25 Escolha de tecnologia · 27 Avaliar terceiros | — |

## 3. Acionar o fluxo escolhido

- **Pronto:** acione a skill indicada na tabela e deixe que ela conduza.
- **Em preparação:** diga em uma linha que ainda não foi construído e pergunte (via `AskUserQuestion`):
  - **Conduzir manualmente**: seguir o desenho do fluxo (`.rascunho/FLUXO-*.md`, se existir neste projeto), com aprovação a cada fase;
  - **Usar uma peça pronta**, quando houver (coluna "Peça que já ajuda");
  - **Escolher outro fluxo**: volta ao menu.

## 4. Fluxos

| # | Fluxo | Atalhos | Situação | Skill ou peça que já ajuda |
|---|---|---|---|---|
| 1 | Projeto novo para vender | `novo`, `projeto`, `produto`, `ideia` | **Pronto** | skill `projeto-novo` |
| 2 | Aplicação para uso próprio | `pessoal`, `uso-proprio` | **Pronto** | skill `uso-proprio` |
| 3 | Feature em projeto feito com IA | `feature` | **Pronto** | skill `feature` |
| 4 | Feature em projeto legado | `legado` | **Pronto** | skill `legado` |
| 5 | Performance e escala | `performance`, `lento` | **Pronto** | skill `performance` |
| 6 | Integração com terceiros | `integracao`, `api` | **Pronto** | skill `integracao-terceiros` |
| 7 | Redesign de interface | `redesign`, `visual` | **Pronto** | skill `redesign` |
| 8 | Aprendizado | `estudo`, `aprender`, `aprendizado` | **Pronto** | skill `aprendizado` |
| 9 | Investigação de incidentes | `incidente`, `caiu` | **Pronto** | skill `incidente` |
| 10 | Sugestão de melhoria de terceiros | `sugestao` | **Pronto** | skill `sugestao` |
| 11 | Solicitação de feature sob demanda | `pedido`, `solicitacao` | **Pronto** | skill `solicitacao` |
| 12 | Correção de bug | `bug`, `erro` | **Pronto** | skill `bug` |
| 13 | Refatoração e dívida técnica | `refatorar`, `divida` | **Pronto** | skill `refatoracao` |
| 14 | Documentar projeto existente | `documentar`, `docs` | **Pronto** | skill `documentar` |
| 16 | Auditoria de segurança | `seguranca`, `auditoria` | **Pronto** | skill `auditoria-seguranca` |
| 17 | Prova de conceito (spike) | `spike`, `poc` | **Pronto** | skill `spike` |
| 24 | Revisão de código | `revisao`, `review` | **Pronto** | skill `revisao-codigo` |
| 25 | Escolha de tecnologia | `tecnologia`, `stack` | **Pronto** | skill `escolha-tecnologia` |
| 27 | Avaliação de projeto de terceiros | `avaliar`, `terceiros` | **Pronto** | skill `avaliar-terceiros` |
| 30 | Automação de processo | `automacao`, `automatizar` | **Pronto** | skill `automacao` |
| 32 | Suporte ao cliente | `suporte`, `atendimento` | **Pronto** | skill `suporte` |

Ao construir um fluxo novo, atualize a coluna "Situação" e a skill aqui.

Tudo em português.
