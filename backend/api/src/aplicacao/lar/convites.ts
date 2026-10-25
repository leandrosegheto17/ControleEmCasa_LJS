import type { SaidaConviteAtual, SaidaConviteCriado } from '@controle/contrato';
import { avaliarConvite, CATEGORIAS_INICIAIS_INDIVIDUAIS, decidirAceite, NOME_EX_MEMBRO } from '@controle/dominio';
import { ErroApi } from '../../erros';
import { apagarDoLarAtual, inserirCategorias, listarDoLarAtual } from '../../infraestrutura/db/repositorios/categorias';
import {
  buscarPorTokenDoEmailDaSessao,
  cancelarPendentesDoLar,
  contarCriadosDesde,
  inserirConvite,
  recusarPorToken,
  responderConvite,
  revogarDoLar,
  ultimoParaEmail,
} from '../../infraestrutura/db/repositorios/convites';
import { buscarLarAtual, travarVinculoDoUsuario } from '../../infraestrutura/db/repositorios/lares';
import {
  buscarMembroAtual,
  contarOutrosNoLar,
  inserirMembro,
  listarAtivosDoLar,
  marcarSaida,
} from '../../infraestrutura/db/repositorios/membros';
import { buscarPorId } from '../../infraestrutura/db/repositorios/usuarios';
import { derivarVinculo } from '../../infraestrutura/db/transacao';
import { gerarToken, hashToken, tokenTemFormato } from '../../infraestrutura/seguranca/token';
import { agendarEmail, linkComToken } from '../acesso/comum';
import {
  erroConviteInvalido,
  erroDoDominio,
  erroRegistroInvalido,
  vinculoDe,
  type DepsConvite,
  type DepsLar,
} from './comum';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * `POST /api/lar/convites` (RN-23; SDD 8.4; G-14). Só o titular (senão `registro_invalido`, CA-23.2).
 * A resposta não depende de o e-mail ter conta ou outro lar (anti-enumeração; THREAT-MODEL D-6): nada do
 * usuário convidado é consultado. Convite novo revoga o pendente anterior. O e-mail sai fora do caminho da
 * resposta; o token só existe no link (fragmento `#t=`), nunca em log ou JSON.
 */
export async function convidar(deps: DepsConvite, email: string): Promise<SaidaConviteCriado> {
  const vinculo = vinculoDe(deps);
  if (vinculo.papel !== 'titular') throw erroRegistroInvalido();
  const { tx, agora } = deps;

  const membros = await listarAtivosDoLar(tx);
  const decisao = avaliarConvite({
    emailConvidado: email,
    emailTitular: deps.sessao.email,
    membrosAtivos: membros.length,
    convitesNasUltimas24h: await contarCriadosDesde(tx, new Date(agora.getTime() - DIA_MS)),
    ultimoConviteMesmoEmailEm: await ultimoParaEmail(tx, email),
    agora,
  });
  if (!decisao.ok) throw erroDoDominio(decisao.erro);

  const lar = await buscarLarAtual(tx);
  const titular = await buscarMembroAtual(tx);
  if (!lar || !titular) throw new Error('vinculo_sem_lar');

  await cancelarPendentesDoLar(tx, agora);
  const token = gerarToken();
  // Dois convites simultâneos do mesmo lar: o índice `convite_um_pendente` recusa o segundo (convite_pendente).
  const convite = await inserirConvite(tx, {
    larId: vinculo.larId,
    convidadoPor: vinculo.membroId,
    email,
    tokenHash: await hashToken(token),
    larNome: lar.nome,
    convidadoPorNome: titular.nome,
    agora,
  });
  agendarEmail(deps, email, 'convite', {
    nomeTitular: titular.nome,
    link: linkComToken(deps.urlPublica, '/convite', token),
  });
  return { id: convite.id, email: convite.email, expira_em: convite.expiraEm.toISOString() };
}

/** `DELETE /api/lar/convites/:id` (titular; RN-23 "o titular revoga"). Já encerrado: 204 sem efeito. */
export async function revogarConvite(deps: DepsLar, conviteId: string): Promise<void> {
  const vinculo = vinculoDe(deps);
  if (vinculo.papel !== 'titular') throw erroRegistroInvalido();
  if (!(await revogarDoLar(deps.tx, { id: conviteId, agora: deps.agora }))) throw erroRegistroInvalido();
}

