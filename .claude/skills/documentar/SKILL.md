---
name: documentar
description: Orquestra a documentação de um projeto existente a partir do que o código faz de fato — objetivo e público, inventário (skill inventario e documentos existentes), execução do zero com cada tropeço anotado, arquitetura com diagrama Mermaid simples e fiel, comportamento confirmado rodando, convenções, levantamento de riscos e dívidas, arquivo de contexto para IA (CLAUDE.md ou AGENTS.md) e validação por um agente sem contexto que segue a documentação num worktree limpo — cada afirmação com fonte (arquivo:linha ou comando executado) e o não verificado marcado, descobrindo a fase pelos artefatos em .specs/documentacao/<slug>/ e pedindo aprovação a cada fase. Também é chamada por outros fluxos (avaliação de terceiros) com público e fases definidos. Use quando o projeto roda mas ninguém sabe explicá-lo por escrito, antes de feature ou legado num projeto sem contexto, ou via /fluxo. Não use para documentar uma feature durante a integração (a skill feature já atualiza o contexto), para auditoria de segurança a fundo (auditoria-seguranca) nem para escrever o que o sistema deveria fazer (spec).
---

# Documentar projeto existente (fluxo 14)

Você é o **orquestrador**. As 9 fases e seus critérios estão em [references/fases.md](references/fases.md); leia-o na primeira vez que acionar esta skill na sessão. As regras de escrita valem para todas as fases que escrevem documentação: [references/escrita.md](references/escrita.md).

Princípio: **documentar o que o código faz de fato, verificado no código e em execução, e não o que se acha que ele faz.** Toda afirmação tem fonte (`arquivo:linha` ou o comando executado e o que ele mostrou); o que não foi verificado fica marcado como tal.

## 1. Qual trabalho

Liste `.specs/documentacao/`. Em andamento são os que têm `documentacao.md` com **Resultado** `pendente`.

- Nenhum em andamento: trabalho novo, fase 1.
- Um ou mais: pergunte via `AskUserQuestion` qual retomar, com a opção **Trabalho novo**.
- Novo: slug curto pelo público ou motivo (ex.: `onboarding`, `contexto-ia`, `revisao-2027-01`); se a pasta existir, acrescente `-2`. Nunca sobrescreva outra pasta.
- Já houve um trabalho concluído: o novo é uma **revisão** (modo `revisão` em `documentacao.md`): parte do commit registrado no anterior e refaz só o que o `git diff` tornou falso.

### Chamado por outro fluxo

A avaliação de terceiros (fluxo 27, depois de adotar ou herdar o projeto; a fase 3 parte do `execucao.md` da avaliação) e quem precisar de documentação antes de mudar grava `documentacao.md` no formato de [references/objetivo.md](references/objetivo.md), com **Chamado por**, **Usar em**, público e **Fases** preenchidos (as de fora ficam `dispensada — <motivo>`), e aciona esta skill. A fase 1 vira **uma confirmação**. Ao concluir a última fase pedida, responda ao chamador com o caminho da pasta, os documentos escritos e as lacunas, e pare.

## 2. Descobrir a fase

`documentacao.md` tem uma tabela **Fases** com a situação de cada uma: `pendente`, `feita (<data>)` ou `dispensada — <motivo>`. A fase atual é a **primeira `pendente`**. Sem `documentacao.md`: fase 1. Todas feitas ou dispensadas e **Resultado** `pendente`: fechamento da fase 9.

## 3. Situar o usuário

"**Documentação <slug> (<público>), fase N de 9, <fase>.**" Avise a troca de modelo:

- fases 1 e 4: "Esta fase rende melhor em Opus: use `/model opus`."
- demais: "Esta fase pode seguir em Sonnet: use `/model sonnet`."

## 4. Acionar a peça da fase

