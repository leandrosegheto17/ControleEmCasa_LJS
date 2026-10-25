import { senhaAtendePolitica } from '@controle/contrato';
import { ErroApi } from '../../erros';
import { apagarDoUsuario } from '../../infraestrutura/db/repositorios/sessoes';
import { consumirToken, emitirToken, ultimoEmitidoEm } from '../../infraestrutura/db/repositorios/tokens-email';
import { buscarPorEmail, trocarSenha } from '../../infraestrutura/db/repositorios/usuarios';
import { gerarToken, hashToken, tokenTemFormato } from '../../infraestrutura/seguranca/token';
import { erroSenhaFraca } from './cadastro';
import { agendarEmail, INTERVALO_REENVIO_MS, linkComToken, type DepsAcesso } from './comum';

/**
 * "Esqueci a senha" (CA-19.6): resposta igual para e-mail existente ou não. Para quem existe, emite um token de
 * recuperação (mesmas regras do de confirmação: 256 bits, hash, 30 min, uso único), no máximo um a cada 2 min.
 */
export async function pedirRecuperacao(deps: DepsAcesso, email: string): Promise<void> {
  const usuario = await buscarPorEmail(deps.db, email);
  if (!usuario) return;
  const ultimo = await ultimoEmitidoEm(deps.db, usuario.id, 'recuperacao');
  if (ultimo && deps.agora.getTime() - ultimo.getTime() < INTERVALO_REENVIO_MS) return;

  const token = gerarToken();
  const tokenHash = await hashToken(token);
  await deps.db
    .transaction()
    .execute((trx) =>
      emitirToken(trx, { usuarioId: usuario.id, finalidade: 'recuperacao', tokenHash, agora: deps.agora }),
    );
  agendarEmail(deps, usuario.email, 'recuperacao', {
    nome: usuario.nome,
    link: linkComToken(deps.urlPublica, '/redefinir-senha', token),
  });
}

/**
 * Redefinição (CA-19.6, G-16): a política de senha vem antes do consumo (senha fraca não queima o link);
 * trocar a senha revoga todas as sessões do usuário, na mesma transação.
 */
export async function redefinirSenha(deps: DepsAcesso, dados: { token: string; senha: string }): Promise<void> {
  if (!senhaAtendePolitica(dados.senha)) throw erroSenhaFraca();
  const erroLink = () => new ErroApi(400, 'link_expirado', 'O link expirou ou já foi usado. Peça um novo.');
  if (!tokenTemFormato(dados.token)) throw erroLink();
  const tokenHash = await hashToken(dados.token);
  const ok = await deps.db.transaction().execute(async (trx) => {
    const usuarioId = await consumirToken(trx, { tokenHash, finalidade: 'recuperacao', agora: deps.agora });
    if (!usuarioId) return false;
    await trocarSenha(trx, usuarioId, dados.senha, deps.agora);
    await apagarDoUsuario(trx, usuarioId);
    return true;
  });
  if (!ok) throw erroLink();
}
