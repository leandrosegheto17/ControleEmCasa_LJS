import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { escreverFiltrosNaUrl, lerFiltrosDaUrl, type FiltrosUrl } from '../formatacao/filtrosLancamentos';

/** Filtros da lista na URL, com os setters que preservam `mes` e não acrescentam entrada no histórico. */
export function useFiltrosDaUrl(): [FiltrosUrl, (filtros: FiltrosUrl) => void, () => void] {
  const [params, definirParams] = useSearchParams();
  const definir = useCallback(
    (novos: FiltrosUrl) => definirParams((atual) => escreverFiltrosNaUrl(atual, novos), { replace: true }),
    [definirParams],
  );
  const limpar = useCallback(() => definir({}), [definir]);
  return [lerFiltrosDaUrl(params), definir, limpar];
}
