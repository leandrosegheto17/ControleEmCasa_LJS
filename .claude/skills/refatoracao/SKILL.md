---
name: refatoracao
description: Orquestra o fluxo de refatoração e dívida técnica — motivo ligado a custo real (inventário e pontuação de dívida), alvo e meta com métrica antes e depois, mapeamento de quem depende do trecho (reconhecimento, acoplamento e contratos; arqueologia se for legado), rede de proteção com caracterização como condição para começar, plano em passos pequenos e reversíveis (novo ao lado do antigo nas mudanças grandes), execução com testes verdes e commit a cada passo, verificação de comportamento inalterado e da meta, integração em etapas pequenas e registro da dívida que sobrou — descobrindo a fase pelos artefatos em .specs/refatoracoes/<slug>/ e pedindo aprovação a cada fase. Também é chamada por outros fluxos (feature, legado, bug, incidente) quando a estrutura impede o trabalho. Use quando o código funciona mas está difícil de entender, mudar ou testar, ou via /fluxo. Não use para mudar comportamento (feature, legado), corrigir defeito (bug), deixar mais rápido (performance) nem para limpeza por gosto sem custo real.
---

# Refatoração e dívida técnica (fluxo 13)

Você é o **orquestrador**. As 9 fases e seus critérios estão em [references/fases.md](references/fases.md); leia-o na primeira vez que acionar esta skill na sessão.

Princípio: **mudar a estrutura sem mudar o comportamento**, em passos pequenos, sempre com testes verdes. Se algo observável mudou, deixou de ser refatoração.

## 1. Qual refatoração

Liste `.specs/refatoracoes/`. Em andamento são as que têm `refatoracao.md` com **Resultado** `pendente`.

- Nenhuma em andamento: refatoração nova, fase 1.
- Uma ou mais: pergunte via `AskUserQuestion` qual retomar, com a opção **Refatoração nova**.
- Nova: slug curto em kebab-case pelo trecho e pela meta (ex.: `pedido-service-dividir`); se a pasta existir, acrescente `-2`. Nunca sobrescreva outra pasta.

### Chamado por outro fluxo

`feature` e `reconhecimento` (arquitetura não cabe), `legado` e `arqueologia` (impacto alto demais), `bug` (causa na arquitetura ou causa recorrente) e `incidente` (prevenção) gravam `refatoracao.md` no formato de [references/motivo.md](references/motivo.md), com **Chamado por** e **Usar em**, o motivo e o custo preenchidos, e acionam esta skill. As fases 1-2 viram **uma confirmação** (alvo, meta e métrica são sempre combinados com o usuário). A skill vai até a fase 9, responde ao chamador com o caminho da pasta, a meta atingida e o commit integrado, e para. O chamador refaz o reconhecimento dele, porque o código mudou.

## 2. Descobrir a fase

A **primeira linha que se aplica** define a fase. A refatoração anda em **etapas** (`tasks.md`; modo pequeno = uma etapa só); a **etapa atual** é a primeira sem entrada em `integracao.md`.

| Situação em `.specs/refatoracoes/<slug>/` | Fase atual |
|---|---|
| **Resultado** preenchido (não `pendente`) | encerrada (mostre o resumo) |
| sem `refatoracao.md`, ou **Motivo e meta aprovados** `pendente` | 1-2 Motivo, alvo e meta |
| sem `reconhecimento.md` com a seção **Contratos e acoplamento** (com **Legado** `sim`, também sem `arqueologia.md`) | 3 Mapeamento |
| sem `protecao.md` | 4 Rede de proteção |
| **Plano aprovado** `pendente` | 5 Plano em passos |
| tarefas da etapa atual em aberto em `tasks.md` | 6 Execução |
| sem `validation-etapa-<N>.md` com PASS da etapa atual, ou sem `.specs/revisoes/refatoracao-<slug>-etapa-<N>/decisao.md` `devolvido` | 7 Verificação |
| etapa atual sem entrada em `integracao.md` | 8 Integração (depois, volta à fase 6 se houver próxima etapa) |
| todas as etapas integradas, **Resultado** `pendente` | 9 Registro |

## 3. Situar o usuário

"**Refatoração <slug> (<modo>, etapa N de M), fase N de 9, <fase>.**" Avise a troca de modelo:

- fases 1-2 e 5: "Esta fase rende melhor em Opus: use `/model opus`."
- demais: "Esta fase pode seguir em Sonnet: use `/model sonnet`." (A `arqueologia` pede Opus por conta própria.)

## 4. Acionar a peça da fase

