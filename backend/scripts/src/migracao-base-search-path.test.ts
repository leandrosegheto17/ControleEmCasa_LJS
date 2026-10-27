import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avisarSemBanco, comCliente, temBanco, URL_OWNER, urlDoBanco } from './apoio-banco-teste';

/**
 * T17 (RNF-07; ADR-005): no Neon o `controle_owner` é NOSUPERUSER NOCREATEROLE e não pode fazer
 * `ALTER ROLE controle_app IN DATABASE ... SET search_path` (42501). A migration base tolera (aviso, sem erro) e o
 * `search_path` é definido antes como `neondb_owner`. Como superusuário (docker local e CI), continua definindo.
 */
avisarSemBanco();

const MIGRATION = join(import.meta.dirname, '../migracoes/20261024120000_base_schema_roles_extensoes.sql');

/** O bloco `do $$ ... $$;` da migration que faz o `alter role ... set search_path`, tal como está no arquivo. */
function blocoDoAlterRole(): string {
  const sql = readFileSync(MIGRATION, 'utf8');
  const blocos = [...sql.matchAll(/do \$\$[\s\S]*?\$\$;/g)].map((m) => m[0]).filter((b) => /alter role/i.test(b));
  expect(blocos).toHaveLength(1);
  return blocos[0]!;
}

async function searchPathNoBanco(c: pg.Client, banco: string): Promise<Record<string, string[]>> {
  const r = await c.query<{ rolname: string; setconfig: string[] }>(
    `select r.rolname, s.setconfig
       from pg_db_role_setting s
       join pg_roles r on r.oid = s.setrole
       join pg_database d on d.oid = s.setdatabase
      where d.datname = $1 and r.rolname in ('controle_app', 'controle_backup_ro')
      order by 1`,
    [banco],
  );
  return Object.fromEntries(r.rows.map((l) => [l.rolname, l.setconfig]));
}

describe.skipIf(!temBanco)('migration base: alter role do search_path (Postgres 18 local)', () => {
  const sufixo = randomBytes(4).toString('hex');
  const banco = `controle_sp_${sufixo}`;
  const dono = `dono_sem_createrole_${sufixo}`;

  beforeAll(async () => {
    await comCliente(URL_OWNER as string, async (c) => {
      // Simula o controle_owner do Neon: dono do banco, sem SUPERUSER e sem CREATEROLE.
      await c.query(`create role ${dono} nologin nosuperuser nocreaterole nocreatedb nobypassrls`);
      await c.query(`create database ${banco} owner ${dono}`);
    });
  }, 60_000);

  afterAll(async () => {
    if (!temBanco) return;
    await comCliente(URL_OWNER as string, async (c) => {
      await c.query(`drop database if exists ${banco} with (force)`);
      await c.query(`drop role if exists ${dono}`);
    });
  }, 60_000);

  it('como role sem CREATEROLE: termina sem erro, avisa e NÃO define o search_path', async () => {
    const avisos: string[] = [];
    await comCliente(urlDoBanco(URL_OWNER as string, banco), async (c) => {
      c.on('notice', (n) => avisos.push(n.message ?? ''));
      await c.query(`set role ${dono}`);
      expect((await c.query<{ u: string }>('select current_user as u')).rows[0]?.u).toBe(dono);
      await expect(c.query(blocoDoAlterRole())).resolves.toBeDefined();
      await c.query('reset role');
      expect(await searchPathNoBanco(c, banco)).toEqual({});
    });
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toContain('O search_path de controle_app nao foi definido pela migration');
    expect(avisos[1]).toContain('O search_path de controle_backup_ro nao foi definido pela migration');
    for (const a of avisos) expect(a).toContain(`IN DATABASE ${banco} SET search_path = app`);
  });

  it('como superusuário (docker local e CI): define o search_path das duas roles no banco, sem aviso', async () => {
    const avisos: string[] = [];
    await comCliente(urlDoBanco(URL_OWNER as string, banco), async (c) => {
      c.on('notice', (n) => avisos.push(n.message ?? ''));
      expect(
        (await c.query<{ s: boolean }>('select rolsuper as s from pg_roles where rolname = current_user')).rows[0]?.s,
      ).toBe(true);
      await c.query(blocoDoAlterRole());
      expect(await searchPathNoBanco(c, banco)).toEqual({
        controle_app: ['search_path=app'],
        controle_backup_ro: ['search_path=app'],
      });
    });
    expect(avisos).toEqual([]);
  });
});
