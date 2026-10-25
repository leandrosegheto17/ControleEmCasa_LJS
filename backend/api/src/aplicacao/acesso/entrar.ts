import type { EntradaEntrar } from '@controle/contrato';
import { ErroApi } from '../../erros';
import { apagarPorToken, criarSessao } from '../../infraestrutura/db/repositorios/sessoes';
import { descartarFalha, registrarSucesso, reservarFalha } from '../../infraestrutura/db/repositorios/tentativas';
import { verificarCredenciais } from '../../infraestrutura/db/repositorios/usuarios';
import { hashEmail, hashIp } from '../../infraestrutura/seguranca/hmac';
import { gerarToken, hashToken } from '../../infraestrutura/seguranca/token';
import type { DepsAcesso } from './comum';

/**
 * Entrar (RN-20, RN-21; SDD 8.2).
 * 1. Bloqueio: 5 falhas em 15 min pelo e-mail OU pelo IP → `muitas_tentativas`, sem conferir a senha.
 *    A falha é reservada antes do bcrypt, o que impede tentativas paralelas de furar o limite.
 * 2. Senha errada e e-mail inexistente: a mesma resposta, com o mesmo bcrypt (HASH_FIXO; G-19).
 * 3. Senha certa em conta não confirmada: `email_nao_confirmado` (só com a senha certa; CA-19.5).
 * 4. Sucesso: sessão NOVA (rotação), e a sessão do cookie anterior deste navegador é apagada (CA-20.1).
 *
 * `conta_em_exclusao` (RN-26) entra com a tabela `exclusao_conta`, na etapa 14.
 */
export async function entrar(
  deps: DepsAcesso,
  dados: EntradaEntrar & { ip: string | null; tokenAnterior: string | null },
): Promise<string> {
  const emailHash = await hashEmail(deps.chaveHmac, dados.email);
  const ipHash = dados.ip ? await hashIp(deps.chaveHmac, dados.ip) : null;

  const reserva = await reservarFalha(deps.db, { emailHash, ipHash, agora: deps.agora });
  if (reserva.bloqueado) {
    throw new ErroApi(429, 'muitas_tentativas', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  }

  const credenciais = await verificarCredenciais(deps.db, dados.email, dados.senha);
  if (!credenciais.ok || !credenciais.usuario) {
    // A falha reservada fica: conta para o e-mail e para o IP.
    throw new ErroApi(400, 'credenciais_invalidas', 'E-mail ou senha incorretos.');
  }
  const usuario = credenciais.usuario;
  if (!usuario.emailConfirmado) {
    await descartarFalha(deps.db, reserva.id);
    throw new ErroApi(403, 'email_nao_confirmado', 'Confirme seu e-mail antes de entrar.');
  }

  const token = gerarToken();
  const tokenHash = await hashToken(token);
  const anteriorHash = dados.tokenAnterior ? await hashToken(dados.tokenAnterior) : null;
  await deps.db.transaction().execute(async (trx) => {
    await descartarFalha(trx, reserva.id);
    await registrarSucesso(trx, { emailHash, ipHash, agora: deps.agora });
    if (anteriorHash) await apagarPorToken(trx, anteriorHash);
    await criarSessao(trx, { usuarioId: usuario.id, tokenHash, agora: deps.agora });
  });
  return token;
}
