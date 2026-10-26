import { formatarMoeda } from '../../formatacao/moeda';
import type { TipoLancamento } from '../../comum/envio';

/** Texto do botão de envio: o valor e as parcelas já aparecem nele, antes de lançar. */
export function rotuloBotaoLancar(centavos: number, parcelas: number, tipo: TipoLancamento = 'despesa'): string {
  const base = tipo === 'receita' ? 'Lançar receita' : 'Lançar';
  if (centavos <= 0) return base;
  const valor = `${base} ${formatarMoeda(centavos)}`;
  return tipo === 'despesa' && parcelas > 1 ? `${valor} em ${parcelas}x` : valor;
}
