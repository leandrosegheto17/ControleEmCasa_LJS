const formatadorBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export interface OpcoesMoeda {
  /** Acrescenta "+" aos valores positivos (zero fica sem sinal). */
  sinal?: boolean;
}

/**
 * Centavos inteiros (ADR-004) como "R$ 1.234,56". O espaço é o comum, não o NBSP do Intl,
 * para o texto visível e o acessível serem a mesma string. Negativo: "− R$ 300,00" (U+2212).
 */
export function formatarMoeda(centavos: number, opcoes: OpcoesMoeda = {}): string {
  if (!Number.isInteger(centavos)) {
    throw new RangeError(`Valor em centavos deve ser inteiro: ${centavos}`);
  }
  const texto = formatadorBrl.format(Math.abs(centavos) / 100).replace(/[  ]/g, ' ');
  if (centavos < 0) return `− ${texto}`;
  if (centavos > 0 && opcoes.sinal) return `+ ${texto}`;
  return texto;
}

/** "R$ 2.418,70 de R$ 4.300,00": o realizado contra o orçado. */
export const formatarRealizadoDeOrcado = (realizadoCentavos: number, orcadoCentavos: number): string =>
  `${formatarMoeda(realizadoCentavos)} de ${formatarMoeda(orcadoCentavos)}`;