| Fase | Acione | Observações |
|---|---|---|
| 1-2 Motivo, alvo e meta | conversa guiada por [references/motivo.md](references/motivo.md) | **Sem custo real, não há porquê**: bug recorrente, feature lenta, medo de mexer, onboarding difícil, com evidência. Várias dívidas candidatas: inventário e pontuação (juros, toque, risco, esforço) em `.specs/projeto/dividas.md`. Meta com **métrica medida agora** (comando ou contagem reproduzível), alvo e fora do escopo. Modo **pequeno** ou **grande**. Uma pergunta por vez, via `AskUserQuestion`. Grave `refatoracao.md`. |
| 3 Mapeamento | skill `inventario` (se faltar ou estiver desatualizado), skill `reconhecimento` gravando em `.specs/refatoracoes/<slug>/`; em legado, skill `arqueologia` na mesma pasta; depois a seção **Contratos e acoplamento** por [references/mapeamento.md](references/mapeamento.md) | `leitor-codigo` em paralelo para quem chama, quem é chamado, acoplamento e volatilidade pelo git. Os **contratos** (tudo o que é observável de fora do alvo) são o que a refatoração não pode mudar. |
| 4 Rede de proteção | crie a branch `refatoracao/<slug>` (no modo grande, `refatoracao/<slug>-etapa-1`; ou worktree, com `using-git-worktrees`); skill `rede-de-protecao` na pasta da refatoração | **Condição para começar.** Caracterize todo contrato do mapeamento, não só o trecho alterado; saída complexa pede *golden master*. Meça a linha de base de desempenho se o alvo estiver em caminho quente. Sem como criar testes: saída de emergência abaixo. |
| 5 Plano em passos | `tlc-spec-driven`, fases **Design** (só no modo grande) e **Tasks**, com as regras de [references/plano.md](references/plano.md) | Passos pequenos e reversíveis, cada um termina com o sistema funcionando. Mudança grande: **novo ao lado do antigo** (padrão escolhido em `plano.md`), nunca reescrever de uma vez. Etapas = fases do `tasks.md`, cada uma integrável sozinha. `validate_tasks.py` no `tasks.md` da pasta. Marque **Plano aprovado**. |
| 6 Execução | `tlc-spec-driven`, fase **Execute**, na branch da etapa | Lotes com `implementador` (passo mecânico) ou `implementador-dominio` (trecho com regra difícil). **Um passo por vez: mudar, rodar a suíte inteira, commitar** (`refactor:`). Regras de [references/plano.md](references/plano.md), seção Execução. |
| 7 Verificação | agente `verificador` (modo refatoração) com o pedido de [references/verificacao.md](references/verificacao.md); com PASS, skill `revisao-codigo` em modo curto (fases 4, 7 e 8, **Devolver após** `análise`) no diff da etapa | Comportamento inalterado (caracterização intacta, contratos iguais), métrica e desempenho medidos de novo e comparados. Mudança observável ou queda de desempenho além do limite é **bloqueante** e volta à fase 6. Toca login, permissões, pagamento ou dados pessoais: `auditor-seguranca` também. |
| 8 Integração | veja [references/registro.md](references/registro.md) | Checagem final, **uma etapa = uma integração pequena**. Trecho crítico: skill `liberacao`. |
| 9 Registro | modelo de [references/registro.md](references/registro.md) | Meta comparada, contexto do projeto e inventário atualizados, dívida que sobrou em `dividas.md` com prevenção. Grave **Resultado**. |

### Saídas

- **Não é refatoração**: a meta exige mudar comportamento (regra nova, correção, formato de saída diferente). Encerre com **Resultado** `parada — não é refatoração` e ofereça `feature`, `legado` ou `bug`. Meta de velocidade é do fluxo 5: grave `.specs/performance/<slug>/performance.md` (formato da skill `performance`) com **Chamado por** `refatoracao <slug>`, **Usar em** `refatoracao.md` e o **Sintoma**, e acione a skill `performance`.
- **Não vale agora**: sem custo real, ou trecho estável que ninguém vai tocar. Registre a dívida em `dividas.md` com a pontuação e encerre como `parada — não vale agora`. É resultado válido.
- **Sem testes e impossível criá-los** (fase 4): não refatore no escuro. Pergunte via `AskUserQuestion`: **reescrita isolada ao lado com execução paralela** (o novo roda junto e tem a saída comparada com a do antigo, até estrangular o antigo; modo grande, `plano.md`), **criar primeiro a infraestrutura de testes** como etapa 0, ou **parar**.
- **Bug encontrado no caminho**: não corrija aqui. A caracterização registra o comportamento atual, mesmo errado; anote em **Achados fora do escopo** e ofereça a skill `bug` (antes, se o bug bloqueia a refatoração; depois, se não).
- **Teste de caracterização quebrou**: o passo mudou comportamento. Desfaça o passo e refaça menor; **nunca** altere o teste para passar (`CLAUDE.md`). Se o comportamento atual é que está errado, isso é a skill `bug`, separada.

## 5. Fechar a fase

Apresente o que foi produzido (caminho e 3 a 5 linhas) e o critério de passagem, e pergunte via `AskUserQuestion`: **seguir / ajustar / parar**. Antes de declarar uma fase concluída, aplique `verification-before-completion`. Parar é resultado válido: grave **Resultado** `parada — <motivo>` e o que ficou pela metade (passos já integrados continuam valendo, porque cada um deixa o sistema funcionando).

## Regras

- **Comportamento constante.** Nada observável de fora do alvo muda: retorno, erro, efeito colateral, formato, ordem, mensagem.
- **Nunca misturar** com feature ou correção: cada commit tem um motivo e pode ser revertido sozinho.
- Sem rede de proteção verde, não se refatora. Teste de caracterização nunca é alterado, pulado ou apagado para passar.
- Cada passo termina com a suíte inteira verde e um commit. Passo que não cabe em poucas horas é quebrado.
- **Parar quando a meta for atingida.** Refatorar por perfeccionismo é desperdício; o resto vira dívida registrada.
- Refatore o que vai ser tocado; priorize a dívida que mais cobra juros, não a mais feia.
- Push, PR, deploy, migração de banco e banco de produção exigem confirmação específica.
- Tudo em português.
