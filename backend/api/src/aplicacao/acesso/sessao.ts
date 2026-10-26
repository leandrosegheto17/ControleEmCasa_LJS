import type { SaidaSessaoAtual } from '@controle/contrato';
import { planoEfetivo } from '@controle/dominio';
import type { Kysely } from 'kysely';
import type { Vinculo } from '../../env';
import { ErroApi } from '../../erros';
import { aceitouVersoes, registrarAceite, type Versoes } from '../../infraestrutura/db/repositorios/aceites';
import { buscarAssinaturaAtual } from '../../infraestrutura/db/repositorios/assinaturas';
import { encerramentoDoLarAtual } from '../../infraestrutura/db/repositorios/exclusoes';
import { buscarLarAtual } from '../../infraestrutura/db/repositorios/lares';
import { buscarMembroAtual } from '../../infraestrutura/db/repositorios/membros';
import { apagarDoUsuario, apagarPorToken } from '../../infraestrutura/db/repositorios/sessoes';
import { buscarPorId } from '../../infraestrutura/db/repositorios/usuarios';
import type { DB } from '../../infraestrutura/db/tipos';
import { hashToken } from '../../infraestrutura/seguranca/token';
import { estadoDe } from '../plano/comum';

/** Plano efetivo do lar atual, calculado agora (RN-24). Lar sem linha de assinatura (anterior à etapa 13): `free`. */
async function planoDoLar(db: Kysely<DB>, agora: Date): Promise<'free' | 'pro'> {
  const linha = await buscarAssinaturaAtual(db);
  return linha ? planoEfetivo(estadoDe(linha), agora) : 'free';
}

/**
 * `GET /api/sessao` (SDD 5.2). `membro` e `lar` vêm do vínculo derivado no banco ao abrir a transação
 * (SDD 5.3; G-03): nulos para quem ainda não tem lar. `plano` é o efetivo do lar (nulo sem lar; CA-24.2).
 * `termos_pendentes` é verdadeiro quando a versão vigente dos termos ou da privacidade ainda não foi aceita
 * (CA-19.7); o front leva ao reaceite antes de liberar o app.
 */
export async function sessaoAtual(
  db: Kysely<DB>,
  usuarioId: string,
  versoes: Versoes,
  vinculo: Vinculo | null,
  agora: Date,
): Promise<SaidaSessaoAtual> {
  const usuario = await buscarPorId(db, usuarioId);
  if (!usuario) throw new ErroApi(401, 'sessao_expirada', 'Sessão expirada. Entre novamente.');
  const membro = vinculo ? await buscarMembroAtual(db) : null;
  const lar = vinculo ? await buscarLarAtual(db) : null;
  const saida: SaidaSessaoAtual = {
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email },
    membro: membro ? { id: membro.id, nome: membro.nome, papel: membro.papel } : null,
    lar: membro && lar ? { id: lar.id, nome: lar.nome } : null,
    plano: membro && lar ? await planoDoLar(db, agora) : null,
    termos_pendentes: !(await aceitouVersoes(db, usuarioId, versoes)),
  };
  // Aviso no app ao membro (D1, CA-26.7): o titular confirmou a exclusão e o lar some inteiro na data da purga.
  if (membro?.papel === 'membro' && lar) {
    const purga = await encerramentoDoLarAtual(db);
    if (purga) saida.encerramento = { purga_em: purga.toISOString() };
  }
  return saida;
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
