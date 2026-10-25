import { sql, type Kysely } from 'kysely';
import type { DB, SituacaoConvite } from '../tipos';

/**
 * Convites (SDD 3.4; RN-23; G-14). Só o SHA-256 do token é guardado. O convite serve só ao e-mail da sessão:
 * a busca por token sempre filtra também `email = app.email_atual()` (um link encaminhado não serve a outra conta).
 */

export interface ConvitePendente {
  id: string;
  larId: string;
  email: string;
  larNome: string;
  convidadoPorNome: string;
  expiraEm: Date;
}

/** Convites criados pelo lar atual desde o instante dado (cota diária; TM-API-16). */
export async function contarCriadosDesde(db: Kysely<DB>, desde: Date): Promise<number> {
  const r = await sql<{ n: number }>`
    select count(*)::int as n from app.convite
     where lar_id = app.lar_atual() and criado_em > ${desde.toISOString()}::timestamptz`.execute(db);
  return r.rows[0]?.n ?? 0;
}

/** Último convite do lar atual para o endereço (intervalo de reenvio; TM-API-16). */
export async function ultimoParaEmail(db: Kysely<DB>, email: string): Promise<Date | null> {
  const r = await sql<{ criado_em: Date | null }>`
    select max(criado_em) as criado_em from app.convite
     where lar_id = app.lar_atual() and email = ${email}::app.citext`.execute(db);
  return r.rows[0]?.criado_em ?? null;
}

/** Revoga os pendentes do lar atual (convite novo invalida o anterior; G-14). */
export async function cancelarPendentesDoLar(db: Kysely<DB>, agora: Date): Promise<void> {
  await sql`
    update app.convite set situacao = 'cancelado', respondido_em = ${agora.toISOString()}::timestamptz
     where lar_id = app.lar_atual() and situacao = 'pendente'`.execute(db);
}

export async function inserirConvite(
  db: Kysely<DB>,
  dados: {
    larId: string;
    convidadoPor: string;
    email: string;
    tokenHash: Uint8Array;
    larNome: string;
    convidadoPorNome: string;
    agora: Date;
  },
): Promise<{ id: string; email: string; expiraEm: Date }> {
  const agora = dados.agora.toISOString();
  const r = await sql<{ id: string; email: string; expira_em: Date }>`
    insert into app.convite (lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
    values (${dados.larId}, ${dados.convidadoPor}, ${dados.email}, ${dados.tokenHash}, ${dados.larNome},
            ${dados.convidadoPorNome}, ${agora}::timestamptz, ${agora}::timestamptz + interval '7 days')
    returning id, email::text as email, expira_em`.execute(db);
  const linha = r.rows[0];
  if (!linha) throw new Error('convite_nao_criado');
  return { id: linha.id, email: linha.email, expiraEm: linha.expira_em };
}

/** O pendente e válido do lar atual (para a tela do titular). */
export async function buscarPendenteDoLar(
  db: Kysely<DB>,
  agora: Date,
): Promise<{ id: string; email: string; expiraEm: Date } | null> {
  const r = await sql<{ id: string; email: string; expira_em: Date }>`
    select id, email::text as email, expira_em from app.convite
     where lar_id = app.lar_atual() and situacao = 'pendente' and expira_em > ${agora.toISOString()}::timestamptz`.execute(
    db,
  );
  const l = r.rows[0];
  return l ? { id: l.id, email: l.email, expiraEm: l.expira_em } : null;
}

/**
 * Convite pendente e válido para o token E o e-mail da sessão (CA-23.4, CA-23.5). Com `travar`, bloqueia a
 * linha (FOR UPDATE): dois aceites do mesmo link não passam juntos.
 */
export async function buscarPorTokenDoEmailDaSessao(
  db: Kysely<DB>,
  dados: { tokenHash: Uint8Array; agora: Date; travar: boolean },
): Promise<ConvitePendente | null> {
  const r = await sql<{
    id: string;
    lar_id: string;
    email: string;
    lar_nome: string;
    convidado_por_nome: string;
    expira_em: Date;
  }>`
    select id, lar_id, email::text as email, lar_nome, convidado_por_nome, expira_em from app.convite
     where token_hash = ${dados.tokenHash} and email = app.email_atual()::app.citext
       and situacao = 'pendente' and expira_em > ${dados.agora.toISOString()}::timestamptz
     ${dados.travar ? sql`for update` : sql``}`.execute(db);
  const l = r.rows[0];
  return l
    ? {
        id: l.id,
        larId: l.lar_id,
        email: l.email,
        larNome: l.lar_nome,
        convidadoPorNome: l.convidado_por_nome,
        expiraEm: l.expira_em,
      }
    : null;
}

/** Encerra o convite (uso único). */
export async function responderConvite(
  db: Kysely<DB>,
  dados: { id: string; situacao: Extract<SituacaoConvite, 'aceito' | 'recusado'>; agora: Date },
): Promise<void> {
  await sql`
    update app.convite set situacao = ${dados.situacao}, respondido_em = ${dados.agora.toISOString()}::timestamptz
     where id = ${dados.id} and situacao = 'pendente'`.execute(db);
}

/** Recusa numa única instrução: token, e-mail da sessão, pendente e válido. Devolve se encerrou algum. */
export async function recusarPorToken(db: Kysely<DB>, dados: { tokenHash: Uint8Array; agora: Date }): Promise<boolean> {
  const agora = dados.agora.toISOString();
  const r = await sql`
    update app.convite set situacao = 'recusado', respondido_em = ${agora}::timestamptz
     where token_hash = ${dados.tokenHash} and email = app.email_atual()::app.citext
       and situacao = 'pendente' and expira_em > ${agora}::timestamptz`.execute(db);
  return Number(r.numAffectedRows ?? 0) > 0;
}

/** Revogação pelo titular (RN-23): pendente → cancelado. Devolve se o convite existe no lar atual. */
export async function revogarDoLar(db: Kysely<DB>, dados: { id: string; agora: Date }): Promise<boolean> {
  await sql`
    update app.convite set situacao = 'cancelado', respondido_em = ${dados.agora.toISOString()}::timestamptz
     where id = ${dados.id} and lar_id = app.lar_atual() and situacao = 'pendente'`.execute(db);
  const r = await sql<{ ok: boolean }>`
    select exists (select 1 from app.convite where id = ${dados.id} and lar_id = app.lar_atual()) as ok`.execute(db);
  return r.rows[0]?.ok === true;
}
