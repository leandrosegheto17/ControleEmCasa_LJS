# Custo total e decisão (fase 9)

Responde: **vale a pena?** Somar o preço, o custo de corrigir o que foi achado e o de manter, e comparar com a alternativa. A sessão recomenda; **o usuário decide**.

## 1. Custo total

Para um horizonte combinado com o usuário (sugestão: 2 anos), some, cada parcela com sua natureza: **real** (proposta, fatura, preço com fonte e data), **estimativa** (com a base) ou **não quantificável** (nunca um número inventado para parecer rigoroso).

| Parcela | De onde vem |
|---|---|
| Preço | proposta, licença, assinatura, licença comercial de dependência (`legal.md`) |
| Corrigir antes de usar | `achados.md`: soma do custo das linhas `condição` e `custo` que caem para "nós" |
| Rodar | custo mensal de `dependencias.md` × meses |
| Manter | horas por mês de `saude.md` × meses × custo da hora (pergunte o valor da hora ao usuário) |
| Obrigações | atribuição, oferta de código, auditoria de licenças (`legal.md`) |
| Sair | migrar dados e trocar o que prende (`dependencias.md`), se a adoção der errado |

Some como **faixa** (mínimo e máximo). Achado `não quantificável` aparece ao lado da soma, não some dentro dela.

## 2. Comparar com a alternativa

- **Construir do zero**: estimativa do que seria preciso para o **Bom resultado** (não para clonar tudo o que o candidato tem), com a base declarada. Construir só se justifica no que diferencia o produto; o que é comum se compra ou se adota.
- **Outro candidato ou ficar como está**: se há alternativas reais, acione a skill `escolha-tecnologia` com o contrato de [composicao.md](composicao.md).
- Na tabela, por opção: controle, tempo até funcionar, custo total (faixa), dependência do fornecedor, **reversibilidade** (quanto custaria desfazer em 6, 12 e 24 meses).

## 3. Critérios e fator decisivo

- Cada eliminatório de `avaliacao.md`: `passou`, `falhou` (com o achado) ou `não verificado` (com o que falta ver).
- Cada desejável com nota e peso; a soma ajuda, mas não decide sozinha.
- **Nomeie o fator decisivo** (licença, custo, risco de segurança, fator ônibus, tempo) em vez de apresentar a tabela como empate neutro.
- Diga **sob que condição a recomendação mudaria** (ex.: "adotar passa a valer se o vendedor entregar a cessão e corrigir os dois altos antes de fechar").

## 4. A decisão

Pergunte via `AskUserQuestion`, a recomendada primeiro:

| Decisão | Quando | O que leva adiante |
|---|---|---|
| **Adotar** | eliminatórios passaram; nenhum `impeditivo` ou `condição` aberto | próximos passos (relatório) |
| **Adotar com condições** | há `condição` que se resolve antes ou por contrato | lista de condições, cada uma com quem resolve, prazo e como se confere (reteste, documento) |
| **Renegociar** | o problema tem preço: custo de corrigir abatido, cessão, período de suporte, depósito do código-fonte, correções pelo vendedor antes de fechar | argumentos com os achados e os números; o que pedir; limite abaixo do qual recusar |
| **Recusar** | eliminatório falhou sem solução, ou o custo total passa o de construir ou o da alternativa | motivo e o que mudaria a resposta |

Com `impeditivo` aberto, **adotar não é a opção recomendada**. Risco que o usuário aceita conscientemente vai para **Riscos aceitos**, com dono e data de revisão.

Negociar, assinar e pagar são ações do usuário: a avaliação prepara os argumentos, não fala com o vendedor.

## Modelo de `decisao.md`

```markdown
# Decisão: <slug>

- **Data**: <AAAA-MM-DD> · **Horizonte**: <N meses> · **Valor da hora usado**: <...> (do usuário)
- **Decisão**: <adotar | adotar com condições | renegociar | recusar> (decidido pelo usuário em <data>)
- **Fator decisivo**: <...> · **Mudaria se**: <...>

## Custo total
| Parcela | Mínimo | Máximo | Natureza | Fonte |
|---|---|---|---|---|
| **Total** | | | | |
- **Não quantificável**: <achado — por quê>

## Comparação
| Opção | Controle | Tempo até funcionar | Custo total | Dependência | Reversibilidade |
|---|---|---|---|---|---|
- Escolha de tecnologia: <não usada | `.specs/escolhas/<slug>/` e ADR>

## Critérios
| # | Critério | Situação | Achado ou evidência |
|---|---|---|---|

## Condições
| # | Condição | Quem resolve | Prazo | Como se confere |
|---|---|---|---|---|

## Riscos aceitos
| Risco | Dono | Revisar em |
|---|---|---|

## Para negociar
- <argumento com número e achado>
```
