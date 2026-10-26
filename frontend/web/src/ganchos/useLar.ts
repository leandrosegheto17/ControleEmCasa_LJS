import { useQuery } from '@tanstack/react-query';
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../comum/versoes';
import {
  aceitarConvite,
  aceitarTermos,
  buscarLar,
  conviteAtual,
  convidarMembro,
  criarLar,
  recusarConvite,
  revogarConvite,
} from '../dados/lar';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';
import { useComandoCadastro } from './useComandoCadastro';
import { CHAVE_SESSAO } from './useSessao';

/** Em sucesso, relê a sessão: a guarda leva a pessoa à tela certa. */
export const useCriarLar = () => useComandoCadastro((nome?: string) => criarLar(nome), [CHAVE_SESSAO], true);
export const useAceitarTermos = () =>
  useComandoCadastro(
    () => aceitarTermos({ termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE }),
    [CHAVE_SESSAO],
    true,
  );
export const useAceitarConvite = () =>
  useComandoCadastro((token: string) => aceitarConvite(token), [CHAVE_SESSAO], true);
export const useRecusarConvite = () =>
  useComandoCadastro((token: string) => recusarConvite(token), [CHAVE_SESSAO], true);

/** O convite que o link mostra. Erro de regra não se repete (a tela mostra o estado na hora). */
export function useConviteAtual(token: string | undefined, ativo: boolean) {
  return useQuery({
    queryKey: ['convite', 'atual'],
    queryFn: () => conviteAtual(token as string),
    enabled: ativo && token !== undefined,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** Membros do lar e o convite pendente (só o titular o recebe). */
export const useLar = () =>
  useQuery<Awaited<ReturnType<typeof buscarLar>>, ErroDados>({
    queryKey: CHAVES.lar,
    queryFn: buscarLar,
    refetchOnWindowFocus: true,
  });

/** Sem pausa offline: a tela mostra o erro de rede. Relê o lar em sucesso. */
export const useConvidarMembro = () => useComandoCadastro((email: string) => convidarMembro(email), [CHAVES.lar], true);
export const useRevogarConvite = () => useComandoCadastro((id: string) => revogarConvite(id), [CHAVES.lar], true);
