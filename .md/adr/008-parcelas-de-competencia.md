# ADR-008: Parcelas de competência

- **Status:** Aceito em 2026-10-24 (etapa 5)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RN-06, RN-13, RN-14, RN-15, RN-16 e RN-28 do `PRD-TECNICO.md`; GUARDRAILS G-24 e G-51; SDD §10 (`dominio/parcelas.ts`)
- **Herda (no legado):** ADR-005 §3 do MyMoney (parcelas com data própria; a 1ª no mês seguinte à compra)

## Contexto

- Uma compra no Crédito em 3x conta um terço em cada um dos 3 meses seguintes, não o total no mês da compra. Os totais do mês, o orçamento, o resultado e o gasto do cartão dependem disso (RN-16, G-51).
- O app não tem fatura nem data de fechamento: o casal quer saber em que mês cada parcela pesa.
- No legado a regra estava em `app.gerar_parcelas`, `app.calcular_parcelas` e `app.dia_no_mes`, usadas ao lançar e ao editar. Aqui ela vai para o `backend/dominio` (ADR-003), e a API grava as parcelas que o domínio gera.
- Divergências sutis são o risco principal: arredondamento, último dia do mês, fevereiro bissexto, virada de ano.

## Decisão

1. **Cada lançamento tem parcelas, e a competência de uma parcela é o mês da sua data.** Os totais somam parcelas pelo mês de `parcela.data`, nunca o valor total do cabeçalho (G-51). A soma das parcelas é sempre igual ao total (CA-T5.2).
2. **Uma única função gera as parcelas** (`calcularParcelas`), usada ao lançar e ao recalcular na edição:
   - **Pix e Débito:** 1 parcela do total na data da operação; nº de parcelas ≠ 1 → `valor_invalido`.
   - **Receita:** 1 parcela na data da operação.
   - **Crédito (`gerarParcelas`, 1 a 24 parcelas):** a parcela k vence no dia de vencimento do cartão no mês (mês da compra + k); se o dia não existe, vale o último dia do mês. Sem data de fechamento: a 1ª parcela é sempre no mês seguinte, mesmo comprando no dia do vencimento ou depois dele.
   - **Valores:** base = ⌊total ÷ N⌋; parcelas 2…N = base; parcela 1 = total − base × (N − 1). O resto fica na 1ª parcela. Exige total ≥ N (nenhuma parcela zero).
3. **Dia congelado:** ao lançar no Crédito, grava-se `dia_vencimento_aplicado` = dia atual do cartão. O recálculo de uma edição usa o dia gravado, não o dia atual do cartão, a menos que a forma mude (`diaParaRecalculo`). Mudar o dia do cartão não mexe em parcelas já gravadas (CA-03.3, CA-06.6).
4. **Pagamento de fixa (I-20, correção P7 da RN-28):** o lançamento de pagamento tem sempre 1 parcela, na data de vencimento da ocorrência, qualquer que seja a forma e a data da operação (`parcelasDoPagamentoDeFixa`). No Crédito, o cartão conta o valor na **data de cartão** = próximo vencimento depois da data da operação, pela regra da compra à vista com o dia congelado (`dataDeCartao`). A competência da casa continua no vencimento.
5. **Ajuste manual** da data de uma parcela: só o pagador, só compra no Crédito, nunca a parcela de pagamento de fixa (CA-06.7, CA-28.5). Recalcular descarta os ajustes e exige `confirmar_descarte = true`.
6. Os 12 casos da tabela da RN-14 e os casos do pgTAP `gerar_parcelas.sql` e `dia_no_mes.sql` são testes de unidade do domínio. Um teste de propriedade cobre todo N de 1 a 24 com totais de N a 10^11: soma = total, |parcela 1 − base| < N, demais = base, cada parcela no mês (compra + k).

## Consequências

**Positivas**
- Lançar e editar nunca divergem: a mesma função gera as parcelas nos dois caminhos.
- O total do mês é uma soma simples de parcelas por data, barata em SQL (ADR-003, R1).
- O ajuste manual e o dia congelado ficam explícitos e testados.

**Negativas**
- O gasto do cartão com pagamento de fixa no Crédito usa a data de cartão, que não é a data da parcela. A consulta SQL da etapa 9 precisa dessa data sem função de regra no banco: ela deve ser gravada pela API (calculada por `dataDeCartao`) ou derivada na consulta com a mesma regra, coberta por teste de integração.
- Sem fatura, a "1ª parcela no mês seguinte" pode não coincidir com a fatura real de um cartão com fechamento tardio. A tela avisa "1ª parcela em dd/mm" (CA-14.2, I-18).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Competência pela data da compra | Uma compra em 12x pesaria inteira num mês; contraria a RN-14 e o legado |
| Fatura com data de fechamento | Exige cadastro de fechamento por cartão e muda todos os totais; fora do escopo do legado |
| Resto na última parcela | Diverge do legado (os valores mudariam na migração) |
| Gerar parcelas em SQL (`generate_series`) | Contraria o ADR-003 (sem função de regra no banco) e duplicaria a regra do lançamento e da edição |
