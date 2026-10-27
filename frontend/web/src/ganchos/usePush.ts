import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ErroDados } from '../comum/erros';
import type { Preferencias } from '../comum/push';
import {
  ativarNesteAparelho,
  buscarPreferencias,
  desativarNesteAparelho,
  lerEstadoPush,
  salvarPreferencias,
  type EstadoPush,
  type ResultadoAtivar,
} from '../dados/push';
import { CHAVES } from './chavesConsulta';

/** Situação do navegador (permissão e inscrição). Relê ao voltar à aba: a permissão muda nas configurações do navegador. */
export function useEstadoPush() {
  return useQuery<EstadoPush>({
    queryKey: CHAVES.pushEstado,
    queryFn: lerEstadoPush,
    networkMode: 'always',
    refetchOnWindowFocus: true,
  });
}

/** Ativar e desativar mexem no navegador e na API: rodam sem pausa offline para a tela mostrar "sem conexão". */
export function useAtivarPush() {
  const cliente = useQueryClient();
  return useMutation<ResultadoAtivar, unknown>({
    mutationFn: ativarNesteAparelho,
    networkMode: 'always',
    onSettled: () => cliente.invalidateQueries({ queryKey: CHAVES.pushEstado }),
  });
}

export function useDesativarPush() {
  const cliente = useQueryClient();
  return useMutation<void, unknown>({
    mutationFn: desativarNesteAparelho,
    networkMode: 'always',
    onSettled: () => cliente.invalidateQueries({ queryKey: CHAVES.pushEstado }),
  });
}

export const usePreferencias = () =>
  useQuery<Preferencias, ErroDados>({
    queryKey: CHAVES.preferenciasPush,
    queryFn: buscarPreferencias,
    networkMode: 'always',
  });

/** Salva o objeto completo (o `PUT` não aceita parcial). Em sucesso, a cópia em cache passa a ser a enviada. */
export function useSalvarPreferencias() {
  const cliente = useQueryClient();
  return useMutation<void, ErroDados, Preferencias>({
    mutationFn: salvarPreferencias,
    networkMode: 'always',
    onSuccess: (_resultado, preferencias) => cliente.setQueryData(CHAVES.preferenciasPush, preferencias),
  });
}