| Fase | Acione | Observações |
|---|---|---|
| 1 Objetivo e público | conversa guiada por [references/objetivo.md](references/objetivo.md) | Leitores (você, novo dev, IA, cliente, auditor) e usos; daí saem a profundidade, as fases que se aplicam, os documentos e **onde ficam** (convenção do projeto: README, `docs/`, `CLAUDE.md`/`AGENTS.md`). Uma pergunta por vez, via `AskUserQuestion`. Grave `documentacao.md`. |
| 2 Inventário | skill `inventario` (cria ou atualiza `.specs/projeto/inventario.md`); depois [references/levantamento.md](references/levantamento.md) com `leitor-codigo` | O inventário já mapeia peças, bibliotecas, integrações e testes; o levantamento só **acrescenta** estrutura, scripts, CI, ambientes, configuração e os **documentos existentes**, cada um com estado (atual, desatualizado, contraditório). Grave `levantamento.md`. |
| 3 Execução | crie a branch `docs/<slug>`; método de [references/execucao.md](references/execucao.md) (mesmo da seção 1 da skill `arqueologia`) | Instale **do zero num worktree limpo**, seguindo só o que está escrito; rode testes e aplicação. Cada tropeço vira instrução. Segredo nunca entra na documentação; instalar runtime ou serviço fora do worktree exige confirmação. Grave `execucao.md` e escreva o "Como rodar". |
| 4 Arquitetura | `leitor-codigo` com o pedido de [references/arquitetura.md](references/arquitetura.md); a sessão monta a visão e o diagrama | Módulos, camadas, fluxo de dados, integrações, banco, autenticação. Níveis do C4: **contexto e contêiner** bastam na maioria. Mermaid em Markdown; cada caixa e seta com evidência. Um segundo `leitor-codigo` confere o diagrama contra o código (quem desenha não confere). Grave `arquitetura.md` e o documento. |
| 5 Comportamento | método de [references/comportamento.md](references/comportamento.md) (seção 3 da skill `arqueologia`, para o projeto inteiro) | Fluxos principais de ponta a ponta, regras de negócio, estados e erros, **confirmados rodando** (requisição, tela, teste executado). Lido e não executado fica marcado. Defeito visto: anote e ofereça a skill `bug`; não corrija aqui. Grave `comportamento.md` e o documento. |
| 6 Convenções | `leitor-codigo` com o pedido de [references/convencoes.md](references/convencoes.md) | Nomes, organização, padrões repetidos, testes, erros **e as inconsistências** (duplicações do inventário). Regra que um linter ou formatador já garante: aponte a configuração, sem repetir em prosa. Grave `convencoes.md` e o documento. |
| 7 Riscos e dívidas | [references/riscos.md](references/riscos.md): `leitor-codigo`, `git log` e `.claude/scripts/varredura-seguranca.py ferramentas` com as ferramentas instaladas | **Levantamento, não auditoria.** Áreas frágeis, sem teste, segredos expostos, dependências desatualizadas, código morto, armadilhas. Dívidas vão para `.specs/projeto/dividas.md` (modelo da skill `refatoracao`). Risco de segurança a fundo: ofereça a skill `auditoria-seguranca` como trabalho separado. Grave `riscos.md`. |
| 8 Contexto para IA | [references/contexto-ia.md](references/contexto-ia.md) | Arquivo de instruções do projeto, curto e verificado, com as **mesmas seções** que as skills `feature` e `legado` atualizam na integração. Arquivo existente é a base: cada instrução tem destino (manter, reescrever, mover, automatizar, apagar com motivo). Mostre o diff e a lista de destinos antes de gravar. Grave `contexto.md`. |
| 9 Validação e manutenção | [references/validacao.md](references/validacao.md): agente `verificador` (modo documentação) num worktree limpo do commit da documentação | O agente, sem contexto, segue a documentação do zero (instalar, rodar, testar, um fluxo principal) e confere uma amostra de afirmações; registra onde falha. Falha vira correção e nova rodada. Defina quando revisar. Checagem final, integração e **Resultado**. |

### Saídas

- **O projeto não roda** (fase 3): a documentação registra o que foi tentado e o que falta, marcado; fazê-lo rodar é outro trabalho (skill `legado` ou `bug`). Pergunte via `AskUserQuestion`: seguir documentando só pela leitura (tudo `não verificado em execução`), parar para fazê-lo rodar, ou parar.
- **Sem permissão para rodar** (dados ou serviços só de produção): o mesmo, com o motivo; nunca rodar contra produção para documentar.
- **Segredo achado no código ou no histórico** (fase 7): não copie o valor; registre onde está, sugira a troca (ação externa, confirmação específica) e ofereça `auditoria-seguranca`; uso indevido em curso vai para a skill `incidente`.
- **Documento existente contradiz o código**: o código em execução vence; a contradição entra no documento corrigido e em `levantamento.md`. Se for o código que está errado, é a skill `bug`.

## 5. Fechar a fase

Apresente o que foi produzido (caminho dos artefatos e dos documentos, 3 a 5 linhas, e quantas afirmações ficaram `não verificado`) e o critério de passagem, e pergunte via `AskUserQuestion`: **seguir / ajustar / parar**. Antes de declarar uma fase concluída, aplique `verification-before-completion`. Marque a fase `feita (<data>)` em `documentacao.md`. Parar é resultado válido: grave **Resultado** `parada — <motivo>`; documentos já escritos ficam na branch.

## Regras

- **Verificar, não presumir.** Afirmação sem fonte não entra, ou entra marcada `não verificado`.
- **Somente leitura no código do projeto.** O fluxo escreve documentação, artefatos e o arquivo de contexto; correção vai para `bug`, melhoria para `refatoracao`.
- **Curto e específico para o público escolhido.** Não copiar o que o código, o manifesto ou a configuração já dizem melhor; apontar para eles.
- **Nada de segredo** na documentação nem nos artefatos: referencie onde fica, sem o valor.
- **Documentação viva:** fica no repositório, junto do código, e a regra de atualizá-la na mesma mudança vai para o contexto do projeto.
- Leitura ampla de código vai ao `leitor-codigo`; a sessão trabalha com o resumo.
- Push, PR, publicação de documentação fora do repositório e troca de credencial exigem confirmação específica.
- Tudo em português (identificadores e comandos do projeto como estão).
