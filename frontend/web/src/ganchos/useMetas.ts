import { useQuery } from '@tanstack/react-query';
import { buscarMeta, buscarMetas } from '../dados/consultas/metas';
import type { ErroDados } from '../dados/erros';
import { ehUuid } from '../comum/uuid';
import { CHAVES } from './chavesConsulta';

type Lista = Awaited<ReturnType<typeof buscarMetas>>;
type Modelo = Awaited<ReturnType<typeof buscarMeta>>;

export const useMetas = () =>
  useQuery<Lista, ErroDados>({ queryKey: CHAVES.metas, queryFn: buscarMetas, refetchOnWindowFocus: true });

export const useMeta = (id: string) =>
  useQuery<Modelo, ErroDados>({
    queryKey: CHAVES.meta(id),
    queryFn: () => buscarMeta(id),
    enabled: ehUuid(id),
    refetchOnWindowFocus: true,
  });
