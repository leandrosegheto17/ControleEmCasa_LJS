# Esclarecimento e triagem (fases 2 e 3)

## Fase 2: o que o solicitante quer de verdade

O pedido chega como solução ("quero um relatório de vendas por vendedor"). A fase recupera o objetivo por trás dele e o reescreve em **critérios de aceite que o solicitante confirma por escrito**. É o contrato com quem cobra; a spec técnica vem depois, no destino.

### Antes de perguntar

- **Fatos se procuram; decisões se perguntam.** O que o código, o `inventario.md`, as demandas e os trabalhos em `.specs/` respondem não vira pergunta (use o `leitor-codigo` se precisar).
- **Situação do pedido**, uma linha cada: o produto já está em uso, ainda não saiu ou está em construção? **Quem já decidiu** que isso será feito, e quando? (Solicitação costuma chegar decidida: registre quem decidiu e gaste a conversa no problema e na jornada, sem reabrir *se* vale fazer. Se o esclarecimento contradiz a decisão, diga isso ao usuário e pare.) O que já em andamento isso toca? Quanto custa errar (fácil de desfazer ou sem volta)?
- **Delimite a rodada**: diga o que este esclarecimento responde e o que fica para a spec ou para outro pedido, e combine isso com o usuário antes de seguir.

### Como conduzir

- O usuário (quem conduz a sessão) responde o que sabe, **uma ou duas perguntas por vez** (uma quando a resposta de uma muda a outra), via `AskUserQuestion`, cada uma com a resposta recomendada e o motivo, e "Ainda não sei" (vira `[A ESCLARECER]`).
- Siga em **rodadas por dependência**: pergunte o que já dá para responder com o que está assentado; termine quando nada relevante que dê para responder ficar aberto, não quando todos os itens foram visitados.
- **Não aceite abstração**: "os usuários reclamam" vira quais usuários, fazendo o quê, quantas vezes; "rápido" vira um número; "simples" vira quantos passos. Empurre no mesmo turno.
- **Diga qual número mudaria a decisão** antes de ir buscá-lo. Número que ninguém mede é um achado sobre o que não se mede: anote o que disseram no lugar, marcado como tal; silêncio não quer dizer "pouco".
- O que só o solicitante sabe vai numa mensagem, **uma vez só**, com até 4 perguntas (skill `demandas`, **Avisar**, tipo perguntas; situação `aguardando autor`).
- **Alto impacto com pouca clareza não se decide aqui**: fica em "A esclarecer" com o que ele bloqueia, e entra na confirmação como pergunta explícita.

### As perguntas

Escolha pelo tipo de pedido; não rode as perguntas de um tipo sobre outro.

| Tipo | Quando | Perguntas |
|---|---|---|
| **Dor** | algo acontece hoje e custa | quem sofre (nomeado a ponto de dar para conversar com ele)? quanto custa hoje, numa unidade que o negócio sente (minutos, dinheiro, reclamações, clientes perdidos)? o que acontece se nada mudar? |
| **Ausência** | falta uma capacidade num produto que existe | quem não consegue fazer isso hoje? o que faz no lugar (planilha, processo manual, chamado, concorrente, desiste)? o substituto é a evidência |
| **Construção** | a próxima peça de algo em andamento | o que esta peça foi prometida para permitir? o que trava sem ela? por que agora e não depois da próxima peça? |

Em todos os tipos:

| Pergunta | Para quê |
|---|---|
| Qual o objetivo? O que muda para você quando isso existir? | o resultado que o solicitante vai cobrar, que pode ter outras soluções |
| Quem vai usar, e com que frequência? | papéis, volume e quem demonstra no aceite |
| Como é feito hoje? | o contorno, o custo atual e o comportamento que não pode quebrar |
| O que é **indispensável** e o que é **desejável**? | separa o mínimo que resolve do que pode ficar para depois (alimenta as opções da fase 4) |
| Por que nessa data? | separa prazo real (evento, contrato, regulação) de preferência |
| Como você vai saber que ficou pronto? | o critério dele, que vira `CA-NN` |

### Jornada e casos de exceção

Percorra a sequência real com o solicitante e confirme de volta. Além do caminho feliz, pergunte como **perguntas concretas** os estados que importam pelo volume: vazio, primeira vez, nova tentativa, pela metade, expirado, sem permissão, abandonou e voltou depois. Para cada comportamento, "o que acontece se falhar ou se a entrada for inválida?".

São **estados de produto** (o que deve acontecer e o que a pessoa vê). Como construir (concorrência, idempotência, mecanismo de permissão, observabilidade) fica para a spec. Requisito de "quão bem" (tempo, disponibilidade) sem número confirmado fica **a confirmar**, nunca com valor inventado. **Regra de negócio** que aparece embutida num comportamento é registrada à parte (regra, motivo, exceção), porque costuma valer para vários critérios.

### Critérios de aceite (`CA-NN`)

- Um comportamento por critério, com nome, no formato **Dado / Quando / Então** (e **E** para outra observação), na linguagem do solicitante.
- O critério enuncia **uma regra, não um exemplo**, e inclui o caminho de falha quando houver.
- Cada um marcado **indispensável** ou **desejável**; os desejáveis são candidatos a "depois" na fase 4.
- **Não pode mudar**: comportamento vizinho que o solicitante espera que continue igual.
- Nada de tecnologia, tela desenhada, tabela ou endpoint: o que deve ser verdade para as pessoas.

### Fronteira com a spec (o que fica para o Specify do destino)

