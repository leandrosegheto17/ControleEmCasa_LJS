import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Lar (SDD 3.4; RN-22). Toda leitura e escrita passa pela RLS e filtra explicitamente por `app.lar_atual()`
 * (CA-T1.4: as duas camadas). O lar nunca vem do cliente.
 */

/** Namespace da trava consultiva por usuário: criar lar e aceitar convite do mesmo usuário são serializados. */
const TRAVA_VINCULO = 4201;

/**
 * Trava o vínculo do usuário até o fim da transação (CA-22.3: dois primeiros acessos simultâneos criam um
 * único lar; dois aceites do mesmo usuário não se cruzam). Depois da trava, o vínculo é lido de novo.
 */
export async function travarVinculoDoUsuario(db: Kysely<DB>, usuarioId: string): Promise<void> {
  await sql`select pg_advisory_xact_lock(${TRAVA_VINCULO}, hashtext(${usuarioId}))`.execute(db);
}

export async function inserirLar(
  db: Kysely<DB>,
  dados: { nome: string; criadoPor: string; agora: Date },
): Promise<string> {
  const r = await sql<{ id: string }>`
    insert into app.lar (nome, criado_por, criado_em)
    values (${dados.nome}, ${dados.criadoPor}, ${dados.agora.toISOString()}::timestamptz)
    returning id`.execute(db);
  const id = r.rows[0]?.id;
  if (!id) throw new Error('lar_nao_criado');
  return id;
}

/** O lar do vínculo atual (nulo sem vínculo). */
export async function buscarLarAtual(db: Kysely<DB>): Promise<{ id: string; nome: string } | null> {
  const r = await sql<{ id: string; nome: string }>`
    select id, nome from app.lar where id = app.lar_atual()`.execute(db);
  return r.rows[0] ?? null;
}

/** Renomeia o lar atual; a política só deixa o titular (devolve as linhas afetadas). */
export async function renomearLarAtual(db: Kysely<DB>, nome: string): Promise<number> {
  const r = await sql`update app.lar set nome = ${nome} where id = app.lar_atual()`.execute(db);
  return Number(r.numAffectedRows ?? 0);
}
