import type { Centavos } from '@controle/contrato';
import { ehCentavos, percentualArredondado } from './centavos';

/**
 * Situação do orçamento (RN-16, "Orçamento"). O orçado e o realizado chegam já agregados do SQL
 * (ADR-003); aqui só se decide a situação e os destaques.
 */

export type SituacaoOrcamento = 'dentro' | 'atencao' | 'estourado';

/** Limiar de atenção: 80% do orçado. */
export const LIMIAR_ATENCAO_PERCENTUAL = 80;

/** Quantidade de destaques do orçamento no resumo do mês. */
export const QUANTIDADE_DESTAQUES = 3;

/**
 * Percentual (só exibição) e situação de um orçamento, por categoria ou no total do escopo.
 * A situação usa a **razão exata em inteiros**, nunca o percentual arredondado (CA-T5.3):
 * realizado × 100 < orçado × 80 → `dentro`; realizado ≤ orçado → `atencao`; senão `estourado`.
 * Assim 79,99% aparece como 80% e continua `dentro`; 100,01% aparece como 100% e é `estourado`.
 * Orçado 0 → percentual nulo. Origem: F situacao_orcamento.sql:1-18.
 */
export function situacaoOrcamento(
  orcadoCentavos: Centavos,
  realizadoCentavos: Centavos,
): { readonly percentual: number | null; readonly situacao: SituacaoOrcamento } {
  if (!ehCentavos(orcadoCentavos) || !ehCentavos(realizadoCentavos)) throw new RangeError('centavos inválidos');
  const realizado = BigInt(realizadoCentavos);
  const orcado = BigInt(orcadoCentavos);
  const situacao: SituacaoOrcamento =
    realizado * 100n < orcado * BigInt(LIMIAR_ATENCAO_PERCENTUAL)
      ? 'dentro'
      : realizado <= orcado
        ? 'atencao'
        : 'estourado';
  return { percentual: percentualArredondado(realizadoCentavos, orcadoCentavos), situacao };
}

const colacao = new Intl.Collator('pt-BR');

/**
 * Ordem das linhas do orçamento: percentual decrescente, depois nome (I-10). Percentual nulo vem
 * primeiro, como o `order by … desc` do Postgres. Origem: F orcado_realizado.sql:5,38.
 */
export function compararLinhasOrcamento(
  a: { readonly percentual: number | null; readonly nome: string },
  b: { readonly percentual: number | null; readonly nome: string },
): number {
  if (a.percentual !== b.percentual) {
    if (a.percentual === null) return -1;
    if (b.percentual === null) return 1;
    return b.percentual - a.percentual;
  }
  return colacao.compare(a.nome, b.nome);
}

/** Destaques do resumo: as 3 primeiras linhas na ordem do orçamento. Origem: F resumo_orcamento.sql:1-14. */
export function destaquesOrcamento<T extends { readonly percentual: number | null; readonly nome: string }>(
  linhas: readonly T[],
): T[] {
  return [...linhas].sort(compararLinhasOrcamento).slice(0, QUANTIDADE_DESTAQUES);
}
