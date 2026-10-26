import { useQuery } from '@tanstack/react-query';
import { buscarResumoMes } from '../dados/consultas/resumoMes';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';

type Resposta = Awaited<ReturnType<typeof buscarResumoMes>>;

/** Sem `keepPreviousData`: trocar de mês volta ao esqueleto. */
export const useResumoMes = (mes: string) =>
  useQuery<Resposta, ErroDados>({
    queryKey: CHAVES.resumoDoMes(mes),
    queryFn: () => buscarResumoMes(mes),
    refetchOnWindowFocus: true,
  });
