import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Testes de banco da etapa 2 (PLANO etapa 2; SDD 4 e 12.2; GUARDRAILS G-04, G-43).
 * Rodam contra um Postgres 17 real, num banco descartável criado a cada execução.
 * Sem DATABASE_URL_OWNER/APP/BACKUP localmente, pulam com aviso; no CI (EXIGIR_BANCO=1) falham.
 */
try {
  process.loadEnvFile(join(import.meta.dirname, '../../../.env'));
} catch {
  // sem .env: vale o ambiente do processo
}

const URL_OWNER = process.env['DATABASE_URL_OWNER'];
const URL_APP = process.env['DATABASE_URL_APP'];
const URL_BACKUP = process.env['DATABASE_URL_BACKUP'];
const temBanco = Boolean(URL_OWNER && URL_APP && URL_BACKUP);

if (!temBanco) {
  const msg =
    'Testes de banco PULADOS: defina DATABASE_URL_OWNER, DATABASE_URL_APP e DATABASE_URL_BACKUP (veja .env.example e suba o docker compose).';
  if (process.env['EXIGIR_BANCO'] === '1') throw new Error(msg);
  console.warn(msg);
}

const BIN_MIGRATE = join(import.meta.dirname, '../node_modules/node-pg-migrate/bin/node-pg-migrate.js');
const PASTA_MIGRACOES = join(import.meta.dirname, '../migracoes');
const NOME_BANCO = `controle_teste_${randomBytes(4).toString('hex')}`;

function urlDoBanco(base: string, banco: string): string {
  const u = new URL(base);
  u.pathname = `/${banco}`;
  return u.toString();
}

function migrar(urlOwnerTeste: string): string {
  return execFileSync(
    process.execPath,
    [BIN_MIGRATE, 'up', '-m', PASTA_MIGRACOES, '--database-url-var', 'DATABASE_URL_TESTE', '--no-single-transaction'],
    { env: { ...process.env, DATABASE_URL_TESTE: urlOwnerTeste }, encoding: 'utf8' },
  );
}

async function comCliente<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Executa o SQL numa transação descartada e devolve o SQLSTATE do erro (ou null se passou). */
async function codigoDoErro(c: pg.Client, sql: string): Promise<string | null> {
  await c.query('begin');
  try {
    await c.query(sql);
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'sem-codigo';
  } finally {
    await c.query('rollback');
  }
}

const NEGADO = '42501'; // insufficient_privilege

