import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  avisarSemBanco,
  comCliente,
  criarBancoDescartavel,
  temBanco,
  type BancoDescartavel,
} from './apoio-banco-teste';

/**
 * O backup diário (etapa 16; SDD 3.7, 4, D-06; G-04, G-44; TM-GH-03; ADR-015) roda `pg_dump -Fc --enable-row-security`
 * como `controle_backup_ro`, sem BYPASSRLS. Para o dump sair inteiro, a role precisa conseguir o que o pg_dump faz:
 * travar cada tabela em ACCESS SHARE, ler cada sequência (`last_value`) e ler cada linha com a RLS ligada. Uma tabela
 * com RLS sem a política `backup_leitura` sairia VAZIA em silêncio; uma sequência sem SELECT derruba o dump inteiro.
 * O mesmo vale para o controle das migrations (`public.pgmigrations`): sem ele, o banco restaurado não sabe quais
 * migrations já rodaram.
 */
avisarSemBanco();

interface Relacao {
  nome: string;
  rls: boolean;
}

describe.skipIf(!temBanco)('backup_ro consegue o dump completo (pg_dump --enable-row-security)', () => {
  let banco: BancoDescartavel;
  let tabelas: Relacao[];
  let sequencias: string[];

  beforeAll(async () => {
    banco = await criarBancoDescartavel('backup');
    await comCliente(banco.owner, async (c) => {
      tabelas = (
        await c.query<{ nome: string; rls: boolean }>(
          `select format('%I.%I', n.nspname, c.relname) as nome, c.relrowsecurity as rls
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname in ('app', 'public') and c.relkind in ('r', 'p')
            order by 1`,
        )
      ).rows;
      sequencias = (
        await c.query<{ nome: string }>(
          `select format('%I.%I', n.nspname, c.relname) as nome
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname in ('app', 'public') and c.relkind = 'S'
            order by 1`,
        )
      ).rows.map((r) => r.nome);
    });
  }, 120_000);

  afterAll(async () => {
    await banco?.apagar();
  });

  async function comoBackup<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
    return comCliente(banco.backup, async (c) => {
      await c.query('begin read only');
      try {
        await c.query('set local row_security = on');
        return await fn(c);
      } finally {
        await c.query('rollback');
      }
    });
  }

  it('o catálogo traz as tabelas do app e o controle das migrations', () => {
    const nomes = tabelas.map((t) => t.nome);
    expect(nomes).toContain('public.pgmigrations');
    expect(nomes).toContain('app.lancamento');
    expect(nomes).toContain('app.aviso_push');
    expect(sequencias.length).toBeGreaterThan(0);
  });

  it('toda tabela com RLS tem a política de leitura do backup_ro (SELECT, using true)', async () => {
    const semPolitica = await comCliente(banco.owner, async (c) =>
      (
        await c.query<{ nome: string }>(
          `select format('%I.%I', n.nspname, c.relname) as nome
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname in ('app', 'public') and c.relkind in ('r', 'p') and c.relrowsecurity
              and not exists (
                select 1 from pg_policy p
                 where p.polrelid = c.oid and p.polpermissive and p.polcmd in ('r', '*')
                   and 'controle_backup_ro'::regrole = any (p.polroles)
                   and pg_get_expr(p.polqual, p.polrelid) = 'true')
            order by 1`,
        )
      ).rows.map((r) => r.nome),
    );
    expect(semPolitica).toEqual([]);
  });

  it('trava todas as tabelas em ACCESS SHARE, como o pg_dump faz', async () => {
    await comoBackup(async (c) => {
      await c.query(`lock table ${tabelas.map((t) => t.nome).join(', ')} in access share mode`);
    });
  });

  it('lê o estado de toda sequência (o pg_dump copia last_value)', async () => {
    for (const seq of sequencias) {
      await comoBackup(async (c) => {
        const r = await c.query(`select last_value, is_called from ${seq}`);
        expect(r.rowCount, seq).toBe(1);
      });
    }
  });

  it('com a RLS ligada, lê de toda tabela as mesmas linhas que o dono vê', async () => {
    const contar = (c: pg.Client, t: string) =>
      c.query<{ n: string }>(`select count(*)::text as n from ${t}`).then((r) => r.rows[0]!.n);
    for (const t of tabelas) {
      const doDono = await comCliente(banco.owner, (c) => contar(c, t.nome));
      const doBackup = await comoBackup((c) => contar(c, t.nome));
      expect(doBackup, t.nome).toBe(doDono);
    }
    const migracoes = await comoBackup((c) => contar(c, 'public.pgmigrations'));
    expect(Number(migracoes)).toBeGreaterThan(0);
  });

  it('sem --enable-row-security (row_security = off) o dump falharia nas tabelas com RLS', async () => {
    const comRls = tabelas.find((t) => t.rls)!;
    const erro = await comCliente(banco.backup, async (c) => {
      await c.query('begin read only');
      try {
        await c.query('set local row_security = off');
        await c.query(`select count(*) from ${comRls.nome}`);
        return null;
      } catch (e) {
        return e;
      } finally {
        await c.query('rollback');
      }
    });
    expect((erro as { code?: string } | null)?.code).toBe('42501');
  });

  it('continua sem escrever nada (nem em sequência, nem no controle das migrations)', async () => {
    const privilegios = await comCliente(
      banco.owner,
      async (c) =>
        (
          await c.query<{ nome: string; escreve: boolean }>(
            `select format('%I.%I', n.nspname, c.relname) as nome,
                  case when c.relkind = 'S' then has_sequence_privilege('controle_backup_ro', c.oid, 'USAGE, UPDATE')
                       else has_table_privilege('controle_backup_ro', c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
                  end as escreve
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname in ('app', 'public') and c.relkind in ('r', 'p', 'S')`,
          )
        ).rows,
    );
    for (const p of privilegios) expect(p.escreve, p.nome).toBe(false);
    const criaEmPublic = await comCliente(
      banco.owner,
      async (c) =>
        (
          await c.query<{ cria: boolean }>(
            `select has_schema_privilege('controle_backup_ro', 'public', 'CREATE') as cria`,
          )
        ).rows[0]!.cria,
    );
    expect(criaEmPublic).toBe(false);
  });
});