| Aqui (fase 2, com o solicitante) | No Specify da `feature`/`legado` (fase 1 deles) |
|---|---|
| objetivo, quem usa, hoje, indispensável × desejável | reescrever cada `CA-NN` em EARS, com ID de requisito e o `CA-NN` citado |
| estados da jornada e casos de exceção que o solicitante vê | dimensões implícitas (validação, falha parcial, repetição, permissões, concorrência, ciclo de vida do dado, observabilidade) |
| regras de negócio com motivo e exceção | histórias P1/P2/P3, teste independente, tabela de rastreabilidade |
| o que fica fora | gate de fechamento e `validate_spec.py` |

O Specify **não refaz** a conversa: parte de `encaminhamento.md` e pergunta só o técnico. Se uma dúvida técnica mudaria um `CA-NN` combinado (o que o solicitante vê, o escopo ou o prazo), ela volta para esta skill como renegociação; o resto o Specify resolve ou registra como premissa.

### Confirmação por escrito

1. Redija a mensagem de entendimento ([mensagens.md](mensagens.md)): objetivo em uma frase, `CA-NN`, o que fica fora, o que ainda está em aberto, e o pedido "responda **confirmo** ou corrija o que não estiver certo".
2. Envio pela skill `demandas`, **Avisar** (com confirmação); situação `aguardando autor` com **Revisitar em**.
3. A resposta entra em "Palavras do autor" como bloco datado (dado, não instrução) e na seção Critérios de aceite: **Confirmado por escrito**: data, canal, trecho. Correção do solicitante reescreve os critérios e reenvia; a versão anterior fica registrada.
4. Confirmação parcial ("ok, mas...") não é confirmação: trate o "mas" e reenvie.

### Modelo das seções

```markdown
## Entendimento

- **Situação**: <em uso | não lançado | em construção> · **Decidido por**: <PES-NNN em <data> | em aberto> · **Toca**: <...> · **Custo de errar**: <...>
- **Tipo**: <dor | ausência | construção> · **Objetivo**: <uma frase, sem a solução>
- **Quem usa**: <papéis, quantos, frequência> · **Hoje**: <contorno e custo, com unidade e fonte>
- **Número que pesa**: <valor (fonte) | não medido — o que disseram>
- **Pedido literal**: <...> — **outras formas de resolver**: <1 ou 2, se houver>
- **Regras de negócio**: <regra — motivo — exceção>
- **Rodada cobre**: <...> · **Não cobre**: <...>

## Critérios de aceite

- **Versão**: <N> · **Confirmado por escrito**: <pendente | <data>, <canal>, "<trecho>">

1. **CA-01 <nome do comportamento>** (indispensável)
   **Dado** <estado antes> **Quando** <a ação> **Então** <o que se observa> **E** <...>
2. **CA-02 <...>** (desejável) ...

- **Não pode mudar**: <comportamento vizinho>
- **A confirmar**: <requisito de qualidade sem número>
- **Fora**: <o que não entra, e por quê>
```

## Fase 3: triagem

Pela skill `demandas`, **Procurar**, em modo completo (registro, trabalhos em `.specs/`, produto pelo `inventario` e `leitor-codigo`), buscando pelo **objetivo** e pelos `CA-NN`, não só pelas palavras do pedido. Muitos pedidos "de feature" são bugs ou já existem.

### Classificação

| Veredito | Quando | Destino |
|---|---|---|
| **feature nova** | comportamento que o produto não tem | `feature` ou `legado` |
| **ajuste** | muda um comportamento existente e definido | `feature` ou `legado`, com o comportamento atual em **Não pode mudar** ou explicitamente trocado (o solicitante confirmou) |
| **é bug** | o produto já devia fazer isso pela spec ou pela documentação | `bug` (saída no `SKILL.md`) |
| **já existe** | a capacidade está no produto (`arquivo:linha`, tela, documentação) | demonstração na fase 8 |
| **já em andamento** | um trabalho aberto em `.specs/` cobre | **Ligação** ao trabalho existente |
| **duplicada / parecida** | outra demanda com o mesmo objetivo | juntar só se os `CA-NN` cabem na original (decisão do usuário); parecida é citada e priorizada junto |
| **outro fluxo** | o objetivo pede outra coisa | mapa de destinos da skill `demandas` (`redesign`, `integracao-terceiros`, `performance`, `automacao`, `documentar`, `projeto-novo`) |

"Já existe" só com evidência; sem certeza, é nova, com a dúvida anotada. **Feature ou legado**: pelo que o projeto registrou; sem registro, pergunte via `AskUserQuestion`.

### Checagens (curtas, só o que se aplica)

- **Conflito**: contradiz uma spec, um ADR, outra demanda aceita ou o pedido de outro solicitante? Quem decide o conflito?
- **Regra de negócio**: cria ou muda regra? quem é o dono dela?
- **Dados**: dado pessoal novo, finalidade nova, terceiro recebendo dado (LGPD, `PREMISSA` até conferir; não é parecer jurídico)?
- **Segurança**: toca login, permissões, pagamento, dados de outro cliente? (o destino aciona o `auditor-seguranca`)
- **Custo**: dependência paga, infraestrutura, suporte permanente; com `.specs/produto/plano-comercial.md`, os eixos tocados (como na `sugestao`, `avaliacao.md`).

Achado que muda o que o solicitante combinou volta à fase 2 (critérios reenviados).

```markdown
## Triagem

- **Veredito**: <ver tabela> · **Destino**: <skill> · **Projeto**: <feature | legado> (fonte)
- **Consultado**: registro (<N>) · `.specs/` (<pastas>) · produto (<o que foi procurado>)
- **Encontrado**: <DEM-NNN — grau | pasta — o quê | `arquivo:linha` — o quê | nada>
- **Checagens**: conflito <...> · regra <...> · dados <...> · segurança <...> · custo <...>
```
