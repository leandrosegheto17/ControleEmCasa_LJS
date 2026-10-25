import type { Centavos } from '@controle/contrato';
import { percentualArredondado } from './centavos';

/**
 * `pago_por_membro` (RN-16a, CA-16.1 a CA-16.3, CA-11.3): o percentual de cada membro é
 * round(100 × valor ÷ total) e o **último da ordem** recebe 100 − a soma dos anteriores, para a
 * soma ser sempre 100. Total 0 → lista vazia. A ordem dos membros é a recebida (quem chama ordena).
 * Os valores por membro vêm já agregados do SQL (ADR-003); aqui só se distribui o percentual.
 * Origem: F totais_conjunto.sql:26-52.
 */
export function pagoPorMembro<T extends { readonly valorCentavos: Centavos }>(
  membros: readonly T[],
): (T & { readonly percentual: number })[] {
  const total = membros.reduce((soma, m) => soma + m.valorCentavos, 0);
  if (total === 0) return [];
  let somaAnteriores = 0;
  return membros.map((m, i) => {
    if (i === membros.length - 1) return { ...m, percentual: 100 - somaAnteriores };
    const percentual = percentualArredondado(m.valorCentavos, total) ?? 0;
    somaAnteriores += percentual;
    return { ...m, percentual };
  });
}
