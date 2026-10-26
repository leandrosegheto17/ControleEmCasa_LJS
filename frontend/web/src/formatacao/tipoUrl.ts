import type { TipoLancamento } from '../comum/enums';

/** Lê `?tipo=despesa|receita`; qualquer outro valor cai em despesa. */
export function lerTipoDaUrl(params: URLSearchParams): TipoLancamento {
  return params.get('tipo') === 'receita' ? 'receita' : 'despesa';
}
