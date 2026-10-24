# As 9 fases da refatoração

Princípio: **mudar a estrutura sem mudar o comportamento**, em passos pequenos, sempre com testes verdes. Desenho original: `.rascunho/FLUXO-REFATORACAO.md`.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Motivo | Que dor a dívida causa hoje? | `refatoracao.md` (motivo), `.specs/projeto/dividas.md` se houver várias candidatas | Custo real com evidência (bugs, horas, medo de mexer, onboarding); pontuação; o trecho vai ser tocado | Opus |
| 2 | Alvo e meta | O que muda e como saberei que melhorou? | `refatoracao.md` (alvo, meta, modo) | Trecho delimitado, fora do escopo explícito, métrica com valor **antes medido**, alvo e comando; modo pequeno ou grande | Opus |
| 3 | Mapeamento | O que depende disso? | `reconhecimento.md` com **Contratos e acoplamento**; `arqueologia.md` no legado | Quem chama e quem é chamado, contratos públicos, dados e integrações, acoplamento classificado; raio de impacto conhecido | Sonnet (leitura em Haiku; arqueologia em Opus) |
| 4 | Rede de proteção | Como saberei que o comportamento não mudou? | `protecao.md`, commit de caracterização, linha de base de desempenho em `refatoracao.md` se aplicável | Linha de base verde; todo contrato do mapeamento caracterizado | Sonnet |
| 5 | Plano em passos | Qual a sequência segura? | `tasks.md` (e `design.md` no modo grande); **Plano aprovado** | Passos pequenos e reversíveis, cada um com a suíte como gate e como reverter; etapas integráveis sozinhas; `validate_tasks.py` sem erro | Opus |
| 6 | Execução | Cada passo preserva o comportamento? | um commit `refactor:` por passo, na branch da etapa | Suíte inteira verde a cada passo; caracterização intacta; nada de feature ou correção junto | Sonnet |
| 7 | Verificação | Melhorou de verdade e nada mudou por fora? | `validation-etapa-<N>.md` (PASS), `.specs/revisoes/refatoracao-<slug>-etapa-<N>/`, métrica da etapa em `refatoracao.md` | PASS; contratos iguais; métrica comparada; desempenho dentro do limite; revisão sem bloqueio | Sonnet |
| 8 | Integração | Como entra com baixo risco? | entrada da etapa em `integracao.md` (e em `.specs/liberacao.md` se crítico) | Suíte verde na checagem final; etapa integrada pequena; liberação gradual se o trecho for crítico | Sonnet |
| 9 | Registro | O que ficou melhor e o que sobrou? | `refatoracao.md` (**Resultado**), contexto do projeto, `inventario.md`, `dividas.md` | Meta atingida (ou parcial, com motivo); dívida restante e prevenção anotadas | Sonnet |

## Aprovações

Uma por fase (seguir / ajustar / parar), com 1 e 2 juntas: o motivo e a meta saem da mesma conversa, como relato e triagem no `bug`. No modo grande, as fases 6, 7 e 8 se repetem por etapa, cada uma com a sua aprovação.

## Modos

| Modo | Quando | Como |
|---|---|---|
| **Pequeno** | cabe em até ~8 passos e num diff revisável (~400 linhas), sem mudança de dados nem de contrato entre partes | uma etapa, branch `refatoracao/<slug>`, sem `design.md` |
| **Grande** | muitos passos, várias partes do sistema, troca de biblioteca ou framework, mudança de dados, ou sem testes possíveis no código antigo | novo ao lado do antigo (padrão de `plano.md`), etapas com integração própria, branch por etapa, `design.md` com o padrão e a ordem |

Na dúvida, grande: dá para descer de modo no plano, nunca no meio da execução.

## Entrada por outro fluxo

| Chamador | Em que ponto dele | Motivo já preenchido | Volta para |
|---|---|---|---|
| 3 Feature (`reconhecimento`) | escalonamento: arquitetura não cabe | a feature bloqueada e o que ela exige | reconhecimento da feature, refeito |
| 4 Legado (`arqueologia`) | saída de emergência: sem costura, impacto alto | a feature bloqueada e o raio de impacto | arqueologia da feature, refeita |
| 12 Bug | causa na arquitetura, ou causa recorrente (3+ bugs) | os bugs e a causa comum | correção do bug (fase 6 dele) ou fechamento |
| 9 Incidente | prevenção de causa recorrente | os incidentes e a causa sistêmica | `prevencao.md` do incidente |

O chamador grava `refatoracao.md` com **Chamado por**, **Usar em** e a seção Motivo; a skill completa alvo e meta com o usuário numa confirmação e segue todas as fases.

## Laços comuns

- Sem custo real ou trecho que ninguém toca → registrar a dívida e parar.
- Meta exige mudar comportamento → não é refatoração: `feature`, `legado` ou `bug`.
- Suíte vermelha antes de começar → falhas preexistentes registradas em `protecao.md`, ou corrigidas antes pela skill `bug` se estiverem no alvo.
- Sem testes possíveis → etapa 0 de infraestrutura de testes, ou reescrita ao lado com execução paralela, ou parar.
- Teste de caracterização quebrou → desfazer o passo e refazê-lo menor; nunca mudar o teste.
- Teste falha de forma inesperada (não é caracterização) → `systematic-debugging` antes de seguir.
- Bug encontrado → anotado, skill `bug` separada; a caracterização preserva o comportamento atual.
- Verificador FAIL ou revisão com bloqueio → volta à fase 6 (até 3 rodadas; depois, escala ao usuário).
- Meta atingida antes do fim do plano → parar e registrar; os passos restantes viram dívida, se ainda valerem.
- Monitoramento acusou problema na liberação → reverter a etapa e voltar à fase 6.
