import type { Centavos } from '@controle/contrato';
import { divisaoParaCima, ehCentavos, percentualArredondado } from './centavos';
import { ehDataCalendario, mesesEntre, type DataCalendario } from './datas';

/**
 * Progresso da meta (RN-08), sempre em inteiros. O guardado (Σ aportes − Σ retiradas) chega já
 * somado do SQL (ADR-003); "por local" também é consulta SQL.
 */

/** O percentual nunca mostra 100 antes de a meta ser atingida. */
export const PERCENTUAL_MAXIMO_NAO_ATINGIDA = 99;

export interface ProgressoMeta {
  readonly guardadoCentavos: Centavos;
  readonly faltaCentavos: Centavos;
  readonly percentual: number;
  /** Nulo sem prazo ou quando não falta nada. */
  readonly mensalNecessarioCentavos: Centavos | null;
  readonly atingida: boolean;
}

/**
 * - falta = max(0, alvo − guardado);
 * - percentual = guardado < alvo ? min(99, round(100 × guardado ÷ alvo)) : 100;
 * - meses = max(1, (ano×12+mês do prazo) − (ano×12+mês de hoje)) — prazo no mês corrente ou vencido
 *   pede a falta inteira;
 * - mensal necessário = há prazo e falta > 0 ? ⌈falta ÷ meses⌉ : nulo;
 * - atingida = guardado ≥ alvo.
 * Origem: F progresso_meta.sql:1-56.
 */
export function progressoMeta(entrada: {
  readonly alvoCentavos: Centavos;
  readonly guardadoCentavos: Centavos;
  /** Qualquer data do mês do prazo (gravado como dia 1), ou nulo. */
  readonly prazo: DataCalendario | null;
  readonly hoje: DataCalendario;
}): ProgressoMeta {
  const { alvoCentavos: alvo, guardadoCentavos: guardado, prazo, hoje } = entrada;
  if (!ehCentavos(alvo) || alvo <= 0 || !ehCentavos(guardado)) throw new RangeError('meta inválida');
  if (!ehDataCalendario(hoje) || (prazo !== null && !ehDataCalendario(prazo))) throw new RangeError('data inválida');

  const falta = Math.max(0, alvo - guardado);
  const atingida = guardado >= alvo;
  const percentual = atingida
    ? 100
    : Math.min(PERCENTUAL_MAXIMO_NAO_ATINGIDA, percentualArredondado(guardado, alvo) ?? 0);
  const meses = prazo === null ? null : Math.max(1, mesesEntre(hoje, prazo));
  const mensal = meses === null || falta === 0 ? null : divisaoParaCima(falta, meses);
  return { guardadoCentavos: guardado, faltaCentavos: falta, percentual, mensalNecessarioCentavos: mensal, atingida };
}

/**
 * Novo `atingida_em` (CA-08.3, CA-08.4): marca com hoje quando a meta passa a estar atingida,
 * mantém a data original se já estava marcada, e desmarca quando deixa de estar. Reavaliado a cada
 * movimento e a cada edição do alvo. Origem: F sincronizar_atingida_meta.sql:1-16.
 */
export function atingidaEm(entrada: {
  readonly atingidaEmAtual: DataCalendario | null;
  readonly atingida: boolean;
  readonly hoje: DataCalendario;
}): DataCalendario | null {
  if (!entrada.atingida) return null;
  return entrada.atingidaEmAtual ?? entrada.hoje;
}
