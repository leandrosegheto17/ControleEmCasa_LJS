import { useQuery } from '@tanstack/react-query';
import type { ErroDados } from '../dados/erros';
import { buscarMovimentosMeta } from '../dados/consultas/movimentosMeta';
import { ehUuid } from '../comum/uuid';
import { CHAVES } from './chavesConsulta';

export const useMovimentosMeta = (metaId: string) =>
  useQuery<Awaited<ReturnType<typeof buscarMovimentosMeta>>, ErroDados>({
    queryKey: CHAVES.movimentosDaMeta(metaId),
    queryFn: () => buscarMovimentosMeta(metaId),
    enabled: ehUuid(metaId),
    refetchOnWindowFocus: true,
  });
