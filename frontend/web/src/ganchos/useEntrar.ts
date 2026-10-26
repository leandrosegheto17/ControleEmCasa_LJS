import { entrar } from '../dados/sessao';
import { useComandoCadastro } from './useComandoCadastro';
import { CHAVE_SESSAO } from './useSessao';

export interface CredenciaisEntrada {
  email: string;
  senha: string;
}

/** Entrada com e-mail e senha; sem rede devolve o erro `rede` em vez de pausar a mutação. Em sucesso, relê a sessão. */
export function useEntrar() {
  return useComandoCadastro(({ email, senha }: CredenciaisEntrada) => entrar(email, senha), [CHAVE_SESSAO], true);
}
