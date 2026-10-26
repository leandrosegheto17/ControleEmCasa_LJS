import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ErroDados } from '../comum/erros';
import { confirmarExclusao, pedirExclusao } from '../dados/conta';
import { esvaziarCache } from './esvaziarCache';

/** Pede o link de exclusão. Roda mesmo sem rede (a tela mostra "sem conexão"); a senha fica só nas variáveis, em memória. */
export function usePedirExclusao() {
  return useMutation<void, ErroDados, string>({
    mutationFn: (senha) => pedirExclusao(senha),
    networkMode: 'always',
  });
}

/** Confirma com o token do link; em sucesso a sessão acabou e o cache em memória é esvaziado (G-39). */
export function useConfirmarExclusao() {
  const cliente = useQueryClient();
  return useMutation<void, ErroDados, string>({
    mutationFn: (token) => confirmarExclusao(token),
    networkMode: 'always',
    onSuccess: () => esvaziarCache(cliente, { sessaoAcabou: true }),
  });
}
