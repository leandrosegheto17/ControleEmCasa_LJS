import { useQuery } from '@tanstack/react-query';
import { assinarPlano, buscarPlano, cancelarPlano } from '../dados/plano';
import type { ErroDados } from '../dados/erros';
import { CHAVES } from './chavesConsulta';
import { useComandoCadastro } from './useComandoCadastro';
import { useSessao, CHAVE_SESSAO } from './useSessao';

/** O plano do lar. Relê ao voltar à aba (o Pix pode ter sido pago em outro app). */
export const useMeuPlano = () =>
  useQuery<Awaited<ReturnType<typeof buscarPlano>>, ErroDados>({
    queryKey: CHAVES.plano,
    queryFn: buscarPlano,
    refetchOnWindowFocus: true,
  });

/**
 * Sem pausa offline: a tela mostra "sem conexão". Em sucesso relê o plano e a sessão (que leva o plano efetivo).
 * O CPF/CNPJ fica só nas variáveis da mutação, em memória.
 */
export const useAssinar = () =>
  useComandoCadastro((cpfCnpj: string) => assinarPlano(cpfCnpj), [CHAVES.plano, CHAVE_SESSAO], true);
export const useCancelarAssinatura = () =>
  useComandoCadastro(() => cancelarPlano(), [CHAVES.plano, CHAVE_SESSAO], true);

/**
 * `true` quando o lar está no plano Free: orçamento e metas ficam só para consulta (RN-25). Vem da sessão já carregada
 * (`plano` em `GET /api/sessao`); sem a informação (sessão presumida, offline, ou lar sem plano) vale "pode editar", e
 * o servidor continua barrando com 403 `plano_necessario`.
 */
export function useSomenteLeitura(): boolean {
  const estado = useSessao();
  return estado.situacao === 'ativa' && estado.sessao.plano === 'free';
}
