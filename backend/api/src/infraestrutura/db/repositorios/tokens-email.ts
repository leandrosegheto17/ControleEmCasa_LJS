import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Tokens de link por e-mail (G-18; SDD 3.3 `token_email`): 256 bits, só o SHA-256 no banco, 30 min, uso único.
 * Pedir outro marca os abertos como usados (o índice único parcial garante um aberto por finalidade).
 */
export type Finalidade = 'confirmacao' | 'recuperacao' | 'exclusao';

export const VALIDADE_MS = 30 * 60 * 1000;

export async function emitirToken(
  db: Kysely<DB>,
  dados: { usuarioId: string; finalidade: Finalidade; tokenHash: Uint8Array; agora: Date },
): Promise<void> {
  const agora = dados.agora.toISOString();
  await sql`
    update app.token_email set usado_em = ${agora}::timestamptz
     where usuario_id = ${dados.usuarioId} and finalidade = ${dados.finalidade} and usado_em is null`.execute(db);
  await sql`
    insert into app.token_email (usuario_id, finalidade, token_hash, criado_em, expira_em)
    values (${dados.usuarioId}, ${dados.finalidade}, ${dados.tokenHash}, ${agora}::timestamptz,
            ${agora}::timestamptz + interval '30 minutes')`.execute(db);
}

/** Instante do último token emitido para o usuário e a finalidade (intervalo mínimo de reenvio; TM-API-16). */
export async function ultimoEmitidoEm(db: Kysely<DB>, usuarioId: string, finalidade: Finalidade): Promise<Date | null> {
  const r = await sql<{ criado_em: Date | null }>`
    select max(criado_em) as criado_em from app.token_email
     where usuario_id = ${usuarioId} and finalidade = ${finalidade}`.execute(db);
  return r.rows[0]?.criado_em ?? null;
}

/**
 * Consome o token numa única instrução atômica: só o primeiro de dois POSTs simultâneos vence (G-18).
 * Desconhecido, já usado, vencido ou de outra finalidade: `null` (a rota responde `link_expirado`).
 */
export async function consumirToken(
  db: Kysely<DB>,
  dados: { tokenHash: Uint8Array; finalidade: Finalidade; agora: Date },
): Promise<string | null> {
  const agora = dados.agora.toISOString();
  const r = await sql<{ usuario_id: string }>`
    update app.token_email set usado_em = ${agora}::timestamptz
     where token_hash = ${dados.tokenHash} and finalidade = ${dados.finalidade}
       and usado_em is null and expira_em > ${agora}::timestamptz
    returning usuario_id`.execute(db);
  return r.rows[0]?.usuario_id ?? null;
}
