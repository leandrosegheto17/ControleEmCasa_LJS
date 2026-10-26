import type { ErroDados } from '../comum/erros';
import { PRAZO_PURGA_DIAS } from '../comum/conta';
import { ROTULO_ERRO } from './erros';
import { mensagemErro } from './mensagensErro';
import { TEXTO_SEM_CONEXAO } from './textosConexao';

/** Textos da exclusão de conta (RN-26; CA-26.1 a CA-26.9). */

export const TEXTO_SEM_REDE_EXCLUSAO =
  'Sem conexão. Pedir a exclusão exige internet e não fica guardado no aparelho. Tente de novo quando a rede voltar.';

/** O que acontece, em linhas curtas, para a pessoa decidir antes de pedir. */
export const PASSOS_DA_EXCLUSAO = [
  'Você recebe um link por e-mail, válido por 30 minutos. Enquanto não abrir o link, nada é excluído.',
  `Ao confirmar, a conta fica bloqueada por ${PRAZO_PURGA_DIAS} dias: você não consegue entrar e a exclusão não pode ser desfeita.`,
  `Passados os ${PRAZO_PURGA_DIAS} dias, tudo é apagado: seus dados, lançamentos, metas e a assinatura, que é cancelada na confirmação.`,
] as const;

export const AVISO_TITULAR =
  'Se há outra pessoa na casa, o lar dela também será encerrado: o lar, os lançamentos da casa e os individuais dela serão apagados na mesma data. Ela é avisada por e-mail e no app.';
export const AVISO_CONVIDADO =
  'Como você usa o lar de outra pessoa, os seus lançamentos individuais serão apagados em 30 dias. O que você pagou em conjunto continua no lar, como "Ex-membro".';

/** Texto do erro de pedir a exclusão; nunca mostra código nem mensagem do servidor. */
export function textoErroExclusao(erro: ErroDados): string {
  if (erro.tipo === 'rede') return TEXTO_SEM_REDE_EXCLUSAO;
  if (erro.tipo === 'indisponivel') return ROTULO_ERRO.indisponivel.texto;
  if (erro.tipo === 'autenticacao') return ROTULO_ERRO.sessao_expirada.texto;
  if (erro.tipo === 'regra') {
    if (erro.codigo === 'credenciais_invalidas') return 'Senha incorreta.';
    if (erro.codigo === 'muitas_tentativas' || erro.codigo === 'muitas_requisicoes')
      return ROTULO_ERRO[erro.codigo].texto;
  }
  return mensagemErro(erro);
}

/** Texto do erro de confirmar o link (tela pública). */
export function textoErroConfirmacao(erro: ErroDados): string {
  if (erro.tipo === 'regra' && erro.codigo === 'link_expirado') {
    return 'Este link expirou ou já foi usado. Peça um novo link dentro do app, em Ajustes, Conta.';
  }
  if (erro.tipo === 'rede') return `${TEXTO_SEM_CONEXAO} Tente de novo quando a rede voltar.`;
  if (erro.tipo === 'indisponivel') return ROTULO_ERRO.indisponivel.texto;
  return 'Não foi possível confirmar a exclusão. Tente de novo.';
}
