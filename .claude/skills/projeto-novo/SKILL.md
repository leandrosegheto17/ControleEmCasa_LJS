---
name: projeto-novo
description: Orquestra o fluxo de projeto novo (construir um software para vender), da ideia à validação — descobre em que fase o projeto está pelos artefatos em .specs/, avisa a troca de modelo, aciona a skill certa (descoberta, viabilidade-tecnica, plano-comercial, decisao, tlc-spec-driven) e pede aprovação ao fim de cada fase. Use quando o usuário quiser começar ou retomar um projeto novo, ou via /fluxo. Não use para feature em projeto existente, bug ou outros fluxos.
---

# Projeto novo (fluxo 1)

Você é o **orquestrador**: decide a fase, aciona a peça certa e controla as aprovações. O trabalho de cada fase está nas skills e agentes que você aciona. As 12 fases, suas perguntas e critérios de passagem estão em [references/fases.md](references/fases.md); leia-o na primeira vez que acionar esta skill na sessão.

## 1. Descobrir onde estamos

Liste `.specs/produto/` e `.specs/features/`. A **primeira linha que se aplica** define a fase:

| Situação dos arquivos | Fase atual |
|---|---|
| `.specs/` não existe ou `produto/` vazio | 1 Ideia |
| `ideia.md`, sem `problema.md` | 2 Discovery |
| `problema.md`, sem `solucao.md` | 3 Solução e valor |
| `solucao.md`, sem `viabilidade-tecnica.md` | 4 Viabilidade técnica |
| `viabilidade-tecnica.md`, sem `decisao.md` | 5 Plano comercial (opcional) ou Decisão |
| `decisao.md` com veredito `matar` | Encerrado: mostre o motivo e pare |
| `decisao.md` com veredito `esclarecer` | Volte à fase indicada em "Voltar para" |
| `decisao.md` com `seguir`, sem `features/*/spec.md` | 6 MVP |
| `spec.md`, sem `design.md` e sem `tasks.md` | 7 Desenho (o tlc pode pular, se a feature for simples) |
| `design.md`, projeto com interface, sem `.specs/mockup/tokens.css` | 7 Desenho: mockup visual |
| `design.md` (e mockup, se houver interface) ou spec simples, sem `tasks.md` | 8 Preparação |
| `tasks.md` com tarefas em aberto | 9 Construção |
| todas as tarefas concluídas, sem `validation.md` com PASS | 10 Validação |
| `validation.md` com PASS, sem `seguranca.md` | 10 Validação: auditoria de segurança |
| `seguranca.md` sem achado crítico ou alto em aberto, sem `.specs/liberacao.md` | 11 Lançamento |
| `.specs/liberacao.md` com a primeira liberação concluída | 12 Operação e aprendizado |

Para retomar uma construção interrompida, o `tlc-spec-driven` reconcilia `.specs/STATE.md` com o git; deixe que ele faça isso.

## 2. Situar o usuário

Uma linha: "**Fase N de 12, <nome>.** Anterior: <fase>, aprovada."

**Validações pendentes** (tabela em `decisao.md`): se houver alguma `pendente`, acrescente uma linha: "Validações pendentes: N (V1 entrevistas, V3 advogado...)". Antes de entrar na fase 9, confira as marcadas como condição para **construção**; antes da fase 11, as marcadas para **lançamento**. Com alguma condição em aberto, **não entre na fase**: mostre quais faltam e pergunte (via `AskUserQuestion`) se o usuário quer registrar o resultado de alguma, mudar a condição ou parar. Quando o usuário trouxer o resultado de uma validação, atualize a linha da tabela (situação, data, resultado). Se `decisao.md` com "seguir" listar pendências só em texto, sem a tabela, ofereça montá-la.

Se a fase pede outro modelo, avise:

- fases 1 a 7: "Esta fase rende melhor em Opus: use `/model opus`."
- fases 8 a 12: "Esta fase pode seguir em Sonnet: use `/model sonnet`."

## 3. Acionar a peça da fase

| Fase | Acione | Observações |
|---|---|---|
| 1, 2, 3 | skill `descoberta` | Ela retoma da etapa que falta e para a cada etapa. |
| 4 | skill `viabilidade-tecnica` | |
| 5 | pergunte: "Quer fazer o plano comercial agora? (opcional)" → sim: skill `plano-comercial`; não: siga para a decisão | |
| Decisão | skill `decisao` | Com `seguir`, ela prepara a entrada do MVP. |
| 6 | skill `tlc-spec-driven`, fase **Specify** | Entrada: seção "Se seguir: entrada do MVP" de `decisao.md`. Projeto novo costuma ser de tamanho Complex. |
| 7 | `tlc-spec-driven`, fase **Design**; depois, se houver interface, skill `mockup-visual` (etapas 1 e 2) | O desenho define telas e fluxos; o mockup define a aparência (direção, guia de estilo, 2 a 3 telas-chave). A fase só fecha com os dois aprovados. Use `leitor-codigo` se já houver código. Escolha de stack difícil de reverter (linguagem, banco, hospedagem) com alternativas reais: skill `escolha-tecnologia`, com `escolha.md` gravado a partir da stack candidata de `viabilidade-tecnica.md`; o Design referencia o `AD-NNN` que ela registra. |
| 8 | `tlc-spec-driven`, fase **Tasks** | Peça que as **primeiras tarefas** sejam: repositório e estrutura, ambiente local reproduzível, esqueleto que roda ponta a ponta e CI com os testes. Com interface, inclua: copiar `.specs/mockup/tokens.css` sem alterar, criar os componentes do guia antes das telas, e rodar `python .claude/scripts/checar-tokens.py <pasta da interface>` no CI. |
| 9 | `tlc-spec-driven`, fase **Execute** | Trabalhadores: `implementador` (lote mecânico) ou `implementador-dominio` (lote de domínio). Isole com `using-git-worktrees`. |
| 10 | verificador do `tlc-spec-driven` (agente `verificador`) | Com PASS, despache o `auditor-seguranca` sobre a feature. Com interface, rode a etapa 3 do `mockup-visual` (prints do app ao lado do mockup + checagem de tokens) e peça o aceite visual ao usuário. Achado crítico ou alto de segurança, ou diferença visual rejeitada, vira tarefa de correção e volta à fase 9. Antes de fechar, a checagem final de testes do `CLAUDE.md` (suíte inteira, resultado mostrado). Ao final, `finishing-a-development-branch`. |
| 11 | skill `liberacao` | Confere antes as validações pendentes marcadas como condição para lançamento. |
| 12 | **ainda sem peça** | Diga que esta fase ainda não foi construída e ofereça conduzi-la manualmente seguindo `references/fases.md` (métricas do MVP, feedback, decisão de persistir, pivotar ou encerrar). |

## 4. Fechar a fase

Quando a peça terminar, apresente:

- o que foi produzido (caminho do arquivo) e 3 a 5 linhas com o essencial;
- o critério de passagem da fase (de `references/fases.md`) e se foi atendido;
- as opções **seguir / ajustar / parar**, e qual é a próxima fase.

Não avance sem aprovação explícita. Ajuste fica na mesma fase. Voltar a uma fase anterior só se a decisão dela mudar.

Antes de declarar uma fase concluída, aplique `verification-before-completion`: o que a fase promete precisa estar no arquivo, não só na conversa.

## Regras

- Ações externas (push, deploy, publicar, banco de produção) exigem confirmação específica, mesmo com a fase aprovada.
- Parar é um resultado válido: registre o motivo no artefato da fase.
- Tudo em português.
