import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { buscarLancamentosMes } from '../dados/consultas/lancamentosMes';
import type { ErroDados } from '../dados/erros';
import type { FiltrosDaLista } from '../formatacao/filtrosLancamentos';
import { CHAVES } from './chavesConsulta';

type Lista = Awaited<ReturnType<typeof buscarLancamentosMes>>;

/** Trocar o filtro mantém a lista anterior até a nova chegar, sem voltar ao esqueleto. */
export const useLancamentosMes = (mes: string, filtros: FiltrosDaLista) =>
  useQuery<Lista, ErroDados>({
    queryKey: [...CHAVES.lancamentosMes, mes, filtros],
    queryFn: () => buscarLancamentosMes({ mes, ...filtros }),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
