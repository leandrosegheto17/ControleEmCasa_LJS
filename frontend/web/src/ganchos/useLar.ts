import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../comum/versoes';
import {
  aceitarConvite,
  aceitarTermos,
  buscarLar,
  conviteAtual,
  convidarMembro,
  criarLar,
  recusarConvite,
  removerMembro,
  revogarConvite,
  sairDoLar,
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

/** Remove o outro membro (titular). Sem pausa offline; só o sucesso relê o lar (o `registro_invalido` a tela trata). */
export const useRemoverMembro = () => useComandoCadastro((id: string) => removerMembro(id), [CHAVES.lar], true);

/** `saiu`: a saída foi feita agora; `sem_vinculo`: a API diz que a pessoa já não é membro que possa sair. */
export type ResultadoSaida = 'saiu' | 'sem_vinculo';

async function sairOuJaFora(): Promise<ResultadoSaida> {
  try {
    await sairDoLar();
    return 'saiu';
  } catch (e) {
    const erro = e as ErroDados;
    // Spec, sair, critério 6: já fora (ou titular) não é erro para a tela; a sessão relida decide o destino.
    if (erro.tipo === 'regra' && (erro.codigo === 'registro_invalido' || erro.codigo === 'sem_lar'))
      return 'sem_vinculo';
    throw e;
  }
}

/**
 * Sai da casa (membro). Sem pausa offline: sem rede o erro chega à tela. Depois, relê a sessão (a guarda leva ao
 * primeiro acesso) e tira do cache as leituras da casa anterior, para nada dela aparecer na casa nova. A fila de
 * mutações não é tocada.
 */
export function useSairDoLar() {
  const cliente = useQueryClient();
  return useMutation<ResultadoSaida, ErroDados, void>({
    mutationFn: sairOuJaFora,
    networkMode: 'always',
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CHAVE_SESSAO });
      cliente.removeQueries({ predicate: (consulta) => consulta.queryKey[0] !== CHAVE_SESSAO[0] });
    },
  });
}
