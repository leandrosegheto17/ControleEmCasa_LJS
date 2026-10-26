import { useQueryClient } from '@tanstack/react-query';
import { redefinir } from '../dados/sessao';
import { useComandoCadastro } from './useComandoCadastro';
import { esvaziarCache } from './esvaziarCache';

export interface PedidoRedefinicao {
  token: string;
  senha: string;
}

/**
 * Troca a senha com o token do link. O servidor revoga todas as sessões; aqui o cache é limpo e a sessão marcada
 * como ausente, para a guarda não mandar a pessoa para o app com dados velhos. Sem rede devolve o erro `rede`.
 */
export function useRedefinirSenha() {
  const cliente = useQueryClient();
  return useComandoCadastro(
    async ({ token, senha }: PedidoRedefinicao) => {
      await redefinir(token, senha);
      esvaziarCache(cliente, { sessaoAcabou: true });
    },
    [],
    true,
  );
}
