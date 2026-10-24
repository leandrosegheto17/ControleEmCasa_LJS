---
name: legado
description: Orquestra o fluxo de feature em projeto legado (código antigo, pouco testado, autores ausentes) — pedido, arqueologia (inventário, reconhecimento, histórico, costuras, raio de impacto), rede de proteção com caracterização, plano com código novo ao lado do antigo, implementação, verificação, liberação cuidadosa e registro — descobrindo a fase pelos artefatos em .specs/features/<feature>/ e pedindo aprovação a cada fase. Use quando o usuário quiser adicionar uma funcionalidade a um sistema legado, ou via /fluxo. Para projeto recente feito com IA, use a skill feature.
---

# Feature em projeto legado (fluxo 4)

Você é o **orquestrador**. As 9 fases e seus critérios estão em [references/fases.md](references/fases.md); leia-o na primeira vez que acionar esta skill na sessão.

Princípio: **mexer sem entender tudo e sem quebrar o que funciona há anos.** O código novo entra ao lado do antigo, por uma costura; o antigo muda o mínimo.

## 1. Qual feature

Liste `.specs/features/`. Em andamento são as que não têm `integracao.md`. Nenhuma: feature nova. Uma ou mais: pergunte via `AskUserQuestion` qual retomar, com a opção **Feature nova**.

**Chamada por outro fluxo:** `spec.md` com **Chamado por** `integração <slug>` (skill `integracao-terceiros`) segue estas fases com os acréscimos de [composicao.md](../integracao-terceiros/references/composicao.md); na fase 8, leve à `liberacao` os itens de liberação do chamador. Com **Chamado por** `automação <slug>` (skill `automacao`), siga os acréscimos de [composicao.md](../automacao/references/composicao.md) e pare depois da integração da branch, sem a `liberacao`: ligar é a fase 8 do chamador. Ao gravar `integracao.md`, volte ao chamador.

**Vinda de uma demanda** (sugestão, solicitação ou suporte): o Specify parte de `.specs/demandas/DEM-NNN-<slug>/encaminhamento.md` e o `spec.md` leva no topo **Origem**: `demanda DEM-NNN`. Ao gravar `integracao.md`, avise que a demanda pode ir ao fechamento com o autor (skill `demandas`, conferir ligações). Se for **solicitação** (skill `solicitacao`), os `CA-NN` já foram confirmados por escrito: o Specify os traduz em EARS citando o `CA-NN` de origem e pergunta só o técnico; dúvida que mudaria um `CA-NN`, o escopo ou o prazo volta à `solicitacao` antes de seguir. Ao fechar cada fase, se o **Próximo marco** de `solicitacao.md` for essa fase, lembre a atualização ao solicitante (fase 7 dela). Na fase 8, a liberação para todos espera o aceite da solicitação (demonstração com flag ligada só para o solicitante, ou em staging).

## 2. Descobrir a fase

| Situação em `.specs/features/<feature>/` | Fase atual |
|---|---|
| sem `spec.md` | 1 Pedido |
| `spec.md`, sem `arqueologia.md` | 2 e 3 Arqueologia, fronteira e risco |
| `arqueologia.md`, com **Mockup** `pendente` no `reconhecimento.md` | 3b Mockup |
| `arqueologia.md`, sem `protecao.md` | 4 Rede de proteção |
| `protecao.md`, e **Plano aprovado em** `pendente` no `reconhecimento.md` | 5 Plano |
| plano aprovado, tarefas em aberto | 6 Implementação |
| tarefas concluídas, sem `validation.md` com PASS | 7 Verificação |
| `validation.md` com PASS, sem `integracao.md` | 7 (revisão e segurança), 8 Liberação e 9 Registro |

## 3. Situar o usuário

"**Feature <nome> (legado), fase N de 9, <fase>.**" Avise a troca de modelo:

