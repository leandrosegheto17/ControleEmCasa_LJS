# As 9 fases da automação de processo

Princípio: **automatizar um processo que já funciona à mão.** Desenho original: `.rascunho/FLUXO-AUTOMACAO.md`.

As fases 1 a 3 são uma conversa curta com um só artefato e uma aprovação (como a `necessidade` do uso próprio). As demais têm aprovação própria. A construção (fase 6) usa o caminho que a fase 4 escolheu.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Processo atual | O que é feito hoje, passo a passo? | `processo.md` (passos, entradas, saídas, decisões, exceções, pessoas, tempo e frequência) | Processo descrito a partir de uma execução real anotada; tempo e frequência com número (medido ou estimado e marcado); exceções conhecidas listadas | Opus |
| 2 | Vale automatizar? | O ganho compensa o custo? | `processo.md` (**Conta de retorno**, **Veredito**) | Horas economizadas por mês, horas para construir, horas de manutenção por mês e meses para empatar, escritos; erros evitados e risco da falha considerados; veredito `automatizar`, `automatizar parte`, `não automatizar` ou `padronizar primeiro` | Opus |
| 3 | Escopo | O que automatizar e o que fica manual? | `processo.md` (**Escopo**) | Caminho comum automatizado (com a parcela dos casos que cobre); exceções com o humano e o aviso que ele recebe; o que fica fora explícito; primeiro passo pequeno definido | Opus |
| 4 | Ferramenta | Qual o meio mais simples que serve? | `processo.md` (**Ferramenta**, **Onde mora**, **Como se testa**); `.specs/escolhas/automacao-<slug>/` se houve escolha | Degrau mais baixo da escada que atende, com motivo para cada degrau descartado; IA só com motivo; escolha do usuário com fonte e data (se houve `escolha-tecnologia`) | Opus |
| 5 | Desenho seguro | O que pode dar errado? | `desenho.md` | Cada seção resolvida ou `não se aplica — motivo`; critérios EARS de simulação, idempotência, teto, falha parcial, exceção e alerta; ações irreversíveis listadas com a trava de cada uma | Opus |
| 6 | Implementação | Funciona nos casos reais? | código e testes no lugar de **Onde mora** (ou casos de teste do serviço pronto); `.specs/features/automacao-<slug>/` em projeto existente | Testes dos critérios de `desenho.md` passando; suíte verde na checagem final; resultado igual ao manual nos casos de amostra, rodados em cópia | Sonnet (skill `feature`/`legado` ou `tlc-spec-driven`) |
| 7 | Execução assistida | Posso confiar sem olhar? | `execucao.md` (rodadas comparadas com o manual) | Critério de confiança definido antes e atingido; toda divergência explicada e corrigida (com teste) ou aceita pelo usuário | Sonnet |
| 8 | Operação | Como saberei se falhar? | `operacao.md`; entrada em `.specs/implantacao.md` ou `.specs/liberacao.md` quando houver | Agendamento ligado com confirmação; alerta de falha e de "não rodou" com disparo testado; relatório de execução chegando; pausa testada; dono nomeado | Sonnet (skill `implantacao` ou `liberacao`) |
| 9 | Manutenção | Continua funcionando quando algo muda? | documentação no lugar de **Onde mora**; `operacao.md` (**Manutenção**); **Resultado** `concluída` | O que faz, como funciona, como pausar e desligar documentados; gatilhos de revisão e data da próxima revisão com dono | Sonnet |

## Caminhos da fase 6

| Onde mora (fase 4) | Construção | Verificação | Integração |
|---|---|---|---|
| Projeto existente feito com IA | skill `feature` em `.specs/features/automacao-<slug>/` (fases 1 a 7 dela), com os acréscimos de [composicao.md](composicao.md) | dentro da `feature` (verificador e `revisao-codigo` curta) | fase 7 da `feature` (merge ou PR); a automação entra **inerte**: simulação por padrão e sem agendamento |
| Projeto legado | skill `legado` (fases 1 a 7 dela; a 8 fica para a fase 8 daqui) | dentro do `legado` | merge ou PR da branch, inerte; a liberação é a fase 8 daqui |
| Repositório próprio de automação (script avulso, hook do Claude Code) | `tlc-spec-driven` (Specify a partir de `desenho.md`, Tasks, Execute) numa branch; repositório novo começa com a infraestrutura mínima de testes e o CI | agente `verificador` contra `desenho.md` e a spec | checagem final, `finishing-a-development-branch` |
| Serviço pronto ou recurso nativo, sem código | configuração feita pelo usuário (ou com ele) no serviço, em modo de teste | casos de teste de [desenho.md](desenho.md) executados e registrados em `execucao.md` | — |

Pedaço de código num serviço pronto (expressão, função, script embutido) é código: mora num repositório e tem teste. Configuração pura não é código do projeto; a prova dela são os casos de teste executados, e isso fica registrado em `processo.md` (**Como se testa**).

## Aprovações

Uma para 1-3; depois uma por fase (seguir / ajustar / parar). Nas fases 4 (com escolha), 6 e 8, as skills chamadas pedem as aprovações delas; ao voltar, a automação confere os itens próprios ([composicao.md](composicao.md)) e pede a dela sobre o resumo.

## Laços comuns

- Ao descrever o processo, ele se mostra confuso ou diferente a cada vez → saída `padronizar primeiro` (`SKILL.md`). O processo-padrão escrito vale como fase 1 da próxima tentativa.
- Conta de retorno negativa no todo, positiva num passo → escopo reduzido a esse passo (veredito `automatizar parte`).
- Desenho revela ação irreversível sem simulação possível (ex.: API que não tem modo de teste) → aprovação humana antes de cada ação na fase 7, alcance mínimo na 8, e o risco registrado em `desenho.md`.
- Teste falha de forma inesperada → `systematic-debugging`, na tarefa da construção.
- Execução assistida diverge do manual → causa no processo (a descrição estava incompleta: volta à fase 1 só nesse ponto) ou na automação (teste que reproduz a divergência, correção, nova rodada). Três rodadas sem atingir a confiança: escala ao usuário (reduzir escopo, manter aprovação humana permanente, parar).
- Alerta real em operação → pausa, depois skill `bug` (defeito da automação) ou `incidente` (dano em curso).
- Sistema de origem, API ou processo mudou → revisão da fase 9; se muda o comportamento, automação nova `<slug>-<versão>` com as fases 1 a 4 começando do que existe.
- Pedido de crescer (mais passos, mais casos) → automação nova ou volta à fase 3 desta, com nova conta de retorno; nunca crescer sem a execução assistida da parte nova.
