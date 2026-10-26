import { useQuery } from '@tanstack/react-query';
import { buscarLancamento } from '../dados/consultas/lancamento';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';

export const useLancamento = (id: string) =>
  useQuery<Awaited<ReturnType<typeof buscarLancamento>>, ErroDados>({
    queryKey: CHAVES.lancamento(id),
    queryFn: () => buscarLancamento(id),
    refetchOnWindowFocus: true,
  });
