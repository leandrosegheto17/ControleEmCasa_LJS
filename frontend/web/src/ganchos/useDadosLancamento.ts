import { useQuery } from '@tanstack/react-query';
import { buscarDadosLancamento, lerDadosDoAparelho } from '../dados/consultas/dadosLancamento';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';

/**
 * `networkMode: 'always'`: com o modo padrão o TanStack pausa a consulta sem rede e o
 * recurso ao cache do aparelho nunca rodaria. O cache local aparece de imediato enquanto
 * a rede responde.
 */
export function useDadosLancamento() {
  const aparelho = useQuery({
    queryKey: CHAVES.dadosLancamentoAparelho,
    queryFn: async () => (await lerDadosDoAparelho()) ?? null,
    networkMode: 'always',
    staleTime: Infinity,
  });
  return useQuery<Awaited<ReturnType<typeof buscarDadosLancamento>>, ErroDados>({
    queryKey: CHAVES.dadosLancamento,
    queryFn: buscarDadosLancamento,
    networkMode: 'always',
    placeholderData: aparelho.data ?? undefined,
  });
}
