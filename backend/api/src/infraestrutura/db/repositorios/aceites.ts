import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/** Aceite dos termos com versão (RN-19, G-48). A role `app` insere, mas não altera nem apaga. */
export interface Versoes {
  termos: string;
  privacidade: string;
}

export async function registrarAceite(
  db: Kysely<DB>,
  dados: { usuarioId: string; versoes: Versoes; agora: Date },
): Promise<void> {
  await sql`
    insert into app.aceite_termos (usuario_id, versao_termos, versao_privacidade, aceito_em)
    values (${dados.usuarioId}, ${dados.versoes.termos}, ${dados.versoes.privacidade}, ${dados.agora.toISOString()}::timestamptz)
    on conflict (usuario_id, versao_termos, versao_privacidade) do nothing`.execute(db);
}

export async function aceitouVersoes(db: Kysely<DB>, usuarioId: string, versoes: Versoes): Promise<boolean> {
  const r = await sql<{ ok: boolean }>`
    select exists (
      select 1 from app.aceite_termos
       where usuario_id = ${usuarioId} and versao_termos = ${versoes.termos}
         and versao_privacidade = ${versoes.privacidade}) as ok`.execute(db);
  return r.rows[0]?.ok === true;
}
