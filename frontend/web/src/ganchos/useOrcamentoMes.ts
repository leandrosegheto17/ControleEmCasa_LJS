import { useQuery } from '@tanstack/react-query';
import type { Escopo } from '../comum/enums';
import { buscarOrcamentoMes } from '../dados/consultas/orcamentoMes';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';

type Resposta = Awaited<ReturnType<typeof buscarOrcamentoMes>>;

/** Sem `keepPreviousData`: trocar de mês ou de escopo volta ao esqueleto. */
export const useOrcamentoMes = (mes: string, escopo: Escopo) =>
  useQuery<Resposta, ErroDados>({
    queryKey: CHAVES.orcamentoDoMes(mes, escopo),
    queryFn: () => buscarOrcamentoMes(mes, escopo),
    refetchOnWindowFocus: true,
  });
