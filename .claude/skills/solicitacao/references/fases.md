# As 9 fases da solicitação de feature

Princípio: **alinhar entendimento e expectativas antes de construir.** Cada fase termina com uma decisão (seguir, renegociar ou recusar) e a aprovação do usuário; as fases 2, 5 e 8 exigem também a confirmação por escrito do solicitante.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Recebimento | O que foi pedido, por quem e para quando? | `demanda.md`, linha no `registro.md`, `solicitacao.md` | Palavras literais, `PES-NNN` e papel, data pedida com o motivo, urgência declarada, quem dá o aceite; contato fora do git; recebimento avisado sem prometer data | Sonnet |
| 2 | Esclarecimento | O que o solicitante quer de verdade? | seções Entendimento e Critérios de aceite | Objetivo, quem usa, hoje, indispensável × desejável e estados da jornada escritos; `CA-NN` testáveis; **confirmação por escrito** registrada (data, canal, trecho) | Opus |
| 3 | Triagem | É feature nova, ajuste, bug ou outro fluxo? | seção Triagem | Registro, `.specs/` e produto consultados; classificação; conflitos e impactos (regra de negócio, dados, segurança, custo) checados; feature ou legado; destino escolhido | Sonnet (busca em Haiku) |
| 4 | Estimativa e opções | Quanto custa e que alternativas existem? | seção Estimativa e opções | Esforço por parte com faixa, confiança e justificativa; capacidade conhecida ou "não informada"; riscos de prazo nomeados; 2 ou 3 opções com os `CA-NN` cobertos; opções enviadas | Opus |
| 5 | Negociação e prioridade | O que entra, o que sai e quando? | seção Acordo; demandas novas para o adiado | Comparação com o trabalho em andamento; o que atrasa dito; acordo com escopo, prazo, critérios, marcos e forma do aceite; **confirmação por escrito** | Opus |
| 6 | Execução | A feature é construída com qualidade? | `encaminhamento.md`, **Ligação**, artefatos do destino | Destino com os `CA-NN` do acordo; artefato de fim do destino presente; cada `CA-NN` rastreado até um critério com PASS em `validation.md` | conforme o destino |
| 7 | Acompanhamento | O solicitante sabe como está? | seção Acompanhamento, linhas em Comunicações | Toda atualização de marco enviada (ou motivo); todo desvio avisado quando apareceu, com decisão registrada | Sonnet |
| 8 | Aceite | O solicitante confirma que é isso? | seção Aceite | Demonstração com cada `CA-NN` marcado; ajustes resolvidos ou virados em demanda nova; **aceite por escrito** registrado | Sonnet |
| 9 | Entrega e fechamento | Foi liberado e documentado? | seção Entrega, situação final, Aprendizado | No ar (entrada em `liberacao.md` ou `implantacao.md`); contexto e documentação conferidos; comunicado enviado; adiados com ID; contato tratado | Sonnet |

As fases 6 e 7 ficam `em andamento` juntas, do encaminhamento até o artefato de fim do destino.

## Dispensas por decisão

| Veredito ou decisão | Fases dispensadas | Situação |
|---|---|---|
| é bug (fase 3) | 4, 5 (prazo pela severidade do `bug`) | segue para a 6 |
| já existe (fase 3) | 4, 5, 6, 7 | 8 demonstra o existente; atende → `fechada — já atendida` |
| já em andamento (fase 3) | 4 se o trabalho existente cobre todos os `CA-NN`; 6 vira **Ligação** ao trabalho existente | 5 acorda o prazo dele |
| duplicada de outra solicitação (fase 3) | todas, se os `CA-NN` cabem na original (o solicitante vira **Interessado** dela) | `fechada — duplicada de DEM-NNN` |
| planejada (fase 5) | nenhuma | `planejada` até o início combinado |
| recusada (fases 4 ou 5, pelo usuário) | 6 a 9 | `fechada — recusada`, com aviso e motivo |
| desistência do solicitante | as que faltam | `fechada — desistência do autor` |

## Laços comuns

- **Solicitante não responde** (fases 2, 4, 5 ou 8): no **Revisitar em** (padrão sugerido: 5 dias úteis, `PREMISSA`), um lembrete curto (com confirmação de envio). Persistindo, pergunte ao usuário: **esperar mais** (novo prazo), **outro canal** ou **encerrar** (`fechada — sem resposta do autor`). Construir sem a confirmação não é opção.
- **Resposta muda o entendimento** (fase 2 ou depois): critérios reescritos e reenviados; versão anterior fica no histórico da seção.
- **Desvio na execução** (estimativa estourada, reconhecimento escalou, verificação falhou mais de uma vez, dependência atrasou): fase 7 avisa já, com opções; a decisão que muda prazo ou escopo é renegociação (fase 5, acordo v2).
- **Mudança de escopo pedida**: nova demanda com **Originada de** (fases 1 a 5 dela, curtas). Se precisa entrar nesta entrega, o acordo desta ganha nova versão com prazo revisto; senão, ela segue sozinha.
- **Aceite com critério não atendido**: volta à construção (detalhes em `acompanhamento.md`) e retorna à fase 8.
- **Destino devolveu sem fazer**: volta à fase 3 com o motivo.

## Modelo de `solicitacao.md`

Gravado na fase 1, ao lado de `demanda.md`; cada seção entra quando a fase produz conteúdo. Sem nome nem contato: só `PES-NNN`.

```markdown
# Solicitação DEM-NNN: <título>

- **Solicitante**: PES-NNN (<papel>) · **Quem dá o aceite**: <o mesmo | PES-NNN (<papel>)> · **O usuário é o solicitante**: <não | sim>
- **Data pedida**: <data, nas palavras do solicitante> — **motivo**: <evento, contrato, regulação, sem motivo dito> (pedido, não prazo combinado)
- **Urgência declarada**: <...>
- **Acordo**: <pendente | v<N>: opção <...>, prazo <data>, confirmado por escrito em <data>>
- **Destino**: <— | skill `<nome>` em `<pasta>`>
- **Próximo marco**: <— | <marco> em <data>>

## Fases

| # | Fase | Situação |
|---|---|---|
| 1 | Recebimento | pendente |
| 2 | Esclarecimento | pendente |
| 3 | Triagem | pendente |
| 4 | Estimativa e opções | pendente |
| 5 | Negociação e prioridade | pendente |
| 6 | Execução | pendente |
| 7 | Acompanhamento | pendente |
| 8 | Aceite | pendente |
| 9 | Entrega e fechamento | pendente |

## Entendimento
## Critérios de aceite
## Triagem
(modelos em esclarecimento.md)

## Estimativa e opções
## Acordo
(modelos em acordo.md)

## Acompanhamento
## Aceite
## Entrega
(modelos em acompanhamento.md)

## Aprendizado
- <estimado × real (esforço e prazo); critérios que mudaram depois de confirmados, e por quê>

## A esclarecer
- [A ESCLARECER: <...>]
```
