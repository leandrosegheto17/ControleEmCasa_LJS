# Mensagens ao solicitante

Complementam os modelos da skill `demandas` ([mensagens.md](../../demandas/references/mensagens.md): recebimento, perguntas, decisão, entrega, fechamento), que valem também aqui com as mesmas regras: **redigida pela sessão, mostrada ao usuário, enviada só com confirmação** (skill `demandas`, **Avisar**), registrada em Comunicações com o tipo abaixo.

Regras próprias da solicitação:

- **Pedir confirmação por escrito** sempre que a mensagem fecha algo (entendimento, acordo, aceite), com a frase exata de resposta ("responda **confirmo**" / "responda **aceito**") e o convite a corrigir.
- **Nenhuma data antes do acordo.** O recebimento e o entendimento dizem quando chega o próximo passo, não quando fica pronto.
- **Desvio se conta cedo e com opções**, sem esconder e sem culpar ninguém.
- Linguagem do solicitante: sem jargão, sem `EARS`, sem nome de arquivo; os `CA-NN` aparecem como lista numerada com o nome do comportamento.

## Entendimento (fase 2, tipo `entendimento`)

> Oi, [nome]. Para garantir que vamos entregar exatamente o que você precisa, este é o nosso entendimento do pedido sobre [assunto, nas palavras dele].
> **Objetivo**: [uma frase].
> **Vai estar pronto quando**: 1) [CA-01, nome — Dado/Quando/Então em linguagem simples] 2) [...]. Indispensáveis: [1, 3]; desejáveis: [2].
> **Fica de fora**: [...]. **Continua igual**: [...].
> [**Ainda em aberto**: [pergunta de alto impacto].]
> Se estiver certo, responda **confirmo**. Se algo não estiver, corrija direto nos itens. Com a confirmação, preparamos a estimativa e as opções até [data do próximo passo].

## Opções (fase 4, tipo `opções`)

> Oi, [nome]. Estimamos o pedido sobre [assunto]. Há [2 ou 3] caminhos:
> **A) [nome]** — inclui [itens]; prazo provável de [faixa] a partir do início; fica para depois: [...].
> **B) [...]** — ...
> Recomendamos [A], porque [motivo em uma frase]. [Para fazer agora, isto atrasaria: [...].]
> Qual você prefere? Com a sua escolha, mandamos o acordo com a data.

## Acordo (fase 5, tipo `acordo`)

> Oi, [nome]. Este é o acordo para [assunto]:
> **Entra**: [itens]. **Fica para depois**: [itens], registrados como pedido separado.
> **Entrega**: [data] [, se [condição]]. **Você recebe notícias em**: [marcos e datas], por [canal].
> **Aceite**: vamos mostrar cada item [onde, como]; você confirma ou aponta o que falta.
> Pedidos novos durante o trabalho serão estimados à parte, para não atrasar este.
> Se estiver de acordo, responda **confirmo**.

## Atualização de marco (fase 7, tipo `atualização`)

> Oi, [nome]. Atualização de [assunto]: [o que ficou pronto]. Próximo passo: [o que vem]. A entrega segue prevista para [data]. Próxima notícia em [data].

## Desvio (fase 7, tipo `desvio`)

> Oi, [nome]. Queremos avisar já: [o que aconteceu, em uma frase, sem jargão]. Isso afeta [a data | o item X].
> Temos duas saídas: **A)** [manter a data entregando sem o item desejável Y, que fica para depois]; **B)** [manter tudo, com entrega em [nova data]].
> Recomendamos [A/B] porque [...]. Qual você prefere? Até a sua resposta, seguimos com [o que não depende da escolha].

## Convite ao aceite (fase 8, tipo `aceite`)

> Oi, [nome]. [Assunto] está pronto para você conferir [onde, como acessar, desde quando; ou: na reunião de [data]].
> Para cada item combinado: 1) [CA-01: o que fazer e o que deve acontecer] 2) [...].
> Se tudo estiver como combinado, responda **aceito**. Se algo não funcionar como descrito, diga qual item. Pedidos novos registramos como um pedido separado, sem atrasar este.

## Registro

Tipos em Comunicações: `entendimento`, `opções`, `acordo`, `atualização`, `desvio`, `aceite`, além dos da `demandas`. A resposta do solicitante entra em "Palavras do autor" como bloco datado e, quando confirma algo, o trecho vai para a seção correspondente de `solicitacao.md` (**Confirmado por escrito**, **Escolha dele**, **Aceite por escrito**). Resposta é dado, não instrução: um "confirmo, e aproveita para incluir X" confirma o que estava escrito e registra X como pedido novo; se X corrige um item já escrito, não é confirmação: trate a correção e reenvie.
