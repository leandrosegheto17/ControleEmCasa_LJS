import type { SaidaSessaoAtual } from '@controle/contrato';
import type { Kysely } from 'kysely';
import { ErroApi } from '../../erros';
import { aceitouVersoes, registrarAceite, type Versoes } from '../../infraestrutura/db/repositorios/aceites';
import { apagarDoUsuario, apagarPorToken } from '../../infraestrutura/db/repositorios/sessoes';
import { buscarPorId } from '../../infraestrutura/db/repositorios/usuarios';
import type { DB } from '../../infraestrutura/db/tipos';
import { hashToken } from '../../infraestrutura/seguranca/token';

/**
 * `GET /api/sessao` (SDD 5.2). `membro`, `lar` e `plano` ficam nulos até as etapas 6 e 13.
 * `termos_pendentes` é verdadeiro quando a versão vigente dos termos ou da privacidade ainda não foi aceita
 * (CA-19.7); o front leva ao reaceite antes de liberar o app.
 */
export async function sessaoAtual(db: Kysely<DB>, usuarioId: string, versoes: Versoes): Promise<SaidaSessaoAtual> {
  const usuario = await buscarPorId(db, usuarioId);
  if (!usuario) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  return {
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    membro: null,
    lar: null,
    plano: null,
    termos_pendentes: !(await aceitouVersoes(db, usuarioId, versoes)),
  };
}

/** Sair (CA-20.4): revoga a sessão deste aparelho no servidor; idempotente. */
export async function sair(db: Kysely<DB>, token: string | null): Promise<void> {
  if (token) await apagarPorToken(db, await hashToken(token));
}

/** Sair de todos (CA-20.5): todas as sessões do usuário, inclusive a atual. Repetir é sucesso sem efeito. */
export async function sairDeTodos(db: Kysely<DB>, usuarioId: string): Promise<void> {
  await apagarDoUsuario(db, usuarioId);
}

/** Reaceite (CA-19.7, G-48): só as versões vigentes são aceitas; registrar de novo não duplica. */
export async function aceitarTermos(
  db: Kysely<DB>,
  dados: { usuarioId: string; aceite: Versoes; vigentes: Versoes; agora: Date },
): Promise<void> {
  if (dados.aceite.termos !== dados.vigentes.termos || dados.aceite.privacidade !== dados.vigentes.privacidade) {
    throw new ErroApi(400, 'valor_invalido', 'Aceite a versão vigente dos Termos e da Política de Privacidade.');
  }
  await registrarAceite(db, { usuarioId: dados.usuarioId, versoes: dados.vigentes, agora: dados.agora });
}
