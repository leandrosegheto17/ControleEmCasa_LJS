import { useQuery } from '@tanstack/react-query';
import { buscarDespesaFixa, buscarDespesasFixas } from '../dados/consultas/despesasFixas';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';

type Lista = Awaited<ReturnType<typeof buscarDespesasFixas>>;
type Modelo = Awaited<ReturnType<typeof buscarDespesaFixa>>;

export const useDespesasFixas = () =>
  useQuery<Lista, ErroDados>({
    queryKey: CHAVES.despesasFixas,
    queryFn: buscarDespesasFixas,
    refetchOnWindowFocus: true,
  });

export const useDespesaFixa = (id: string) =>
  useQuery<Modelo, ErroDados>({
    queryKey: CHAVES.despesaFixa(id),
    queryFn: () => buscarDespesaFixa(id),
    refetchOnWindowFocus: true,
  });
