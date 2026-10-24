# As 9 fases da correção de bug

Princípio: **corrigir a causa, não o sintoma, e provar com um teste que falhava e agora passa.** Desenho original: `.rascunho/FLUXO-BUG.md`.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Relato | O que foi observado, onde e com que frequência? | `relato.md` (relato) | Passos, esperado × obtido, ambiente, versão, evidência e impacto registrados; o que falta marcado `[A ESCLARECER]` | Opus |
| 2 | Triagem | É bug de verdade, e quão grave? | `relato.md` (triagem) | Contraria comportamento definido; severidade P0–P3 e urgência com justificativa; duplicados checados; veredito | Opus |
| 3 | Reprodução | Consigo fazer acontecer sempre? | `reconhecimento.md`, `causa.md` (reprodução) | Reproduzido localmente com o menor caso, comando ou passos anotados | Opus (leitura em Haiku) |
| 4 | Teste que falha | Como provo que o bug existe? | teste na branch `bug/<slug>`, `causa.md` (teste vermelho) | Teste vermelho pelo motivo certo, saída registrada | Opus |
| 5 | Causa raiz | Por que acontece? | `causa.md` (causa) | Origem em `arquivo:linha`, cadeia de porquês, evidência; hipóteses descartadas anotadas | Opus |
| 6 | Correção | Qual a menor mudança que resolve a causa? | `protecao.md`, commit `fix:` com teste e correção | Teste do bug verde; nenhuma falha nova além das preexistentes | Sonnet |
| 7 | Verificação | Resolveu e não quebrou nada? | `validation.md` (PASS), revisão do diff, `seguranca.md` se aplicável | PASS; reverter a correção faz o teste falhar; cenário original e vizinhos conferidos; mesmo defeito em outros pontos tratado | Sonnet |
| 8 | Liberação | Como chega a quem sofre? | entrada em `.specs/liberacao.md` (ou `implantacao.md`) | Suíte verde na checagem final; integrado; no ar e confirmado onde o bug foi visto | Sonnet |
| 9 | Fechamento | O relator sabe e o aprendizado ficou? | `fechamento.md`, contexto do projeto se houver armadilha | Relator avisado (ou dispensado); recorrência checada; ação de prevenção, se recorrente | Sonnet |

## Entrada por outro fluxo

| Chamador | Em que fase dele | Entra na fase | Devolver após |
|---|---|---|---|
| 9 Incidente | 6 (correção definitiva, depois da contenção) | 3 | `verificação` (o incidente libera e faz o pós-mortem) |
| 16 Auditoria de segurança | 8 (correção dos achados) | 3, um bug por achado (ou por causa comum a vários) | `fechamento` (a auditoria faz o reteste) |
| 32 Suporte | 5 (encaminhamento) | 3 | `liberação` (o suporte avisa o cliente) |

O chamador grava `relato.md` com relato e triagem completos (formato de `relato.md`), e o bug segue a tabela de fases normalmente.

## Laços comuns

- Triagem diz "não é bug" → fechamento com o motivo; pedido de feature pelos fluxos 3 ou 4.
- Grave em produção → skill `incidente` (contenção e restauração primeiro; ela volta a esta pasta na fase 6 dela). Hotfix por este fluxo só com o dano já contido.
- Não reproduz → mais dados, instrumentação, ou encerrar como não reproduzido. Nunca corrigir no escuro.
- Teste passa de primeira → não reproduz o bug; refazer o teste (fase 4), nunca seguir.
- Hipótese errada → nova hipótese, uma variável por vez; 3 correções falharam → questionar a arquitetura.
- Causa é falha de arquitetura → parar e propor a skill `refatoracao` (fluxo 13; a correção retoma na fase 6 depois dela), ou contenção mínima com risco registrado.
- Verificador FAIL ou revisão com bloqueio → volta à fase 6 (até 3 rodadas; depois, escala ao usuário).
- Monitoramento acusou problema na liberação → reverter e voltar à fase 5.
