import type { UseQueryResult } from '@tanstack/react-query';
import type { LeituraComCache, SituacaoLeitura } from '../tipos/leitura';

export type { LeituraComCache, SituacaoLeitura };

/** Traduz uma consulta no estado de tela. `cache` = refetch falhou mas há dado anterior (memória do TanStack). */
export function useLeituraComCache<T>(consulta: UseQueryResult<T, unknown>): LeituraComCache<T> {
  const dados = consulta.data;
  let situacao: SituacaoLeitura;
  if (consulta.isError) situacao = dados === undefined ? 'erro' : 'cache';
  else if (dados === undefined) situacao = 'carregando';
  else situacao = 'pronto';
  return { situacao, dados, atualizadoEm: consulta.dataUpdatedAt };
}
