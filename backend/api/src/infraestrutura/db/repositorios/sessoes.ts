import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Sessões opacas (RN-20, SDD 5.2, G-15, G-16). O banco guarda só o SHA-256 do token.
 * Validade: `ultimo_uso_em > agora - 15 min` E `expira_absoluta_em > agora` (12 h desde o login).
 */
export const INATIVIDADE_MS = 15 * 60 * 1000;
export const ABSOLUTA_MS = 12 * 60 * 60 * 1000;
/** O `ultimo_uso_em` só é regravado se tiver mais de 60 s (poupa escrita; SDD 5.2). */
export const REGRAVAR_USO_APOS_MS = 60 * 1000;

export async function criarSessao(
  db: Kysely<DB>,
  dados: { usuarioId: string; tokenHash: Uint8Array; agora: Date },
): Promise<void> {
  const agora = dados.agora.toISOString();
  await sql`
    insert into app.sessao (token_hash, usuario_id, criada_em, ultimo_uso_em, expira_absoluta_em)
    values (${dados.tokenHash}, ${dados.usuarioId}, ${agora}::timestamptz, ${agora}::timestamptz,
            ${agora}::timestamptz + interval '12 hours')`.execute(db);
}

export interface SessaoValida {
  usuarioId: string;
  email: string;
}

/**
 * Valida e renova a sessão numa única instrução (SDD 5.1 passo 6): confere inatividade e prazo absoluto,
 * atualiza `ultimo_uso_em` (no máximo 1 vez por minuto, nunca o absoluto) e devolve o usuário.
 */
export async function validarERenovar(
  db: Kysely<DB>,
  tokenHash: Uint8Array,
  agora: Date,
): Promise<SessaoValida | null> {
  const instante = agora.toISOString();
  const r = await sql<{ usuario_id: string; email: string }>`
    with valida as (
      select s.id, s.usuario_id, s.ultimo_uso_em
        from app.sessao s
       where s.token_hash = ${tokenHash}
         and s.ultimo_uso_em > ${instante}::timestamptz - interval '15 minutes'
         and s.expira_absoluta_em > ${instante}::timestamptz
    ), renovada as (
      update app.sessao s
         set ultimo_uso_em = ${instante}::timestamptz
        from valida v
       where s.id = v.id
         and v.ultimo_uso_em < ${instante}::timestamptz - interval '60 seconds'
    )
    select v.usuario_id, u.email::text as email
      from valida v
      join app.usuario u on u.id = v.usuario_id`.execute(db);
  const linha = r.rows[0];
  return linha ? { usuarioId: linha.usuario_id, email: linha.email } : null;
}

export async function apagarPorToken(db: Kysely<DB>, tokenHash: Uint8Array): Promise<void> {
  await db.deleteFrom('sessao').where('token_hash', '=', tokenHash).execute();
}

/** "Sair de todos" e redefinição de senha (G-16): todas as sessões do usuário, inclusive a atual. */
export async function apagarDoUsuario(db: Kysely<DB>, usuarioId: string): Promise<void> {
  await db.deleteFrom('sessao').where('usuario_id', '=', usuarioId).execute();
}
