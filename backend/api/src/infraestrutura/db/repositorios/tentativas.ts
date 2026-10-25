import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Tentativas de login (RN-21, G-20; padrão GP `tentativas.ts`). Fonte de verdade do bloqueio:
 * 5 falhas em 15 min (janela deslizante) por e-mail OU por IP. O sucesso zera a contagem do e-mail.
 * E-mail e IP só existem como HMAC (`email_hash`, `ip_hash`).
 */
export const LIMITE_FALHAS = 5;
export const JANELA_MS = 15 * 60 * 1000;

/** Namespaces das travas consultivas (um e-mail nunca disputa a trava de um IP). */
const TRAVA_EMAIL = 4101;
const TRAVA_IP = 4102;

export type Reserva = { bloqueado: true } | { bloqueado: false; id: string };

/**
 * Numa transação curta, antes do bcrypt (G-20): trava o e-mail e o IP, conta as falhas da janela e,
 * se não houver bloqueio, grava já uma falha provisória. Assim tentativas paralelas não leem todas
 * "0 falhas" antes de a senha ser conferida. A ordem das travas é fixa (e-mail, depois IP): sem impasse.
 */
export async function reservarFalha(
  db: Kysely<DB>,
  dados: { emailHash: Uint8Array; ipHash: Uint8Array | null; agora: Date },
): Promise<Reserva> {
  const agora = dados.agora.toISOString();
  return db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(${TRAVA_EMAIL}, hashtext(encode(${dados.emailHash}::bytea, 'hex')))`.execute(
      trx,
    );
    if (dados.ipHash) {
      await sql`select pg_advisory_xact_lock(${TRAVA_IP}, hashtext(encode(${dados.ipHash}::bytea, 'hex')))`.execute(
        trx,
      );
    }
    const r = await sql<{ falhas_email: number; falhas_ip: number }>`
      select
        (select count(*)::int from app.tentativa_login t
          where t.email_hash = ${dados.emailHash} and not t.sucesso
            and t.momento > ${agora}::timestamptz - interval '15 minutes'
            and t.momento > coalesce(
              (select max(s.momento) from app.tentativa_login s where s.email_hash = ${dados.emailHash} and s.sucesso),
              '-infinity'::timestamptz)) as falhas_email,
        (select count(*)::int from app.tentativa_login t
          where ${dados.ipHash}::bytea is not null and t.ip_hash = ${dados.ipHash} and not t.sucesso
            and t.momento > ${agora}::timestamptz - interval '15 minutes') as falhas_ip`.execute(trx);
    const linha = r.rows[0];
    if (linha && (linha.falhas_email >= LIMITE_FALHAS || linha.falhas_ip >= LIMITE_FALHAS)) {
      return { bloqueado: true } as const;
    }
    const nova = await sql<{ id: string }>`
      insert into app.tentativa_login (email_hash, ip_hash, sucesso, momento)
      values (${dados.emailHash}, ${dados.ipHash}, false, ${agora}::timestamptz)
      returning id::text as id`.execute(trx);
    const id = nova.rows[0]?.id;
    if (!id) throw new Error('tentativa_nao_registrada');
    return { bloqueado: false, id } as const;
  });
}

/** Remove a falha provisória quando a senha confere. */
export async function descartarFalha(db: Kysely<DB>, id: string): Promise<void> {
  await sql`delete from app.tentativa_login where id = ${id}::bigint`.execute(db);
}

export async function registrarSucesso(
  db: Kysely<DB>,
  dados: { emailHash: Uint8Array; ipHash: Uint8Array | null; agora: Date },
): Promise<void> {
  await sql`
    insert into app.tentativa_login (email_hash, ip_hash, sucesso, momento)
    values (${dados.emailHash}, ${dados.ipHash}, true, ${dados.agora.toISOString()}::timestamptz)`.execute(db);
}
