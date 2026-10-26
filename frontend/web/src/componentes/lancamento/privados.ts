import type { SaidaLancamento as Lancamento } from '@controle/contrato';

/**
 * As chaves privadas do pagador (`pagamento`; `data_ajustada` em cada parcela) NÃO EXISTEM na resposta para o outro
 * membro (RN-04, G-11): a tela lê pela presença da chave, nunca como campo nulo.
 */
export const pagamentoDe = (lancamento: Lancamento) => ('pagamento' in lancamento ? lancamento.pagamento : undefined);

export const dataAjustada = (parcela: Lancamento['parcelas'][number]): boolean =>
  'data_ajustada' in parcela && parcela.data_ajustada;