async function hashDoTokenValido(token: string): Promise<Uint8Array> {
  if (!tokenTemFormato(token)) throw erroConviteInvalido();
  return hashToken(token);
}

/**
 * `GET /api/convites/atual?token=` (A0): o que a tela de aceite mostra. Só para o e-mail da sessão, pendente e
 * dentro da validade; qualquer outro caso é `convite_invalido`, sem revelar o e-mail convidado (CA-23.5).
 */
export async function conviteAtual(deps: DepsLar, token: string): Promise<SaidaConviteAtual> {
  const convite = await buscarPorTokenDoEmailDaSessao(deps.tx, {
    tokenHash: await hashDoTokenValido(token),
    agora: deps.agora,
    travar: false,
  });
  if (!convite) throw erroConviteInvalido();
  return {
    lar_nome: convite.larNome,
    convidado_por_nome: convite.convidadoPorNome,
    expira_em: convite.expiraEm.toISOString(),
  };
}

/**
 * `POST /api/convites/aceitar` (RN-23; SDD 8.4; CA-23.3 a CA-23.6, CA-23.9 a CA-23.11, CA-23.15).
 * 1. trava o vínculo do usuário e a linha do convite (uso único sob concorrência);
 * 2. quem já tem lar: membro de outro lar ou titular com dados/membro → `ja_tem_lar`; titular sozinho só com
 *    as categorias iniciais → o lar é descartado (categorias apagadas, convite pendente revogado, vínculo encerrado);
 * 3. entra como membro (o índice único garante o limite de 2: `lar_cheio`), encerra o convite, refaz o GUC
 *    com o lar novo e cria as 7 categorias individuais iniciais.
 * Qualquer recusa desfaz tudo (a transação da requisição volta inteira).
 */
export async function aceitarConvite(deps: DepsLar, token: string): Promise<void> {
  const { tx, sessao, agora } = deps;
  const tokenHash = await hashDoTokenValido(token);
  await travarVinculoDoUsuario(tx, sessao.usuarioId);
  const convite = await buscarPorTokenDoEmailDaSessao(tx, { tokenHash, agora, travar: true });
  if (!convite) throw erroConviteInvalido();

  const atual = await derivarVinculo(tx, sessao.usuarioId);
  if (atual) {
    const decisao = decidirAceite({
      papel: atual.papel,
      outrosMembrosNoLar: await contarOutrosNoLar(tx, atual.membroId),
      categorias: await listarDoLarAtual(tx),
    });
    if (!decisao.ok) throw erroDoDominio(decisao.erro);
    // Descarte do lar que só tem as categorias iniciais (CA-23.9): nada dele vai para o lar novo (CA-23.15).
    await apagarDoLarAtual(tx);
    await cancelarPendentesDoLar(tx, agora);
    const saiu = await marcarSaida(tx, { membroId: atual.membroId, papel: 'titular', nome: NOME_EX_MEMBRO, agora });
    if (saiu !== 1) throw new Error('descarte_falhou');
  }

  const usuario = await buscarPorId(tx, sessao.usuarioId);
  if (!usuario) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  await inserirMembro(tx, {
    larId: convite.larId,
    usuarioId: sessao.usuarioId,
    nome: usuario.nome,
    papel: 'membro',
    agora,
  });
  await responderConvite(tx, { id: convite.id, situacao: 'aceito', agora });
  const vinculo = await derivarVinculo(tx, sessao.usuarioId);
  if (!vinculo || vinculo.larId !== convite.larId) throw new Error('vinculo_nao_derivado');
  await inserirCategorias(tx, {
    larId: vinculo.larId,
    donoId: vinculo.membroId,
    categorias: CATEGORIAS_INICIAIS_INDIVIDUAIS,
  });
}

/** `POST /api/convites/recusar` (RN-23 "uso único"): encerra o convite; inválido, usado ou de outro e-mail → `convite_invalido`. */
export async function recusarConvite(deps: DepsLar, token: string): Promise<void> {
  const tokenHash = await hashDoTokenValido(token);
  if (!(await recusarPorToken(deps.tx, { tokenHash, agora: deps.agora }))) throw erroConviteInvalido();
}
