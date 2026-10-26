import { useQuery } from '@tanstack/react-query';
import { buscarLocaisGuardados } from '../dados/consultas/locaisGuardados';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';

/** `enabled` evita buscar fora do aporte/retirada, onde a lista é usada. */
export const useLocaisGuardados = ({ enabled }: { enabled: boolean }) =>
  useQuery<string[], ErroDados>({
    queryKey: CHAVES.locaisGuardados,
    queryFn: buscarLocaisGuardados,
    enabled,
  });
