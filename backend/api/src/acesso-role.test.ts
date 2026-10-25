import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import { bancoDisponivel, chamar } from './testes-suporte';

/**
 * A API (e portanto todo o fluxo de acesso) roda como `controle_app`, sem DDL e sem apagar o que é registro
 * (G-04, ADR 005; complementa os testes de grants da etapa 2 em backend/scripts).
 */
function appQueSonda() {
  return criarApp({
    rotas: (a) => {
      a.get('/api/_t/role', async (c) => {
        const db = c.get('db');
        const quem = await sql<{ u: string }>`select current_user as u`.execute(db);
        const tentar = async (comando: ReturnType<typeof sql>) => {
          try {
            await db.transaction().execute((trx) => comando.execute(trx));
            return 'passou';
          } catch (e) {
            return String((e as { code?: string }).code);
          }
        };
        return c.json({
          usuario: quem.rows[0]?.u,
          ddl: await tentar(sql`create table app.invasora (id int)`),
          alterar: await tentar(sql`alter table app.sessao add column x int`),
          apagarUsuario: await tentar(sql`delete from app.usuario`),
          apagarAceite: await tentar(sql`delete from app.aceite_termos`),
          trocarEmail: await tentar(sql`update app.usuario set email = 'x@y.z'`),
          estenderSessao: await tentar(sql`update app.sessao set expira_absoluta_em = now()`),
          trocarHashDoToken: await tentar(sql`update app.token_email set token_hash = token_hash`),
          truncar: await tentar(sql`truncate app.tentativa_login`),
        });
      });
    },
  });
}

describe.skipIf(!bancoDisponivel)('role da API', () => {
  it('é controle_app e recusa DDL, TRUNCATE e escrita fora dos grants com 42501', async () => {
    const r = await chamar(appQueSonda(), '/api/_t/role');
    expect(await r.json()).toEqual({
      usuario: 'controle_app',
      ddl: '42501',
      alterar: '42501',
      apagarUsuario: '42501',
      apagarAceite: '42501',
      trocarEmail: '42501',
      estenderSessao: '42501',
      trocarHashDoToken: '42501',
      truncar: '42501',
    });
  });
});
