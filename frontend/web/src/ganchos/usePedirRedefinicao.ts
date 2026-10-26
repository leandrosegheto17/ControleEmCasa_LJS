import { esqueci } from '../dados/sessao';
import { useComandoCadastro } from './useComandoCadastro';

/** Pedido do link de redefinição; o resultado é o mesmo para e-mail com conta ou desconhecido (G-19). */
export function usePedirRedefinicao() {
  return useComandoCadastro((email: string) => esqueci(email), [], true);
}
