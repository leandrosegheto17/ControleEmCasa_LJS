import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../comum/versoes';
import { cadastrar } from '../dados/sessao';
import { useComandoCadastro } from './useComandoCadastro';

export interface DadosDeCadastro {
  nome: string;
  email: string;
  senha: string;
}

/** Cadastro aberto: a resposta é neutra (202), igual para e-mail novo ou já existente (CA-19.3). */
export function useCadastrar() {
  return useComandoCadastro(
    (d: DadosDeCadastro) => cadastrar({ ...d, aceite: { termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE } }),
    [],
    true,
  );
}
