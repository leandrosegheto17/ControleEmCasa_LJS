import { sql, type Kysely } from 'kysely';
import type { DB } from '../tipos';

/**
 * Usuários (SDD 3.3; G-17). A senha só existe como parâmetro de `crypt()` no SQL: nunca é interpolada,
 * nunca sai do banco e nunca é comparada no Worker. Custo do bcrypt: 12.
 */

/**
 * Hash bcrypt fixo de custo 12 (GP `contas.ts`): quando o e-mail não existe, a senha é comparada com ele,
 * com o mesmo custo de um usuário real (anti-enumeração por tempo, G-19). Não corresponde a senha alguma.
 */
export const HASH_FIXO = '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

export interface UsuarioBasico {
  id: string;
  nome: string;
  email: string;
  emailConfirmado: boolean;
}

/**
 * Cria o usuário se o e-mail for novo. O `crypt()` roda nos dois casos (o VALUES é avaliado antes do conflito),
 * então e-mail novo e e-mail existente custam o mesmo bcrypt (CA-19.3). Dois cadastros simultâneos com o mesmo
 * e-mail resultam num único usuário (a constraint única decide). Devolve o id ou `null` se o e-mail já existia.
 */
export async function inserirSeNovo(
  db: Kysely<DB>,
  dados: { nome: string; email: string; senha: string; agora: Date },
): Promise<string | null> {
  const agora = dados.agora.toISOString();
  const r = await sql<{ id: string }>`
    insert into app.usuario (email, nome, senha_hash, criado_em, atualizado_em)
    values (${dados.email}, ${dados.nome}, app.crypt(${dados.senha}, app.gen_salt('bf', 12)),
            ${agora}::timestamptz, ${agora}::timestamptz)
    on conflict (email) do nothing
    returning id`.execute(db);
  return r.rows[0]?.id ?? null;
}

/**
 * Confere e-mail e senha numa única consulta. Sem usuário, compara com `HASH_FIXO` (mesmo custo; G-19).
 * Devolve `ok = false` para senha errada ou e-mail inexistente, sem distinguir os dois.
 */
export async function verificarCredenciais(
  db: Kysely<DB>,
  email: string,
  senha: string,
): Promise<{ ok: boolean; usuario: UsuarioBasico | null }> {
  const r = await sql<{
    id: string | null;
    nome: string | null;
    email: string | null;
    confirmado: boolean;
    ok: boolean;
  }>`
    select u.id, u.nome, u.email::text as email, (u.email_confirmado_em is not null) as confirmado,
           app.crypt(${senha}, coalesce(u.senha_hash, ${HASH_FIXO})) = coalesce(u.senha_hash, ${HASH_FIXO}) as ok
      from (select ${email}::app.citext as email) e
      left join app.usuario u on u.email = e.email`.execute(db);
  const linha = r.rows[0];
  if (!linha || !linha.ok || !linha.id) return { ok: false, usuario: null };
  return {
    ok: true,
    usuario: { id: linha.id, nome: linha.nome ?? '', email: linha.email ?? '', emailConfirmado: linha.confirmado },
  };
}

export async function buscarPorEmail(db: Kysely<DB>, email: string): Promise<UsuarioBasico | null> {
  const linha = await db
    .selectFrom('usuario')
    .select(['id', 'nome', 'email', 'email_confirmado_em'])
    .where('email', '=', email)
    .executeTakeFirst();
  return linha
    ? { id: linha.id, nome: linha.nome, email: linha.email, emailConfirmado: linha.email_confirmado_em !== null }
    : null;
}

export async function buscarPorId(db: Kysely<DB>, id: string): Promise<UsuarioBasico | null> {
  const linha = await db
    .selectFrom('usuario')
    .select(['id', 'nome', 'email', 'email_confirmado_em'])
    .where('id', '=', id)
    .executeTakeFirst();
  return linha
    ? { id: linha.id, nome: linha.nome, email: linha.email, emailConfirmado: linha.email_confirmado_em !== null }
    : null;
}

/** Marca o e-mail como confirmado (mantém o primeiro instante se já estava). */
export async function confirmarEmail(db: Kysely<DB>, id: string, agora: Date): Promise<void> {
  const instante = agora.toISOString();
  await sql`
    update app.usuario
       set email_confirmado_em = coalesce(email_confirmado_em, ${instante}::timestamptz),
           atualizado_em = ${instante}::timestamptz
     where id = ${id}`.execute(db);
}

export async function trocarSenha(db: Kysely<DB>, id: string, senha: string, agora: Date): Promise<void> {
  const instante = agora.toISOString();
  await sql`
    update app.usuario
       set senha_hash = app.crypt(${senha}, app.gen_salt('bf', 12)),
           atualizado_em = ${instante}::timestamptz
     where id = ${id}`.execute(db);
}