describe.skipIf(!temBanco)('banco: migrations, roles e GUC (Postgres 17 real)', () => {
  let urlOwner: string;
  let urlApp: string;
  let urlBackup: string;
  let saidaMigracao = '';

  beforeAll(async () => {
    await comCliente(URL_OWNER as string, (c) => c.query(`create database ${NOME_BANCO}`));
    urlOwner = urlDoBanco(URL_OWNER as string, NOME_BANCO);
    urlApp = urlDoBanco(URL_APP as string, NOME_BANCO);
    urlBackup = urlDoBanco(URL_BACKUP as string, NOME_BANCO);
    saidaMigracao = migrar(urlOwner);
  }, 120_000);

  afterAll(async () => {
    if (!temBanco) return;
    await comCliente(URL_OWNER as string, (c) => c.query(`drop database if exists ${NOME_BANCO} with (force)`));
  }, 60_000);

  describe('(a) migrations do zero', () => {
    it('aplicam sem erro e criam as tabelas de identidade', async () => {
      expect(saidaMigracao).toMatch(/Migrations complete/i);
      const r = await comCliente(urlOwner, (c) =>
        c.query<{ tablename: string }>(`select tablename from pg_tables where schemaname = 'app' order by 1`),
      );
      // Etapa 6 acrescentou lar, membro, convite e categoria (migration 20261024130000); a etapa 7,
      // conta, forma_pagamento e movimento_conta (migration 20261024140000); a etapa 8, lancamento,
      // lancamento_pagamento e parcela (migration 20261025120000); a etapa 9, despesa_fixa e ocorrencia_fixa
      // (migration 20261026120000).
      expect(r.rows.map((x) => x.tablename)).toEqual([
        'aceite_termos',
        'categoria',
        'conta',
        'convite',
        'despesa_fixa',
        'forma_pagamento',
        'lancamento',
        'lancamento_pagamento',
        'lar',
        'membro',
        'movimento_conta',
        'ocorrencia_fixa',
        'parcela',
        'sessao',
        'tentativa_login',
        'token_email',
        'usuario',
      ]);
    });

    it('rodar de novo não aplica nada e não falha', () => {
      expect(() => migrar(urlOwner)).not.toThrow();
    });

    it('as tabelas são do owner e pgcrypto/citext estão instaladas', async () => {
      const r = await comCliente(urlOwner, async (c) => ({
        donos: await c.query<{ tableowner: string }>(
          `select distinct tableowner from pg_tables where schemaname = 'app'`,
        ),
        ext: await c.query<{ extname: string }>(
          `select extname from pg_extension where extname in ('pgcrypto','citext') order by 1`,
        ),
      }));
      expect(r.donos.rows).toEqual([{ tableowner: 'controle_owner' }]);
      expect(r.ext.rows.map((x) => x.extname)).toEqual(['citext', 'pgcrypto']);
    });
  });

  describe('(b) a role app não faz DDL nem DELETE onde excluir não é regra', () => {
    it.each([
      ['CREATE TABLE', 'create table minha_tabela (id int)'],
      ['CREATE TABLE no schema app', 'create table app.minha_tabela (id int)'],
      ['CREATE TEMP TABLE', 'create temp table t (id int)'],
      ['CREATE SCHEMA', 'create schema intruso'],
      ['CREATE FUNCTION', 'create function app.f() returns int language sql as $$ select 1 $$'],
      ['ALTER TABLE', 'alter table app.usuario add column x int'],
      ['DROP TABLE', 'drop table app.usuario'],
      ['TRUNCATE', 'truncate app.sessao'],
      ['DELETE em usuario', 'delete from app.usuario'],
      ['DELETE em aceite_termos', 'delete from app.aceite_termos'],
      ['UPDATE de coluna não liberada (usuario.email)', `update app.usuario set email = 'x@y.z'`],
      ['UPDATE de coluna não liberada (sessao.token_hash)', `update app.sessao set token_hash = '\\x00'`],
      ['UPDATE em tentativa_login', 'update app.tentativa_login set sucesso = true'],
      ['UPDATE em aceite_termos', `update app.aceite_termos set versao_termos = 'x'`],
      ['SET ROLE controle_owner', 'set role controle_owner'],
      ['REFERENCES', 'create table app.x (u uuid references app.usuario (id))'],
    ])('recusa %s com permissão negada', async (_nome, sql) => {
      const codigo = await comCliente(urlApp, (c) => codigoDoErro(c, sql));
      expect(codigo).toBe(NEGADO);
    });

    it('permite o que o SDD concede: inserir e ler, atualizar colunas liberadas, apagar sessão e tentativa', async () => {
      await comCliente(urlApp, async (c) => {
        await c.query('begin');
        const u = await c.query<{ id: string }>(
          `insert into app.usuario (email, nome, senha_hash)
           values ('Ana@Exemplo.com', 'Ana', crypt('segredo', gen_salt('bf', 4))) returning id`,
        );
        const id = u.rows[0]?.id;
        await c.query(
          `insert into app.sessao (token_hash, usuario_id, criada_em, expira_absoluta_em)
           values (sha256('t'), $1, '2026-01-01T00:00:00Z', '2026-01-01T12:00:00Z')`,
          [id],
        );
        await c.query(`update app.sessao set ultimo_uso_em = now()`);
        await c.query(`insert into app.tentativa_login (email_hash, sucesso) values (sha256('e'), false)`);
        await c.query(`update app.usuario set nome = 'Ana B', atualizado_em = now()`);
        const ok = await c.query(`select 1 from app.usuario where crypt('segredo', senha_hash) = senha_hash`);
        expect(ok.rowCount).toBe(1);
        const cit = await c.query(`select 1 from app.usuario where email = 'ana@exemplo.com'`);
        expect(cit.rowCount).toBe(1);
        expect((await c.query('delete from app.sessao')).rowCount).toBe(1);
        expect((await c.query('delete from app.tentativa_login')).rowCount).toBe(1);
        await c.query('rollback');
      });
    });
  });

  describe('(c) atributos e privilégios das roles', () => {
    it('app e backup_ro não são SUPERUSER, não têm BYPASSRLS, CREATEDB nem CREATEROLE', async () => {
      const r = await comCliente(urlOwner, (c) =>
        c.query(
          `select rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin
             from pg_roles where rolname in ('controle_app', 'controle_backup_ro') order by 1`,
        ),
      );
      const falsos = {
        rolsuper: false,
        rolbypassrls: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolcanlogin: true,
      };
      expect(r.rows).toEqual([
        { rolname: 'controle_app', ...falsos },
        { rolname: 'controle_backup_ro', ...falsos },
      ]);
    });

    it('conectada, a app confirma que não é superusuário e não é dona de nada', async () => {
      const r = await comCliente(urlApp, async (c) => ({
        sup: await c.query(`show is_superuser`),
        donos: await c.query(
          `select count(*)::int as n from pg_class c join pg_roles o on o.oid = c.relowner
            where o.rolname = 'controle_app'`,
        ),
      }));
      expect(r.sup.rows[0]).toEqual({ is_superuser: 'off' });
      expect(r.donos.rows[0]).toEqual({ n: 0 });
    });

    it('app sem CREATE em schema, sem TRUNCATE/REFERENCES/TRIGGER; backup_ro só lê; sem SECURITY DEFINER', async () => {
      const r = await comCliente(urlOwner, async (c) => ({
        schemas: await c.query<{ nspname: string; app: boolean; ro: boolean }>(
          `select nspname,
                  has_schema_privilege('controle_app', oid, 'CREATE') as app,
                  has_schema_privilege('controle_backup_ro', oid, 'CREATE') as ro
             from pg_namespace where nspname in ('public', 'app')`,
        ),
        tabelas: await c.query<{ relname: string; proibido: boolean; ro_escreve: boolean; ro_le: boolean }>(
          `select relname,
                  has_table_privilege('controle_app', oid, 'TRUNCATE, REFERENCES, TRIGGER') as proibido,
                  has_table_privilege('controle_backup_ro', oid, 'INSERT, UPDATE, DELETE, TRUNCATE') as ro_escreve,
                  has_table_privilege('controle_backup_ro', oid, 'SELECT') as ro_le
             from pg_class where relnamespace = 'app'::regnamespace and relkind = 'r'`,
        ),
        publicUsa: await c.query<{ usa: boolean }>(
          `select has_schema_privilege('controle_app', 'public', 'USAGE') as usa`,
        ),
        secdef: await c.query(
          `select proname from pg_proc p
            where pronamespace = 'app'::regnamespace and prosecdef
              and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`,
        ),
      }));
      for (const s of r.schemas.rows) {
        expect(s.app, `app com CREATE em ${s.nspname}`).toBe(false);
        expect(s.ro, `backup_ro com CREATE em ${s.nspname}`).toBe(false);
      }
      // Motivo da mudança (etapa 8): a migration de lançamentos acrescenta 3 tabelas (lancamento, lancamento_pagamento,
      // parcela); as mesmas checagens de privilégio valem para elas. Motivo da mudança (etapa 9): a migration de
      // fixas acrescenta 2 tabelas (despesa_fixa, ocorrencia_fixa), com as mesmas checagens.
      expect(r.tabelas.rows.length).toBe(17); // 5 de acesso (etapa 2) + 4 de lar e vínculo (etapa 6) + 3 de cadastros (etapa 7) + 3 de lançamentos (etapa 8) + 2 de fixas (etapa 9)
      for (const t of r.tabelas.rows) {
        expect(t.proibido, `app com privilégio proibido em ${t.relname}`).toBe(false);
        expect(t.ro_escreve, `backup_ro escreve em ${t.relname}`).toBe(false);
        expect(t.ro_le, `backup_ro sem SELECT em ${t.relname}`).toBe(true);
      }
      expect(r.publicUsa.rows[0]).toEqual({ usa: false });
      expect(r.secdef.rows).toEqual([]);
    });

    it('backup_ro lê mas não escreve', async () => {
      await comCliente(urlBackup, async (c) => {
        expect((await c.query('select count(*)::int as n from app.usuario')).rows[0]).toEqual({ n: 0 });
        expect(
          await codigoDoErro(c, `insert into app.tentativa_login (email_hash, sucesso) values ('\\x00', true)`),
        ).toBe(NEGADO);
        expect(await codigoDoErro(c, 'create table t (id int)')).toBe(NEGADO);
      });
    });
  });

  describe('(d) funções de GUC', () => {
    const LEITURAS = `select app.usuario_atual() as usuario, app.lar_atual() as lar,
                             app.membro_atual() as membro, app.email_atual() as email, app.em_sistema() as sistema`;
    const NULOS = { usuario: null, lar: null, membro: null, email: null, sistema: false };
    const U = '11111111-1111-4111-8111-111111111111';
    const L = '22222222-2222-4222-8222-222222222222';

    it('retornam nulo sem set_config', async () => {
      const r = await comCliente(urlApp, (c) => c.query(LEITURAS));
      expect(r.rows[0]).toEqual(NULOS);
    });

    it('retornam o valor dentro da transação e nulo de novo depois do commit (mesma conexão)', async () => {
      await comCliente(urlApp, async (c) => {
        await c.query('begin');
        await c.query(
          `select set_config('app.usuario_id', $1, true), set_config('app.lar_id', $2, true),
                  set_config('app.email', 'a@b.c', true), set_config('app.sistema', 'webhook', true)`,
          [U, L],
        );
        const dentro = await c.query(LEITURAS);
        expect(dentro.rows[0]).toEqual({ usuario: U, lar: L, membro: null, email: 'a@b.c', sistema: true });
        await c.query('commit');

        const depois = await c.query(LEITURAS);
        expect(depois.rows[0]).toEqual(NULOS);
        // o GUC já definido volta como '' (não NULL): a função trata como nulo (TM-DB-01)
        expect((await c.query(`select current_setting('app.usuario_id', true) as v`)).rows[0]).toEqual({ v: '' });
      });
    });

    it('também ficam nulas depois de ROLLBACK', async () => {
      await comCliente(urlApp, async (c) => {
        await c.query('begin');
        await c.query(`select set_config('app.usuario_id', $1, true)`, [U]);
        await c.query('rollback');
        expect((await c.query(LEITURAS)).rows[0]).toEqual(NULOS);
      });
    });

    it('valor vazio, malformado ou de sistema desconhecido vira nulo/falso, sem erro', async () => {
      await comCliente(urlApp, async (c) => {
        await c.query('begin');
        await c.query(
          `select set_config('app.usuario_id', 'nao-e-uuid', true), set_config('app.lar_id', '', true),
                  set_config('app.email', '', true), set_config('app.sistema', 'qualquer', true)`,
        );
        expect((await c.query(LEITURAS)).rows[0]).toEqual(NULOS);
        await c.query('rollback');
      });
    });

    it('são STABLE, SECURITY INVOKER e executáveis por app e backup_ro, mas não por public', async () => {
      const r = await comCliente(urlOwner, (c) =>
        c.query(
          `select p.proname, p.provolatile, p.prosecdef,
                  has_function_privilege('controle_app', p.oid, 'EXECUTE') as app,
                  has_function_privilege('controle_backup_ro', p.oid, 'EXECUTE') as ro,
                  has_function_privilege('public', p.oid, 'EXECUTE') as publico
             from pg_proc p
            where p.pronamespace = 'app'::regnamespace
              and p.proname in ('usuario_atual','lar_atual','membro_atual','email_atual','em_sistema')
            order by 1`,
        ),
      );
      expect(r.rows).toHaveLength(5);
      for (const f of r.rows) {
        expect(f).toMatchObject({ provolatile: 's', prosecdef: false, app: true, ro: true, publico: false });
      }
    });
  });

  describe('constraints das tabelas de identidade (SDD 3.3)', () => {
    const UID = `'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'`;
    const CHECK = '23514';
    const UNICO = '23505';

    /** Cria um usuário base e roda o SQL (pode ter vários comandos); devolve o SQLSTATE ou null. */
    async function violacao(sql: string): Promise<string | null> {
      return comCliente(urlOwner, async (c) => {
        await c.query('begin');
        try {
          await c.query(`insert into app.usuario (id, email, nome, senha_hash) values (${UID}, 'x@y.z', 'X', 'h')`);
          await c.query(sql);
          return null;
        } catch (e) {
          return (e as { code?: string }).code ?? 'sem-codigo';
        } finally {
          await c.query('rollback');
        }
      });
    }

    it('e-mail é único sem diferenciar caixa', async () => {
      expect(await violacao(`insert into app.usuario (email, nome, senha_hash) values ('X@Y.Z', 'Y', 'h')`)).toBe(
        UNICO,
      );
    });
    it('nome vazio, só espaços ou com mais de 60 caracteres é recusado', async () => {
      for (const nome of ["''", "'   '", `'${'a'.repeat(61)}'`]) {
        expect(await violacao(`insert into app.usuario (email, nome, senha_hash) values ('n@y.z', ${nome}, 'h')`)).toBe(
          CHECK,
        );
      }
    });
    it('e-mail com mais de 254 caracteres é recusado', async () => {
      const com = (n: number) =>
        `insert into app.usuario (email, nome, senha_hash) values ('${'a'.repeat(n)}@y.z', 'N', 'h')`;
      expect(await violacao(com(250))).toBeNull(); // 254 caracteres: limite
      expect(await violacao(com(251))).toBe(CHECK); // 255 caracteres
    });
    it('sessão: token_hash de 32 bytes e expiração absoluta de exatamente 12 h', async () => {
      const ins = (hash: string, exp: string) =>
        `insert into app.sessao (token_hash, usuario_id, criada_em, expira_absoluta_em)
         values (${hash}, ${UID}, '2026-01-01T00:00:00Z', '${exp}')`;
      expect(await violacao(ins(`sha256('a')`, '2026-01-01T12:00:00Z'))).toBeNull();
      expect(await violacao(ins(`'\\x00'`, '2026-01-01T12:00:00Z'))).toBe(CHECK);
      expect(await violacao(ins(`sha256('a')`, '2026-01-01T13:00:00Z'))).toBe(CHECK);
    });
    it('token_email: finalidade válida, 32 bytes, 30 min e um só aberto por finalidade', async () => {
      const ins = (fin: string, hash: string, exp: string) =>
        `insert into app.token_email (usuario_id, finalidade, token_hash, criado_em, expira_em)
         values (${UID}, '${fin}', ${hash}, '2026-01-01T00:00:00Z', '${exp}')`;
      const ok = '2026-01-01T00:30:00Z';
      expect(await violacao(ins('confirmacao', `sha256('a')`, ok))).toBeNull();
      expect(await violacao(ins('outra', `sha256('a')`, ok))).toBe(CHECK);
      expect(await violacao(ins('confirmacao', `'\\x00'`, ok))).toBe(CHECK);
      expect(await violacao(ins('confirmacao', `sha256('a')`, '2026-01-01T01:00:00Z'))).toBe(CHECK);
      expect(await violacao(`${ins('confirmacao', `sha256('a')`, ok)}; ${ins('confirmacao', `sha256('b')`, ok)}`)).toBe(
        UNICO,
      );
      expect(
        await violacao(`${ins('confirmacao', `sha256('a')`, ok)}; ${ins('recuperacao', `sha256('b')`, ok)}`),
      ).toBeNull();
    });
    it('aceite_termos é único por usuário e versões', async () => {
      const ins = `insert into app.aceite_termos (usuario_id, versao_termos, versao_privacidade) values (${UID}, '1', '1')`;
      expect(await violacao(`${ins}; ${ins}`)).toBe(UNICO);
    });
    it('apagar o usuário (owner, purga) leva sessões, tokens e aceites em cascata', async () => {
      await comCliente(urlOwner, async (c) => {
        await c.query('begin');
        await c.query(`insert into app.usuario (id, email, nome, senha_hash) values (${UID}, 'x@y.z', 'X', 'h')`);
        await c.query(
          `insert into app.aceite_termos (usuario_id, versao_termos, versao_privacidade) values (${UID}, '1', '1')`,
        );
        await c.query(`delete from app.usuario`);
        expect((await c.query('select count(*)::int as n from app.aceite_termos')).rows[0]).toEqual({ n: 0 });
        await c.query('rollback');
      });
    });
  });
});
