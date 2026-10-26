import { useQuery } from '@tanstack/react-query';
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../comum/versoes';
import { aceitarConvite, aceitarTermos, conviteAtual, criarLar, recusarConvite } from '../dados/lar';
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
