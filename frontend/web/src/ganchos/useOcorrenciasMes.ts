import { useQuery } from '@tanstack/react-query';
import { buscarOcorrenciasMes } from '../dados/consultas/ocorrenciasMes';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';

type Resposta = Awaited<ReturnType<typeof buscarOcorrenciasMes>>;

/** Sem `keepPreviousData`: trocar de mês volta ao esqueleto. */
export const useOcorrenciasMes = (mes: string) =>
  useQuery<Resposta, ErroDados>({
    queryKey: CHAVES.ocorrenciasDoMes(mes),
    queryFn: () => buscarOcorrenciasMes(mes),
    refetchOnWindowFocus: true,
  });
