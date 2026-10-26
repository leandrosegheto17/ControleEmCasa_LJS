import type { QueryClient } from '@tanstack/react-query';
import { CHAVE_SESSAO } from './useSessao';

/**
 * Esvazia o cache de dados do TanStack Query (G-39: o aparelho deixa de mostrar dado do usuário que saiu).
 * A consulta da sessão não é removida (quem a observa precisaria reassinar): quando a sessão acabou, ela vira `null`.
 */
export function esvaziarCache(cliente: QueryClient, opcoes: { sessaoAcabou: boolean }): void {
  cliente.removeQueries({ predicate: (consulta) => consulta.queryKey[0] !== CHAVE_SESSAO[0] });
  cliente.getMutationCache().clear();
  if (opcoes.sessaoAcabou) cliente.setQueryData(CHAVE_SESSAO, null);
}
