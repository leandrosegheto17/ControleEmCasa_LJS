# Comunicação (fase 9, e avisos durante o incidente)

Quem precisa saber, o quê e quando. **Toda mensagem é redigida aqui e enviada só com confirmação específica** (para quem, por qual canal, texto final). Nada de culpa nem de nome de pessoa nas mensagens.

## Durante o incidente (fases 1 a 3)

Aviso inicial quando houver usuários afetados ou equipe a mobilizar; atualização em intervalo combinado (sugestão: a cada 30 minutos em P0, mesmo sem novidade); aviso de resolução ao estabilizar. Registre cada envio na tabela "Comunicações durante o incidente" do `incidente.md`.

```
INCIDENTE: <sistema> — <sintoma em uma linha>
Situação: investigando | contendo | monitorando | resolvido
Impacto: <o que não funciona, para quem>
Desde: <hora>
O que estamos fazendo: <1 a 2 itens>
Próxima atualização: <hora>
```

Resolução:

```
RESOLVIDO: <sistema> — <sintoma>
Duração: <min> · Impacto: <resumo>
O que foi feito: <reversão, correção>
O que você precisa fazer: <nada | ação>
Próximos passos: análise da causa e prevenção em andamento.
```

## Fase 9: quem precisa saber

| Público | O que dizer | Quando |
|---|---|---|
| Usuários afetados | o que aconteceu, por quanto tempo, se algo deles foi afetado, o que fazer | ao fim, se houve impacto percebido; quem abriu caso de suporte (**Casos de suporte**) recebe o aviso pela skill `suporte`, já ao estabilizar |
| Cliente ou contratante | resumo do post-mortem e ações, conforme o contrato (prazo de aviso, SLA) | conforme o contrato |
| Equipe | post-mortem e ações com responsável | ao fim |
| Terceiros envolvidos | fornecedor cuja falha causou o incidente, parceiro afetado | quando couber |
| ANPD e titulares | só com dado pessoal afetado: veja abaixo | prazo legal |

Aviso a terceiros é ação externa: confirme cada envio. Mensagem a cliente com efeito contratual (SLA, multa, crédito) pede revisão humana antes.

## Dado pessoal afetado: LGPD

> **A parte legal pede avaliação humana.** Esta seção ajuda a juntar o material; quem decide se e como notificar é o responsável pelos dados (controlador), com o encarregado de dados ou o jurídico. Não é parecer jurídico.

O que a regra diz, a conferir na fonte oficial na hora (`pesquisador`, site da ANPD em gov.br/anpd), porque pode mudar:

- **LGPD, art. 48**: o controlador comunica à ANPD e ao titular o incidente de segurança que possa acarretar **risco ou dano relevante** aos titulares.
- **Regulamento de Comunicação de Incidente de Segurança (Resolução CD/ANPD nº 15/2024)**: prazo de **3 dias úteis** contados do conhecimento de que o incidente afetou dados pessoais; comunicação pelo canal da ANPD; informações complementares podem vir depois, dentro do prazo do regulamento; o **registro do incidente** é mantido por anos (conferir o prazo) **mesmo quando não há comunicação**. `PREMISSA` até a conferência.
- **Risco ou dano relevante** costuma envolver: dados sensíveis, de crianças, adolescentes ou idosos, financeiros, de autenticação, protegidos por sigilo, ou grande volume de titulares. Confira os critérios atuais.
- **Quem notifica**: o **controlador**. Se o projeto trata dados em nome de um cliente (operador), o dever imediato é **avisar o cliente** (controlador), que decide e notifica.

Junte para quem decide:

- Data e hora do conhecimento (`incidente.md`) e o prazo resultante.
- Natureza e categorias dos dados, número de titulares, se estavam criptografados.
- Riscos prováveis para os titulares; medidas tomadas (contenção, troca de credenciais, correção) e medidas que os titulares devem tomar.
- Contato do encarregado.

Pergunte via `AskUserQuestion` qual a decisão de quem responde pelos dados: **notificar** (redigir o texto para revisão humana; o envio é feito por quem responde, ou com confirmação específica), **não notificar, com justificativa registrada**, ou **ainda em avaliação** (registre o prazo e lembre antes de vencer).

Mensagem aos titulares: linguagem simples; o que aconteceu, quais dados, riscos, o que já foi feito, o que a pessoa deve fazer (trocar senha, atenção a golpes), contato.

## Modelo de `comunicacao.md`

```markdown
# Comunicação: <id>

| Público | Canal | Mensagem | Enviado | Por |
|---|---|---|---|---|
| <usuários afetados> | <e-mail, aviso no app> | <resumo ou link> | sim em <data> | dispensado (<motivo>) | <pessoa> |

## LGPD

- **Dado pessoal afetado**: não | sim
- **Conhecido em**: <data hora> · **Prazo**: <data> · **Regra conferida em**: <fonte, data>
- **Papel**: controlador | operador (cliente avisado em <data>)
- **Avaliação de quem responde**: <pessoa ou papel> — notificar | não notificar (<justificativa>) | em avaliação
- **ANPD**: comunicada em <data, protocolo> | não se aplica · **Titulares**: comunicados em <data> | não se aplica
- **Registro do incidente guardado em**: <onde>
```

Ao concluir, marque `Encerrado: sim` no `incidente.md`. Com a LGPD ainda em avaliação, o incidente não se encerra: fica na fase 9 com o prazo registrado.
