import { QueryClient } from '@tanstack/react-query';
import type { ErroDados } from './comum/erros';

/** Erro de regra (inexistente ou alheio) não muda ao repetir: a tela mostra o estado na hora. */
const repetirSoErroDeRede = (tentativas: number, erro: Error | ErroDados) =>
  !('tipo' in erro && erro.tipo === 'regra') && tentativas < 3;

export const clienteConsulta = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, retry: repetirSoErroDeRede } },
});
