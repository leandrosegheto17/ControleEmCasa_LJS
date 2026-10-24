# Plano comercial: método e modelo

## Ponto de equilíbrio (seção 6)

1. **Custos fixos iniciais**: desenvolvimento até o lançamento (tempo próprio valorado: horas × valor/hora declarado), taxas de abertura de canal (conta de desenvolvedor em loja, registro de domínio), ferramentas.
2. **Custos mensais recorrentes**: infraestrutura (de `viabilidade-tecnica.md`), ferramentas e licenças, operação (suporte, conteúdo, manutenção).
3. **Receita líquida por venda**: preço − comissão do canal − custo variável por venda (impostos sobre a venda, meios de pagamento, custo de aquisição quando a aquisição é paga).
4. **A conta**:
   - venda única: vendas necessárias = (custos fixos + custos mensais × meses do horizonte) ÷ receita líquida por venda;
   - assinatura: declare a permanência média (ou a taxa de cancelamento) como premissa e use a receita acumulada por assinante no horizonte.
5. **Plausibilidade**: esse número de vendas é alcançável no horizonte, dado o tamanho do público (seção 2) e o canal (seção 3)? Se não, **a conta não fecha**. Aponte a variável mais sensível (preço, custo de aquisição, custo fixo, horizonte) e o valor que a faria fechar.

## Checklist de consistência

Antes de gravar, confira:

1. O preço (seção 1) é coerente com os preços dos concorrentes (seção 4), ou a diferença está justificada.
2. A disposição a pagar do público (seção 2) não contradiz o preço (seção 1) sem explicação.
3. O custo de aquisição usado na conta (seção 6) é o mesmo da seção 3.
4. As vendas necessárias (seção 6) são plausíveis frente ao público alcançável (seção 2), ou a implausibilidade aparece no veredito.
5. As premissas críticas da seção 5 aparecem na seção 7.
6. O veredito do topo bate com as seções 5 e 6.

## Modelo de `.specs/produto/plano-comercial.md`

```markdown
# Plano comercial: <título curto>

> **Veredito: a conta fecha | a conta NÃO fecha | fecha se <premissa>**
> <uma frase de leitura honesta> — <AAAA-MM-DD>

## 1. Proposta de valor e modelo de venda

- **Proposta de valor**: <o que o cliente ganha, em uma frase>
- **Modelo**: venda única | assinatura | freemium | comissão | anúncio | outro
- **Preço**: <valor> — âncora: <concorrente ou referência>

## 2. Público-alvo

- **Cliente principal**: <perfil de quem paga>
- **Usuário** (se diferente de quem paga): <perfil>
- **Tamanho do público alcançável**: <estimativa> — [fonte | PREMISSA]
- **Disposição a pagar**: <sinal> — [fonte | PREMISSA]

## 3. Canais

| Canal | Por que serve a esse público | Custo (comissão, anúncio, tempo) | Principal? |
|---|---|---|---|
| <...> | <...> | <...> [fonte] | sim/não |

- **Custo de aquisição por cliente no canal principal**: <valor> — [fonte | PREMISSA]

## 4. Concorrentes e diferenciação

| Concorrente | Tipo (direto/indireto/gratuito) | Preço e modelo | Ponto forte | Ponto fraco |
|---|---|---|---|---|
| <...> | <...> | <...> [fonte] | <...> | <...> |

- **Nossa diferença**: <por que alguém escolheria a nossa solução>

## 5. Chance de dar certo

- **Estimativa**: <N>% — leitura: <baixa/média/alta>
- **Premissas que sustentam o número**:
  1. <premissa> — [evidência | não validada]
- **O que mais aumentaria a chance**: <...>

## 6. Ponto de equilíbrio

| Custo | Tipo | Valor | Fonte |
|---|---|---|---|
| Desenvolvimento (<h> horas × <valor/h>) | fixo | <...> | PREMISSA do usuário |
| Infraestrutura | mensal | <...> | viabilidade-tecnica.md |
| <...> | ... | ... | ... |

- **Receita líquida por venda**: <preço> − <comissão> − <custo variável> = <valor>
- **Horizonte**: <meses>
- **Vendas até o ponto de equilíbrio**: <número> (<por mês>)
- **Plausível?** <sim/não, frente ao público e ao canal>
- **Se não fecha**: variável mais sensível = <...>; fecharia com <valor>

## 7. Premissas e riscos comerciais em aberto

| Premissa ou risco | Impacto se falhar | Como validar |
|---|---|---|
| <...> | <...> | <...> |
```
