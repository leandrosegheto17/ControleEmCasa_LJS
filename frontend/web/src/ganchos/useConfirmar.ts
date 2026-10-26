import { confirmar } from '../dados/sessao';
import { useComandoCadastro } from './useComandoCadastro';

export function useConfirmar() {
  return useComandoCadastro((token: string) => confirmar(token), [], true);
}
