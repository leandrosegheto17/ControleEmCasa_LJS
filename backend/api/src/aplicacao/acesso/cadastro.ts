import { senhaAtendePolitica, type EntradaCadastro } from '@controle/contrato';
import { ErroApi } from '../../erros';
import { registrarAceite } from '../../infraestrutura/db/repositorios/aceites';
import { consumirToken, emitirToken, ultimoEmitidoEm } from '../../infraestrutura/db/repositorios/tokens-email';
import { buscarPorEmail, confirmarEmail, inserirSeNovo } from '../../infraestrutura/db/repositorios/usuarios';
import { gerarToken, hashToken, tokenTemFormato } from '../../infraestrutura/seguranca/token';
import { agendarEmail, INTERVALO_REENVIO_MS, linkComToken, type DepsAcesso } from './comum';

export const erroSenhaFraca = () => new ErroApi(400, 'senha_fraca', 'A senha precisa ter de 12 caracteres a 72 bytes.');
const erroLinkExpirado = () => new ErroApi(400, 'link_expirado', 'O link expirou ou já foi usado. Peça um novo.');

/**
 * Cadastro aberto (RN-19; SDD 8.1). A resposta é sempre a mesma, para e-mail novo ou já cadastrado (CA-19.3):
 * o bcrypt roda nos dois casos e o e-mail sai depois da resposta. Quem já tem conta recebe um aviso por e-mail.
 */
export async function cadastrar(deps: DepsAcesso, dados: EntradaCadastro): Promise<void> {
  if (dados.aceite.termos !== deps.versoes.termos || dados.aceite.privacidade !== deps.versoes.privacidade) {
    throw new ErroApi(400, 'valor_invalido', 'É preciso aceitar os Termos de Uso e a Política de Privacidade.');
  }
  if (!senhaAtendePolitica(dados.senha)) throw erroSenhaFraca();

  const token = gerarToken();
  const tokenHash = await hashToken(token);
  const criado = await deps.db.transaction().execute(async (trx) => {
    const id = await inserirSeNovo(trx, {
      nome: dados.nome,
      email: dados.email,
      senha: dados.senha,
      agora: deps.agora,
    });
    if (!id) return false;
    await registrarAceite(trx, { usuarioId: id, versoes: deps.versoes, agora: deps.agora });
    await emitirToken(trx, { usuarioId: id, finalidade: 'confirmacao', tokenHash, agora: deps.agora });
    return true;
  });

  if (criado) {
    agendarEmail(deps, dados.email, 'confirmacao', {
      nome: dados.nome,
      link: linkComToken(deps.urlPublica, '/confirmar', token),
    });
  } else {
    agendarEmail(deps, dados.email, 'conta_existente', {
      linkEntrar: `${deps.urlPublica}/entrar`,
      linkRecuperar: `${deps.urlPublica}/redefinir-senha`,
    });
  }
}

/** Confirmação por link (CA-19.2, G-18): consumo atômico por POST; desconhecido, usado ou vencido → `link_expirado`. */
export async function confirmarCadastro(deps: DepsAcesso, token: string): Promise<void> {
  if (!tokenTemFormato(token)) throw erroLinkExpirado();
  const tokenHash = await hashToken(token);
  const ok = await deps.db.transaction().execute(async (trx) => {
    const usuarioId = await consumirToken(trx, { tokenHash, finalidade: 'confirmacao', agora: deps.agora });
    if (!usuarioId) return false;
    await confirmarEmail(trx, usuarioId, deps.agora);
    return true;
  });
  if (!ok) throw erroLinkExpirado();
}

/**
 * Reenvio do link de confirmação (RN-19). Resposta neutra sempre (CA-21.5). Só há envio para conta existente e
 * não confirmada, no máximo um a cada 2 min (TM-API-16); o link novo invalida o anterior.
 */
export async function reenviarConfirmacao(deps: DepsAcesso, email: string): Promise<void> {
  const usuario = await buscarPorEmail(deps.db, email);
  if (!usuario || usuario.emailConfirmado) return;
  const ultimo = await ultimoEmitidoEm(deps.db, usuario.id, 'confirmacao');
  if (ultimo && deps.agora.getTime() - ultimo.getTime() < INTERVALO_REENVIO_MS) return;

  const token = gerarToken();
  const tokenHash = await hashToken(token);
  await deps.db
    .transaction()
    .execute((trx) =>
      emitirToken(trx, { usuarioId: usuario.id, finalidade: 'confirmacao', tokenHash, agora: deps.agora }),
    );
  agendarEmail(deps, usuario.email, 'confirmacao', {
    nome: usuario.nome,
    link: linkComToken(deps.urlPublica, '/confirmar', token),
  });
}
