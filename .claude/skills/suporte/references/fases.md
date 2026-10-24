# As 9 fases do suporte ao cliente

Princípio: **resolver o problema da pessoa e transformar cada atendimento em melhoria do produto.** Cada fase termina com uma decisão (resolver, escalar ou encerrar) e a aprovação do usuário. Desenho original: `.rascunho/FLUXO-SUPORTE.md`.

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Recebimento | O que a pessoa precisa? | `demanda.md`, linha no `registro.md`, `suporte.md` | Palavras literais, `PES-NNN` e papel, o que tentava, o que esperava, o que aconteceu, ambiente e evidências (dado real fora do git); recebimento enviado com o prazo da próxima notícia, ou motivo para não enviar | Sonnet |
| 2 | Classificação | Que tipo de caso é, e qual a urgência? | seção Classificação | Tipo e prioridade P0–P3 com justificativa por impacto; prazo de resposta registrado; saídas (segurança, cobrança, pedido de feature) checadas | Opus |
| 3 | Verificação rápida | Já existe resposta? | seção Verificação | Base de conhecimento, casos anteriores, problemas conhecidos e incidentes abertos consultados, com o que foi visto; veredito resposta conhecida / problema conhecido / falha em andamento / novo | Sonnet (busca em Haiku) |
| 4 | Diagnóstico | O que está acontecendo com essa pessoa? | seções Diagnóstico e Acessos | Reproduzido (ou motivo); cada acesso à conta ou aos dados registrado e confirmado; perguntas à pessoa numa só mensagem; causa identificada ou `[A ESCLARECER]` | Opus |
| 5 | Resolução | Como resolvo? | seção Resolução; `relato.md` do bug e **Ligação**, se for bug | Instrução, correção na conta (confirmada, com como desfazer) ou contorno; bug encaminhado com a triagem; expectativa honesta definida | Opus |
| 6 | Comunicação | A pessoa entendeu e foi tratada bem? | linha em Comunicações | Mensagem nas regras de `mensagens.md`, aprovada pelo usuário e enviada (ou motivo); só promete o combinado | Sonnet |
| 7 | Confirmação | Resolveu mesmo? | seção Fechamento, situação final | "Resolveu?" perguntado; resposta registrada ou prazo vencido; não resolveu volta à 4 | Sonnet |
| 8 | Escalonamento | Quando passo adiante? | seção Escalonamento | Caso completo passado a quem decide (pacote de `escalonamento.md`); pessoa avisada de quem cuida e quando terá notícia; retorno registrado | Opus |
| 9 | Aprendizado | O que este caso ensina? | tag em `suporte.md`, entrada em `base-conhecimento.md`, demandas novas | Causa raiz com tag; base criada ou contagem atualizada; repetição checada (3 ou mais: sugestão ou recorrência); contato tratado | Sonnet |

A fase 8 começa `pendente` e só entra quando acionada (fases 2, 4 ou 5); ao fechar a 7 sem escalonamento, ela fica `dispensada — não precisou`. Com o caso `encaminhada` ao `bug`, as fases 6 e 7 esperam a devolução dele (situação `entregue`); enquanto isso, a pessoa já recebeu o contorno (fase 6, primeira mensagem).

## Dispensas por decisão

| Veredito ou decisão | Fases dispensadas | Situação |
|---|---|---|
| resposta conhecida (fase 3) | 4 | segue para a 5 com a resposta da base (`BC-NNN`) |
| falha em andamento (fase 3) | 4 e 5 (o `incidente` resolve) | `encaminhada`, Ligação ao incidente |
| problema conhecido, bug aberto (fase 3) | 4; 5 só dá o contorno | `encaminhada`, Ligação ao bug existente; a pessoa vira **Interessado** do caso que originou o bug, se houver |
| pedido de feature (fase 2) | 3 a 9 aqui | troca de **Tipo** e skill `sugestao` ou `solicitacao` |
| duplicado (fase 1 ou 3) | as que faltam | `fechada — duplicada de DEM-NNN` |
| desistência da pessoa | as que faltam, exceto a 9 | `fechada — desistência do autor` |

## Laços comuns

- **Pessoa não responde** (fase 4, perguntas; fase 7, confirmação): **Revisitar em** padrão sugerido de 3 dias úteis (`PREMISSA`, ajustável nos combinados de `base-conhecimento.md`). Na fase 7, um único lembrete curto ("ainda precisa de ajuda?"); vencido de novo, `fechada — sem resposta do autor`, com a mensagem de fechamento. Na fase 4, não repita as perguntas: pergunte ao usuário **esperar mais**, **seguir com o que há** (diagnóstico com confiança baixa) ou **encerrar**.
- **Não resolveu** (fase 7): volta à fase 4 com a resposta da pessoa, sem pedir de novo o que ela já disse. Na terceira volta, ofereça escalar (fase 8).
- **Caso reaberto depois de fechado**: demanda nova com **Originada de**, começando na fase 2 com o histórico do anterior.
- **Destino devolveu sem fazer** (`bug` concluiu "não é bug", "não reproduzido" ou "duplicado"): volta à fase 4 ou 5 com o motivo; "não é bug" costuma ser dúvida de uso ou pedido de feature.
- **Escalonamento sem retorno** (**Retorno esperado em** vencido): cobre quem decide uma vez e avise a pessoa do novo prazo; persistindo, pergunte ao usuário a quem mais levar.

## Modelo de `suporte.md`

Gravado na fase 1, ao lado de `demanda.md`; cada seção entra quando a fase produz conteúdo. Sem nome, contato nem dado da conta: só `PES-NNN` e referências.

```markdown
# Suporte DEM-NNN: <o que a pessoa precisa, do ponto de vista dela>

- **Tipo do caso**: <pendente | dúvida de uso | bug | pedido de feature | cobrança | conta | segurança> · **Prioridade**: <P0–P3 — justificativa>
- **Próxima notícia até**: <data e hora prometidas à pessoa>
- **Causa raiz**: <pendente | tag — uma frase> · **Base de conhecimento**: <— | BC-NNN (nova | atualizada)>
- **Destino**: <— | skill `<nome>` em `<pasta>` | escalado a <papel>>
- **Retorno esperado em**: <— | data (escalonamento)>

## Fases

| # | Fase | Situação |
|---|---|---|
| 1 | Recebimento | pendente |
| 2 | Classificação | pendente |
| 3 | Verificação rápida | pendente |
| 4 | Diagnóstico | pendente |
| 5 | Resolução | pendente |
| 6 | Comunicação | pendente |
| 7 | Confirmação | pendente |
| 8 | Escalonamento | pendente |
| 9 | Aprendizado | pendente |

## Relato

- **Tentava fazer**: <...> · **Esperava**: <...> · **Aconteceu**: <...; erro literal sem dado pessoal>
- **Ambiente**: <web/app, navegador, versão, plano> · **Desde**: <...> · **Frequência**: <...>
- **Evidências**: <— | `evidencias/<arquivo>` (fora do git)>

## Classificação
## Verificação
## Diagnóstico
## Acessos
## Resolução
(modelos em atendimento.md)

## Escalonamento
(modelo em escalonamento.md)

## Fechamento

- **Confirmação**: <resolvido, em <data>, "<trecho>" | sem resposta até <data> | não resolveu → fase 4 (<data>)>
- **Desfecho**: <fechada — resolvida | sem resposta do autor | ...>

## A esclarecer
- [A ESCLARECER: <...>]
```
