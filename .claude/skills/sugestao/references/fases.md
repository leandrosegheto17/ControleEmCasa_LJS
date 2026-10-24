# As 9 fases da sugestão de terceiros

Princípio: **resolver o problema, não copiar a solução.** Cada fase termina com uma decisão (seguir, adiar ou recusar) e a aprovação do usuário.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Recebimento | O que foi sugerido, por quem e em que contexto? | `demanda.md`, linha no `registro.md`, `sugestao.md` | Palavras literais, data, canal, `PES-NNN` e papel; contato fora do git; recebimento avisado ou motivo para não avisar | Sonnet |
| 2 | Entendimento do problema | Que dor está por trás? | `sugestao.md`, seção Problema | Problema escrito sem a solução, com quem sofre, frequência e contorno; o que falta é pergunta enviada ao autor ou `[A ESCLARECER]` | Opus |
| 3 | Verificação | Já existe, já foi pedido, é mal-entendido? | `sugestao.md`, seção Verificação | Registro, trabalhos em `.specs/` e produto consultados, com o que foi visto; veredito nova / duplicada / já atendida / já em andamento / é bug / é suporte / é solicitação | Sonnet (busca em Haiku) |
| 4 | Valor | Quanto vale resolver? | seção Valor | Alcance, impacto e confiança com fonte ou `PREMISSA`; evidência listada; alinhamento com o objetivo do produto; eixos comerciais quando há plano | Opus |
| 5 | Custo e risco | Quanto custa e o que pode quebrar? | seção Custo e risco | Esforço com faixa e confiança; riscos com dono; manutenção e coerência; pré-mortem; menor versão | Opus |
| 6 | Priorização | Agora, depois ou nunca? | seção Priorização, **Decisão** | RICE com a conta; comparação com o backlog; o que sai ou atrasa; decisão do usuário com motivo | Opus |
| 7 | Resposta ao autor | O autor sabe o que será feito? | linha em Comunicações | Mensagem aprovada e enviada (ou motivo para não enviar), também aos interessados | Sonnet |
| 8 | Encaminhamento | Quem faz? | `encaminhamento.md`, entrada do destino, **Ligação** | Destino pelo problema; critérios de aceite testáveis; origem registrada no destino | Opus |
| 9 | Fechamento do ciclo | O autor foi avisado e resolveu? | Comunicações, situação final, Aprendizado | Entrega confirmada para o autor; pergunta feita; resposta ou prazo vencido; contato tratado | Sonnet |

## Dispensas por decisão

| Veredito ou decisão | Fases dispensadas | Situação depois da fase 7 |
|---|---|---|
| duplicada (fase 3) | 4, 5, 6, 8, 9 (a original avisa os interessados) | `fechada — duplicada de DEM-NNN` |
| já atendida / é suporte (fase 3) | 4, 5, 6, 8, 9 | `fechada — já atendida` |
| já em andamento (fase 3) | 4, 5, 6, 8 (**Ligação** aponta para o trabalho existente) | `encaminhada` |
| é bug (fase 3) | 4, 5, 6 | segue para a 8 |
| valor baixo ou sem evidência (fase 4) | 5 (opcional) | conforme a 6 |
| observação (fase 6) | 8 e 9 ficam `pendente` | `em observação`, com **Revisitar em** |
| planejar (fase 6) | nenhuma | `planejada` |
| recusar (fase 6) | 8, 9 | `fechada — recusada` |

## Laços comuns

- **Autor não responde** às perguntas da fase 2: espere até **Revisitar em** (padrão sugerido: 14 dias, `PREMISSA`); depois, siga com o que há, marcando a confiança baixa, ou feche `sem resposta do autor`.
- **Observação** revisitada com evidência nova (mais interessados, caso de suporte, métrica): fases 4 a 6 de novo, mantendo o histórico da avaliação anterior.
- **Destino devolveu sem fazer**: volta à fase 6 com o motivo.
- **Não resolveu** depois da entrega: demanda nova com **Originada de**, começando na fase 2 com a resposta do autor.

## Fechamento (fase 9)

1. **Conferir a entrega**: a skill `demandas` acha o artefato de fim do destino. Pergunte via `AskUserQuestion` se já está **disponível para o autor** (integrado não é liberado: veja `.specs/liberacao.md` ou `.specs/implantacao.md`). Ainda não: espera, situação `entregue` só quando estiver.
2. **Avisar** (tipo entrega), também aos interessados, com a pergunta "isso resolve o que você contou?"; situação `aguardando autor` com **Revisitar em**.
3. **Resposta**: resolveu → `fechada — resolvida`; não resolveu → demanda nova (laço acima) e esta fecha `resolvida` em parte, com o motivo; sem resposta no prazo → `fechada — sem resposta do autor`. Aviso de fechamento (tipo fechamento), com confirmação.
4. **Aprendizado** (uma linha em `sugestao.md`): o uso medido depois da entrega (o evento de `encaminhamento.md`) bateu com o alcance e o impacto estimados? Diferença grande calibra as próximas avaliações.
5. **Contato**: sem outra demanda aberta da pessoa e sem consentimento para novo contato, ofereça apagar a linha em `contatos.md` (skill `demandas`).

## Modelo de `sugestao.md`

Gravado na fase 1, ao lado de `demanda.md`; cada seção entra quando a fase produz conteúdo.

```markdown
# Sugestão DEM-NNN: <título>

- **Decisão**: <pendente | fazer agora | planejar — <quando> | observação — revisitar <quando/gatilho> | recusar — <motivo>>
- **Destino**: <— | skill `<nome>` em `<pasta>`>

## Fases

| # | Fase | Situação |
|---|---|---|
| 1 | Recebimento | pendente |
| 2 | Entendimento do problema | pendente |
| 3 | Verificação | pendente |
| 4 | Valor | pendente |
| 5 | Custo e risco | pendente |
| 6 | Priorização | pendente |
| 7 | Resposta ao autor | pendente |
| 8 | Encaminhamento | pendente |
| 9 | Fechamento do ciclo | pendente |

## Problema
(modelo em entendimento.md)

## Verificação
(modelo em entendimento.md)

## Valor
## Custo e risco
## Priorização
(modelos em avaliacao.md)

## Aprendizado
- <estimado × medido, ou "sem medida">

## A esclarecer
- [A ESCLARECER: <...>]
```
