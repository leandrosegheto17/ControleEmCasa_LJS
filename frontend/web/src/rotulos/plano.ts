import type { ErroDados } from '../comum/erros';
import { ROTULO_ERRO } from './erros';
import { mensagemErro } from './mensagensErro';

/** Textos da tela Meu plano (RN-24; CA-24.1 a CA-24.11). */

export const ROTULO_PLANO = { free: 'Free', pro: 'Pro' } as const;

export const TEXTO_SO_TITULAR =
  'O plano é da casa e quem assina e cancela é o titular. Você usa o plano da casa, sem nada a pagar.';
export const TEXTO_SEM_REDE_PLANO =
  'Sem conexão. Assinar e cancelar exigem internet e não ficam guardados no aparelho. Tente de novo quando a rede voltar.';

/** Texto do erro de assinar ou cancelar; nunca mostra código nem mensagem do servidor. */
export function textoErroPlano(erro: ErroDados): string {
  if (erro.tipo === 'rede') return TEXTO_SEM_REDE_PLANO;
  if (erro.tipo === 'indisponivel') return 'O serviço de pagamento está indisponível. Tente de novo em instantes.';
  if (erro.tipo === 'regra') {
    if (erro.codigo === 'assinatura_ativa' || erro.codigo === 'sem_assinatura') return ROTULO_ERRO[erro.codigo].texto;
    if (erro.codigo === 'registro_invalido') return 'Só o titular da casa pode assinar ou cancelar.';
  }
  return mensagemErro(erro);
}
