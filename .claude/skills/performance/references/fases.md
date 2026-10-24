# As 9 fases de performance e escala

Princípio: **medir antes de mexer.** Otimizar sem medição costuma melhorar o que não importa e piorar o que importa. Desenho original: `.rascunho/FLUXO-PERFORMANCE.md`.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Meta | O que está lento, para quem, e qual é o alvo? | `performance.md` (sintoma, meta, cenário, ambiente, guardas) | Métrica com número-alvo, cenário reproduzível, ambiente de medição e prazo; métricas que não podem piorar | Opus |
| 2 | Linha de base | Como o sistema se comporta hoje? | `medicoes.md` (**Linha de base**), roteiro em `carga/` | Número de partida com comando, condições, repetições e dispersão; métricas de produção quando houver | Sonnet |
| 3 | Diagnóstico | Onde está o gargalo de verdade? | `diagnostico.md`; **Causa confirmada** | Fração do tempo ou do recurso por parte; o maior gargalo com evidência (perfil, plano de consulta, trace); ganho máximo possível estimado | Opus (leitura em Haiku) |
| 4 | Opções | Quais correções existem e a que custo? | `opcoes.md`, `tasks.md`; **Plano aprovado** | Alternativas com esforço, risco, ganho esperado, reversibilidade e mudança de comportamento; escolhida a de melhor custo-benefício; uma tarefa por mudança; `validate_tasks.py` sem erro | Opus |
| 5 | Rede de proteção | Como garanto que a correção não muda o comportamento? | branch `performance/<slug>`, `reconhecimento.md`, `protecao.md`; **Rede de proteção** | Linha de base da suíte verde; comportamento tocado pelas tarefas caracterizado | Sonnet |
| 6 | Otimização | A mudança melhora o número? | um commit `perf:` por mudança mantida (revertidas também ficam no histórico); medição de cada uma em `medicoes.md` | Suíte verde a cada mudança; ganho confirmado além do ruído, ou revertido | Sonnet |
| 7 | Verificação | A meta foi atingida sem regressão? | `validation-rodada-<N>.md` (PASS), `.specs/revisoes/performance-<slug>-rodada-<N>/`, **Meta atingida** | PASS; carga completa repetida por quem não otimizou; guardas e custo sem piora; revisão sem bloqueio; meta atingida ou nova rodada | Sonnet |
| 8 | Guarda e integração | Como evito voltar ao problema? | checagem no CI, `guarda.md`, `integracao.md` (e `.specs/liberacao.md` se houver produção) | Checagem automatizada que falha sem a otimização; suíte verde na checagem final; alerta ou motivo para não ter | Sonnet |
| 9 | Registro | O que aprendemos? | `performance.md` (**Resultado**), contexto do projeto, `inventario.md`, `dividas.md` | Gargalo, correção, números e limite atual documentados | Sonnet |

## Aprovações

Uma por fase (seguir / ajustar / parar). As fases 3 a 7 se repetem a cada **rodada** (meta não atingida na verificação), cada uma com a sua aprovação; 1, 2, 8 e 9 acontecem uma vez.

## Entrada por outro fluxo

| Chamador | Em que ponto dele | Já preenchido | Volta para |
|---|---|---|---|
| 13 Refatoração | saída "não é refatoração": a meta era velocidade | sintoma, trecho, métrica sugerida | `refatoracao.md` encerrada, ou etapa seguinte dela |
| 9 Incidente | prevenção: lentidão já contida que pode voltar | sintoma, linha do tempo, números do incidente | `prevencao.md` do incidente |
| 12 Bug | triagem: o defeito é só lentidão, sem resultado errado | relato e reprodução | `fechamento.md` do bug |

O chamador grava `performance.md` com **Chamado por**, **Usar em** e o **Sintoma**; a skill confirma meta, cenário e ambiente com o usuário numa pergunta e segue todas as fases.

## Peças acionadas

| Peça | Em que fase | Para quê |
|---|---|---|
| `leitor-codigo` | 3 (e 5, pelo `reconhecimento`) | mapear o caminho quente: rota, serviço, consultas, laços, chamadas externas |
| skill `spike` | 4 | opção incerta: "esta mudança leva o p95 abaixo de N?" com critério e prazo |
| skill `escolha-tecnologia` | 4 | opção é trocar banco, cache, fila, servidor, biblioteca ou hospedagem |
| skills `inventario`, `reconhecimento`, `rede-de-protecao` | 5 | onde a mudança entra e caracterização do comportamento tocado |
| `tlc-spec-driven` (Tasks, Execute) + `implementador`/`implementador-dominio` | 4 e 6 | plano em tarefas e execução uma por vez |
| `verificador` (modo performance), skill `revisao-codigo` (curta) | 7 | verificação independente e revisão do diff |
| `auditor-seguranca` | 7, condicional | cache de dado pessoal ou por usuário, mudança em autenticação ou permissões |
| skill `liberacao` | 8 | produção com usuários: liberação gradual observando a métrica da meta |
| skill `refatoracao`, `escolha-tecnologia` | saída arquitetural | redesenho ou migração |

## Laços comuns

- Meta sem número ou cenário vago → não passa da fase 1.
- Medições muito dispersas (repetições discordam) → estabilizar o ambiente antes de seguir (seção Ruído de `medicao.md`).
- Diagnóstico aponta várias causas pequenas e nenhuma grande → atacar a maior; se a soma não chega à meta, saída arquitetural.
- Opção muda comportamento observável → decisão do usuário na fase 4, critério de aceite e teste na tarefa.
- Ganho não confirmado → `git revert` da mudança, registro e próxima tarefa; nenhuma tarefa confirmada → nova rodada de diagnóstico.
- Teste de caracterização quebrou → a mudança alterou comportamento: desfazer e refazer; nunca mudar o teste.
- Teste falha de forma inesperada → `systematic-debugging` antes de seguir.
- Verificador FAIL ou revisão com bloqueio → volta à fase 6 (até 3 rodadas de correção; depois, escala).
- Meta não atingida na verificação → nova rodada (fase 3); três rodadas → escala ao usuário.
- Monitoramento acusou piora na liberação → reverter (skill `liberacao`) e voltar à fase 3.
