import type { ErroDados } from '../comum/erros';
import { ROTULO_ERRO } from '../rotulos/erros';
import { TEXTO_SEM_CONEXAO, TEXTO_SERVIDOR_INDISPONIVEL } from '../rotulos/textosConexao';

/** Códigos que a tela de entrada mostra com o texto próprio; os outros caem no texto genérico. */
const CODIGOS_DA_ENTRADA = [
  'credenciais_invalidas',
  'email_nao_confirmado',
  'conta_em_exclusao',
  'muitas_tentativas',
  'muitas_requisicoes',
  'origem_invalida',
] as const;

/** Texto do alerta de entrada; credenciais erradas não dizem se o e-mail existe (G-19). */
export function textoErroEntrar(erro: ErroDados): string {
  if (erro.tipo === 'regra' && (CODIGOS_DA_ENTRADA as readonly string[]).includes(erro.codigo)) {
    return ROTULO_ERRO[erro.codigo].texto;
  }
  if (erro.tipo === 'rede') return TEXTO_SEM_CONEXAO;
  if (erro.tipo === 'indisponivel') return TEXTO_SERVIDOR_INDISPONIVEL;
  return 'Não foi possível entrar. Tente de novo.';
}
