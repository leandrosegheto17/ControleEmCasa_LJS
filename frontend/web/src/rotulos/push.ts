import type { ErroDados } from '../comum/erros';
import { ROTULO_ERRO } from './erros';
import { mensagemErro } from './mensagensErro';

/** Textos da tela de notificações (RN-27; SDD 9.3). O texto nunca traz código nem mensagem do servidor. */

export const TEXTO_SEM_SUPORTE =
  'Este navegador não permite avisos no aparelho. Tente de outro navegador ou instale o app na tela inicial.';
export const TEXTO_NEGADA =
  'Os avisos estão bloqueados para este site no navegador. Para ativar, libere as notificações nas configurações do navegador (permissões do site) e volte aqui.';
export const TEXTO_INATIVA = 'Os avisos ainda não estão ativos neste aparelho. O navegador vai pedir a sua permissão.';
export const TEXTO_ATIVA = 'Os avisos estão ativos neste aparelho.';
export const TEXTO_SEM_REDE_PUSH =
  'Sem conexão. Ativar e desativar avisos exige internet. Tente de novo quando a rede voltar.';
export const TEXTO_INDISPONIVEL_PUSH = 'Avisos indisponíveis agora. Tente de novo mais tarde.';
export const TEXTO_PERMISSAO_IGNORADA =
  'A permissão não foi dada. Toque em "Ativar neste aparelho" para tentar de novo.';
export const TEXTO_PREFERENCIAS_SEM_REDE = 'Sem conexão para ler as preferências. Tente de novo quando a rede voltar.';

export const TITULO_IOS = 'Instale o app para receber avisos';
export const TEXTO_IOS =
  'No iPhone e no iPad, os avisos só funcionam com o app instalado na Tela de Início, com iOS 16.4 ou mais novo.';
export const PASSOS_IOS_PUSH = [
  'Abra este site no Safari.',
  'Toque em Compartilhar (o quadrado com a seta para cima).',
  'Escolha "Adicionar à Tela de Início" e confirme.',
  'Abra o app pelo ícone da Tela de Início e volte a Ajustes, Notificações.',
] as const;

export const TIPOS_DE_AVISO = {
  fixas: { rotulo: 'Despesas fixas', ajuda: 'Um dia antes do vencimento e quando uma conta atrasa.' },
  lembrete_diario: { rotulo: 'Lembrete diário', ajuda: 'Se você ainda não lançou nada no dia.' },
  metas: { rotulo: 'Metas', ajuda: 'Quando uma meta chega ao valor planejado.' },
} as const;

/** Texto do erro do navegador (permissão, inscrição). */
export function textoErroNavegador(motivo: 'sem_suporte' | 'sem_service_worker' | 'assinar_falhou'): string {
  if (motivo === 'sem_suporte') return TEXTO_SEM_SUPORTE;
  if (motivo === 'sem_service_worker')
    return 'O app ainda não está pronto para avisos. Recarregue a página e tente de novo.';
  return 'O navegador não conseguiu ativar os avisos neste aparelho. Tente de novo.';
}

/** Texto do erro de ativar, desativar ou salvar preferências. */
export function textoErroPush(erro: ErroDados): string {
  if (erro.tipo === 'rede') return TEXTO_SEM_REDE_PUSH;
  if (erro.tipo === 'indisponivel') return TEXTO_INDISPONIVEL_PUSH;
  if (erro.tipo === 'regra') {
    if (erro.codigo === 'sem_lar') return ROTULO_ERRO.sem_lar.texto;
    if (erro.codigo === 'valor_invalido') return 'Este aparelho não é aceito para avisos.';
  }
  return mensagemErro(erro);
}
