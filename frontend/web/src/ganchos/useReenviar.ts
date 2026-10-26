import { reenviar } from '../dados/sessao';
import { useComandoCadastro } from './useComandoCadastro';

/** Reenvio do e-mail de confirmação; resposta neutra (202). */
export function useReenviar() {
  return useComandoCadastro((email: string) => reenviar(email), [], true);
}