- fases 1, 2-3, 3b e 5: "Esta fase rende melhor em Opus: use `/model opus`."
- demais: "Esta fase pode seguir em Sonnet: use `/model sonnet`."

## 4. Acionar a peça da fase

| Fase | Acione | Observações |
|---|---|---|
| 1 Pedido | `tlc-spec-driven`, fase **Specify** | |
| 2-3 Arqueologia | skills `inventario`, `reconhecimento` e `arqueologia`, nesta ordem | A arqueologia pode escalar (impacto alto): siga a decisão do usuário. |
| 3b Mockup | pergunte via `AskUserQuestion`: **fazer o mockup das telas (Recomendado)** ou **dispensar** (motivo). Fazer: skill `mockup-visual` em **modo módulo**, pasta `.specs/features/<feature>/mockup/` | Só quando o reconhecimento diz que a feature cria ou muda telas; sem guia no projeto, o guia mínimo reproduz a aparência atual do legado. Registre `aprovado` ou `dispensado — <motivo>` no `reconhecimento.md`. |
| 4 Rede de proteção | crie a branch `feature/<nome>`; skill `rede-de-protecao` | Se o ambiente não roda (`arqueologia.md`), fazê-lo rodar vem antes. Caracterize **todo** comportamento do raio de impacto, não só o trecho alterado. |
| 5 Plano | `tlc-spec-driven`, **Design** e **Tasks** | Código novo **ao lado** do antigo, pelo ponto único de integração de `arqueologia.md`; mudança mínima no código antigo; feature flag quando possível; plano de volta. Refatoração não entra. Aprovado, grave a data em **Plano aprovado em** no `reconhecimento.md`. |
| 6 Implementação | `tlc-spec-driven`, **Execute**, na branch | Suíte inteira ao fim de cada lote: nenhuma falha nova, e os testes de caracterização continuam passando. |
| 7 Verificação | agente `verificador`; com PASS, `revisao-codigo` em modo curto (fases 4, 7 e 8; aciona o `code-review`) no diff; `auditor-seguranca` se tocar login, permissões, pagamento ou dados pessoais | Teste manual dos fluxos vizinhos listados no raio de impacto. Com **Mockup** `aprovado`, compare as telas do módulo (etapa 3 da `mockup-visual`). |
| 8 Liberação | checagem final (`trava-testes.py --rodar`), integração da branch (merge local ou PR, perguntado via `AskUserQuestion`, com `finishing-a-development-branch`), depois skill `liberacao` | Usa staging e flag conforme `arqueologia.md`. |
| 9 Registro | veja abaixo | |

### Registro (fase 9)

1. Atualize o **contexto do projeto** (`CLAUDE.md` ou equivalente; crie um mínimo se não existir), nas seções do modelo de [contexto-ia.md](../documentar/references/contexto-ia.md), com: como rodar o ambiente, as costuras usadas e as **armadilhas** descobertas na arqueologia; e corrija o que a feature tornou falso em `docs/` ou no README.
2. Atualize o `inventario.md` com as peças novas. Mockup aprovado: promova as telas para `.specs/mockup/` (seção "Promoção" de [modulo.md](../mockup-visual/references/modulo.md)).
3. Grave `.specs/features/<feature>/integracao.md`: data, forma de integração, commit, resultado da suíte, liberação (link para a entrada em `.specs/liberacao.md`), contexto e inventário atualizados.

## 5. Fechar a fase

Apresente o que foi produzido (caminho e 3 a 5 linhas) e o critério de passagem, e pergunte via `AskUserQuestion`: **seguir / ajustar / parar**. Antes de declarar uma fase concluída, aplique `verification-before-completion`.

## Regras

- Mudança mínima no código antigo. Refatoração é outro fluxo (skill `refatoracao`).
- Testes de caracterização nunca são apagados para a feature passar: se um deles quebra, a feature mudou um comportamento existente, e isso precisa de decisão do usuário.
- Push, PR, deploy e banco de produção exigem confirmação específica.
- Tudo em português.
