import type { QueryClient } from '@tanstack/react-query';
import { encerrarNoAparelho } from './dados/sessao';
import { definirAoPerderSessao } from './dados/transporte';
import { esvaziarCache } from './ganchos/esvaziarCache';

interface Navegador {
  navigate: (para: string, opcoes?: { replace?: boolean }) => unknown;
  state: { location: { pathname: string; search: string } };
}

/**
 * Um 401 em qualquer chamada (sessão revogada ou expirada): invalida o cache, limpa o aparelho (G-39) e leva a
 * `/entrar?volta=` com a tela onde a pessoa estava (SDD 9.2). A fila offline não é apagada: fica retida pelo dono.
 * Devolve a função que desliga o ouvinte.
 */
export function ligarPerdaDeSessao(cliente: QueryClient, roteador: Navegador): () => void {
  let emCurso = false;
  definirAoPerderSessao(() => {
    if (emCurso) return;
    emCurso = true;
    const { pathname, search } = roteador.state.location;
    esvaziarCache(cliente, { sessaoAcabou: true });
    void encerrarNoAparelho().finally(() => {
      emCurso = false;
    });
    if (pathname.startsWith('/app')) {
      void roteador.navigate(`/entrar?volta=${encodeURIComponent(`${pathname}${search}`)}`, { replace: true });
    }
  });
  return () => definirAoPerderSessao(undefined);
}
