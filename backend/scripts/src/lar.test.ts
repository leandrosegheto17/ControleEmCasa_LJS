import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  avisarSemBanco,
  codigoDoErro,
  comCliente,
  consultar,
  criarBancoDescartavel,
  definirGuc,
  emTransacao,
  linhasAfetadas,
  temBanco,
  type BancoDescartavel,
  type Identidade,
} from './apoio-banco-teste';

/**
 * Lar, membro, convite e categoria no banco (PLANO etapa 6; SDD 3.4, 3.5, 4, 12.2; ADR-004, ADR-009;
 * G-01, G-04, G-07, G-14; CA-T1.5, CA-11.1, CA-23.6). Postgres 17 real, banco descartável.
 * Tudo como `controle_app` (sem BYPASSRLS), com a identidade em GUC local, como a API grava.
 * Teste negativo POR TABELA: o lar B não lê nem escreve nada do lar A, e o membro não vê o individual do outro.
 */
avisarSemBanco();

const NEGADO = '42501'; // insufficient_privilege (grant ausente ou violação de RLS)
const UNICO = '23505';
const FK = '23503';
const CHECK = '23514';
const TABELAS = ['categoria', 'convite', 'lar', 'membro'];

interface Usuario {
  id: string;
  email: string;
}
interface Lar {
  id: string;
  titular: { usuario: Usuario; membro: string };
  membro?: { usuario: Usuario; membro: string };
  convite: string;
}

const novoUsuario = (prefixo: string): Usuario => ({
  id: randomUUID(),
  email: `${prefixo}.${randomBytes(3).toString('hex')}@exemplo.com`,
});

const idTitular = (l: Lar): Identidade => ({
  usuario: l.titular.usuario.id,
  email: l.titular.usuario.email,
  lar: l.id,
  membro: l.titular.membro,
  papel: 'titular',
});
const idMembro = (l: Lar): Identidade => ({
  usuario: l.membro!.usuario.id,
  email: l.membro!.usuario.email,
  lar: l.id,
  membro: l.membro!.membro,
  papel: 'membro',
});

async function criarUsuario(c: pg.Client, u: Usuario): Promise<void> {
  await c.query(`insert into app.usuario (id, email, nome, senha_hash) values ($1, $2, 'Pessoa', 'sem-senha')`, [
    u.id,
    u.email,
  ]);
}

const AGORA = '2026-10-24T12:00:00Z';

async function convidar(c: pg.Client, id: Identidade, email: string): Promise<string> {
  const r = await c.query<{ id: string }>(
    `insert into app.convite (lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
     values ($1, $2, $3, $4, 'Casa', 'Titular', $5::timestamptz, $5::timestamptz + interval '7 days') returning id`,
    [id.lar, id.membro, email, randomBytes(32), AGORA],
  );
  return r.rows[0]!.id;
}

/** Monta um lar como a API faria, passo a passo, como `app`: titular, categorias, convite e (opcional) membro. */
async function montarLar(c: pg.Client, titular: Usuario, convidado: Usuario | null): Promise<Lar> {
  await criarUsuario(c, titular);
  const base = { usuario: titular.id, email: titular.email };
  const { lar, membro } = await emTransacao(c, base, async () => {
    const l = await c.query<{ id: string }>(`insert into app.lar (nome, criado_por) values ('Casa', $1) returning id`, [
      titular.id,
    ]);
    const larId = l.rows[0]!.id;
    const m = await c.query<{ id: string }>(
      `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, $2, 'Titular', 'titular') returning id`,
      [larId, titular.id],
    );
    return { lar: larId, membro: m.rows[0]!.id };
  });
  const idT: Identidade = { ...base, lar, membro, papel: 'titular' };
  const convite = await emTransacao(c, idT, async () => {
    await c.query(
      `insert into app.categoria (lar_id, tipo, escopo, nome, variavel) values ($1, 'despesa', 'conjunto', 'Mercado', true)`,
      [lar],
    );
    await c.query(
      `insert into app.categoria (lar_id, tipo, escopo, dono_id, nome, variavel) values ($1, 'despesa', 'individual', $2, 'Academia', false)`,
      [lar, membro],
    );
    return convidar(c, idT, convidado ? convidado.email : `ninguem.${randomBytes(3).toString('hex')}@exemplo.com`);
  });
  const resultado: Lar = { id: lar, titular: { usuario: titular, membro }, convite };
  if (convidado) {
    await criarUsuario(c, convidado);
    const m2 = await emTransacao(c, { usuario: convidado.id, email: convidado.email }, async () => {
      const m = await c.query<{ id: string }>(
        `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, $2, 'Convidado', 'membro') returning id`,
        [lar, convidado.id],
      );
      await c.query(`update app.convite set situacao = 'aceito', respondido_em = now() where id = $1`, [convite]);
      return m.rows[0]!.id;
    });
    resultado.membro = { usuario: convidado, membro: m2 };
    await emTransacao(c, idMembro(resultado), () =>
      c.query(
        `insert into app.categoria (lar_id, tipo, escopo, dono_id, nome, variavel) values ($1, 'despesa', 'individual', $2, 'Academia', false)`,
        [lar, m2],
      ),
    );
  }
  return resultado;
}

describe.skipIf(!temBanco)('lar, membro, convite e categoria (Postgres 17 real, role app)', () => {
  let banco: BancoDescartavel;
  let app: pg.Client;
  let A: Lar;
  let B: Lar;

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_lar');
    app = new pg.Client({ connectionString: banco.app });
    await app.connect();
    A = await montarLar(app, novoUsuario('ana'), novoUsuario('bruno'));
    B = await montarLar(app, novoUsuario('carla'), novoUsuario('diego'));
  }, 120_000);

  afterAll(async () => {
    if (!temBanco) return;
    await app?.end();
    await banco?.apagar();
  }, 60_000);

  describe('estrutura (G-01, G-04, SDD 3.7)', () => {
    it('as 4 tabelas têm ENABLE e FORCE ROW LEVEL SECURITY', async () => {
      const r = await comCliente(banco.owner, (c) =>
        c.query<{ relname: string; rls: boolean; force: boolean }>(
          `select relname, relrowsecurity as rls, relforcerowsecurity as force from pg_class
            where relnamespace = 'app'::regnamespace and relname = any($1) order by 1`,
          [TABELAS],
        ),
      );
      expect(r.rows).toEqual(TABELAS.map((relname) => ({ relname, rls: true, force: true })));
    });

    it('cada comando concedido à app tem política para controle_app, e nenhuma é using/with check (true)', async () => {
      const r = await comCliente(banco.owner, async (c) => ({
        politicas: await c.query<{ tablename: string; cmd: string; qual: string | null; with_check: string | null }>(
          `select tablename, cmd, qual, with_check from pg_policies
            where schemaname = 'app' and tablename = any($1) and 'controle_app' = any(roles)`,
          [TABELAS],
        ),
        backup: await c.query<{ tablename: string }>(
          `select tablename from pg_policies
            where schemaname = 'app' and tablename = any($1) and policyname = 'backup_leitura'
              and roles = '{controle_backup_ro}' and cmd = 'SELECT' order by 1`,
          [TABELAS],
        ),
      }));
      const comandos = (t: string) =>
        r.politicas.rows
          .filter((p) => p.tablename === t)
          .map((p) => p.cmd)
          .sort();
      expect(comandos('lar')).toEqual(['INSERT', 'SELECT', 'UPDATE']);
      expect(comandos('membro')).toEqual(['INSERT', 'SELECT', 'UPDATE']);
      expect(comandos('convite')).toEqual(['INSERT', 'SELECT', 'UPDATE']);
      expect(comandos('categoria')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
      for (const p of r.politicas.rows) {
        expect(p.qual, `${p.tablename} ${p.cmd}`).not.toBe('true');
        expect(p.with_check, `${p.tablename} ${p.cmd}`).not.toBe('true');
      }
      expect(r.backup.rows.map((x) => x.tablename)).toEqual(TABELAS);
    });

    it('a função de papel é STABLE, SECURITY INVOKER, executável pela app e nula sem GUC', async () => {
      const f = await comCliente(banco.owner, (c) =>
        c.query(
          `select provolatile, prosecdef, has_function_privilege('controle_app', oid, 'EXECUTE') as app,
                  has_function_privilege('public', oid, 'EXECUTE') as publico
             from pg_proc where pronamespace = 'app'::regnamespace and proname = 'papel_atual'`,
        ),
      );
      expect(f.rows).toEqual([{ provolatile: 's', prosecdef: false, app: true, publico: false }]);
      expect((await app.query(`select app.papel_atual() as p`)).rows[0]).toEqual({ p: null });
      const outro = await consultar<{ p: string | null }>(app, `select app.papel_atual() as p`, { papel: 'dono' });
      expect(outro).toEqual([{ p: null }]);
    });
  });

  describe('grants: a app não apaga onde excluir não é regra nem muda chave, dono, lar ou escopo (SDD 4, G-08)', () => {
    it.each([
      ['DELETE em lar', 'delete from app.lar'],
      ['DELETE em membro', 'delete from app.membro'],
      ['DELETE em convite', 'delete from app.convite'],
      ['TRUNCATE categoria', 'truncate app.categoria'],
      ['UPDATE lar.criado_por', `update app.lar set criado_por = id`],
      ['UPDATE membro.lar_id', `update app.membro set lar_id = lar_id`],
      ['UPDATE membro.usuario_id', `update app.membro set usuario_id = null`],
      ['UPDATE membro.papel', `update app.membro set papel = 'titular'`],
      ['UPDATE convite.email', `update app.convite set email = 'x@y.z'`],
      ['UPDATE convite.token_hash', `update app.convite set token_hash = token_hash`],
      ['UPDATE convite.lar_id', `update app.convite set lar_id = lar_id`],
      ['UPDATE categoria.escopo', `update app.categoria set escopo = 'conjunto'`],
      ['UPDATE categoria.dono_id', `update app.categoria set dono_id = null`],
      ['UPDATE categoria.lar_id', `update app.categoria set lar_id = lar_id`],
      ['UPDATE categoria.tipo', `update app.categoria set tipo = 'despesa'`],
      ['ALTER TABLE lar', 'alter table app.lar disable row level security'],
      ['DROP POLICY', 'drop policy lar_select on app.lar'],
    ])('recusa %s com permissão negada', async (_nome, sql) => {
      expect(await codigoDoErro(app, sql, idTitular(A))).toBe(NEGADO);
    });
  });

  describe('sem GUC (ou GUC vazio), nenhuma linha (G-02)', () => {
    it.each(TABELAS)('%s: 0 linhas', async (tabela) => {
      const r = await consultar<{ n: number }>(app, `select count(*)::int as n from app.${tabela}`, {});
      expect(r).toEqual([{ n: 0 }]);
    });
  });

  describe('lar B × lar A, por tabela (CA-T1.1, CA-T1.5, R3)', () => {
    const idB = () => idTitular(B);

    it('lar: B não lê nem renomeia o lar A', async () => {
      expect(await consultar(app, `select * from app.lar where id = $1`, idB(), [A.id])).toEqual([]);
      expect(await linhasAfetadas(app, `update app.lar set nome = 'Invadido' where id = $1`, idB(), [A.id])).toBe(0);
      const todos = await consultar<{ id: string }>(app, `select id from app.lar`, idB());
      expect(todos.map((x) => x.id)).toEqual([B.id]);
    });

    it('membro: B não lê os membros de A, não os remove e não entra em A como titular nem como membro', async () => {
      expect(await consultar(app, `select * from app.membro where lar_id = $1`, idB(), [A.id])).toEqual([]);
      expect(await linhasAfetadas(app, `update app.membro set saiu_em = now() where lar_id = $1`, idB(), [A.id])).toBe(
        0,
      );
      const entrarComo = (papel: string) =>
        codigoDoErro(
          app,
          `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, app.usuario_atual(), 'Intruso', $2)`,
          { usuario: B.titular.usuario.id, email: B.titular.usuario.email },
          [A.id, papel],
        );
      expect(await entrarComo('titular')).toBe(NEGADO);
      expect(await entrarComo('membro')).toBe(NEGADO);
    });

    it('convite: B não lê nem revoga convites de A e não cria convite no lar A', async () => {
      expect(await consultar(app, `select * from app.convite where lar_id = $1`, idB(), [A.id])).toEqual([]);
      expect(
        await linhasAfetadas(app, `update app.convite set situacao = 'cancelado' where lar_id = $1`, idB(), [A.id]),
      ).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.convite (lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
           values ($1, $2, 'alvo@exemplo.com', $3, 'Casa', 'X', now(), now() + interval '7 days')`,
          idB(),
          [A.id, A.titular.membro, randomBytes(32)],
        ),
      ).toBe(NEGADO);
    });

    it('categoria: B não lê, altera, apaga nem cria categoria no lar A', async () => {
      expect(await consultar(app, `select * from app.categoria where lar_id = $1`, idB(), [A.id])).toEqual([]);
      expect(await linhasAfetadas(app, `update app.categoria set nome = 'X' where lar_id = $1`, idB(), [A.id])).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.categoria where lar_id = $1`, idB(), [A.id])).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.categoria (lar_id, tipo, escopo, nome, variavel) values ($1, 'despesa', 'conjunto', 'Intrusa', false)`,
          idB(),
          [A.id],
        ),
      ).toBe(NEGADO);
    });

    it('as contagens de B não mudam com os dados de A (nada de A entra em total)', async () => {
      const contar = (t: string) => consultar<{ n: number }>(app, `select count(*)::int as n from app.${t}`, idB());
      expect(await contar('lar')).toEqual([{ n: 1 }]);
      expect(await contar('membro')).toEqual([{ n: 2 }]);
      expect(await contar('convite')).toEqual([{ n: 1 }]);
      // conjunta de B + individual do próprio titular de B
      expect(await contar('categoria')).toEqual([{ n: 2 }]);
    });
  });

  describe('membro × individual do outro membro (CA-T1.2, RN-02)', () => {
    it('o convidado vê a conjunta, mas não a individual do titular (nem o inverso)', async () => {
      const visiveis = (id: Identidade) =>
        consultar<{ nome: string; escopo: string; dono_id: string | null }>(
          app,
          `select nome, escopo, dono_id from app.categoria order by escopo, nome`,
          id,
        );
      expect(await visiveis(idMembro(A))).toEqual([
        { nome: 'Mercado', escopo: 'conjunto', dono_id: null },
        { nome: 'Academia', escopo: 'individual', dono_id: A.membro!.membro },
      ]);
      expect(await visiveis(idTitular(A))).toEqual([
        { nome: 'Mercado', escopo: 'conjunto', dono_id: null },
        { nome: 'Academia', escopo: 'individual', dono_id: A.titular.membro },
      ]);
    });

    it('o convidado não altera, não apaga e não cria individual em nome do titular', async () => {
      const deA = [A.titular.membro];
      expect(
        await linhasAfetadas(app, `update app.categoria set nome = 'X' where dono_id = $1`, idMembro(A), deA),
      ).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.categoria where dono_id = $1`, idMembro(A), deA)).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.categoria (lar_id, tipo, escopo, dono_id, nome, variavel) values ($1, 'despesa', 'individual', $2, 'Plantada', false)`,
          idMembro(A),
          [A.id, A.titular.membro],
        ),
      ).toBe(NEGADO);
    });

    it('a conjunta segue editável pelos dois membros (RN-17)', async () => {
      expect(
        await linhasAfetadas(app, `update app.categoria set nome = 'Feira' where escopo = 'conjunto'`, idMembro(A)),
      ).toBe(1);
    });
  });

  describe('ações do titular no banco (RN-22, RN-23; ADR-009)', () => {
    it('o convidado não renomeia o lar, não convida e não remove o titular', async () => {
      expect(await linhasAfetadas(app, `update app.lar set nome = 'Meu'`, idMembro(A))).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.convite (lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
           values ($1, $2, 'alvo@exemplo.com', $3, 'Casa', 'X', now(), now() + interval '7 days')`,
          idMembro(A),
          [A.id, A.membro!.membro, randomBytes(32)],
        ),
      ).toBe(NEGADO);
      expect(
        await linhasAfetadas(app, `update app.membro set saiu_em = now() where id = $1`, idMembro(A), [
          A.titular.membro,
        ]),
      ).toBe(0);
    });

    it('o titular renomeia o lar e remove o convidado; o convidado sai pela própria linha', async () => {
      expect(await linhasAfetadas(app, `update app.lar set nome = 'Nosso'`, idTitular(A))).toBe(1);
      expect(
        await linhasAfetadas(
          app,
          `update app.membro set saiu_em = now(), nome = 'Ex-membro' where id = $1`,
          idTitular(A),
          [A.membro!.membro],
        ),
      ).toBe(1);
      expect(
        await linhasAfetadas(app, `update app.membro set saiu_em = now() where id = $1`, idMembro(A), [
          A.membro!.membro,
        ]),
      ).toBe(1);
    });
  });

  describe('limite de 2 membros e um lar por usuário (CA-11.1, CA-11.2, CA-23.6; SDD D-01)', () => {
    let C: Lar;
    const emailConvidado = () => `convidado.${randomBytes(3).toString('hex')}@exemplo.com`;

    beforeAll(async () => {
      C = await montarLar(app, novoUsuario('elis'), null);
    });

    it('membro só entra com convite pendente para o e-mail da sessão naquele lar', async () => {
      const y = novoUsuario('yara');
      await criarUsuario(app, y);
      const entrar = (email: string, lar: string) =>
        codigoDoErro(
          app,
          `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, app.usuario_atual(), 'Y', 'membro')`,
          { usuario: y.id, email },
          [lar],
        );
      expect(await entrar(y.email, C.id)).toBe(NEGADO); // o convite pendente de C é para outro e-mail
      expect(await entrar(A.membro!.usuario.email, A.id)).toBe(NEGADO); // convite de A já aceito
    });

    it('dois aceites simultâneos no mesmo lar: um entra, o outro bate no índice (membro_um_convidado)', async () => {
      const email = emailConvidado();
      await emTransacao(app, idTitular(C), async () => {
        await app.query(`update app.convite set situacao = 'cancelado' where lar_id = $1 and situacao = 'pendente'`, [
          C.id,
        ]);
        await convidar(app, idTitular(C), email);
      });
      const [y, z] = [novoUsuario('yuri'), novoUsuario('zeca')];
      await criarUsuario(app, y);
      await criarUsuario(app, z);

      const c1 = new pg.Client({ connectionString: banco.app });
      const c2 = new pg.Client({ connectionString: banco.app });
      await c1.connect();
      await c2.connect();
      try {
        const inserir = `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, app.usuario_atual(), 'X', 'membro')`;
        await c1.query('begin');
        await definirGuc(c1, { usuario: y.id, email });
        await c1.query(inserir, [C.id]);
        await c2.query('begin');
        await definirGuc(c2, { usuario: z.id, email });
        const segundo = c2.query(inserir, [C.id]).then(
          () => null,
          (e: { code?: string; constraint?: string }) => e,
        );
        await c1.query('commit');
        const erro = await segundo;
        await c2.query('rollback');
        expect(erro).toMatchObject({ code: UNICO, constraint: 'membro_um_convidado' });
      } finally {
        await c1.end();
        await c2.end();
      }
      const membros = await consultar<{ n: number }>(
        app,
        `select count(*)::int as n from app.membro where saiu_em is null`,
        idTitular(C),
      );
      expect(membros).toEqual([{ n: 2 }]);
    });

    it('quem já é membro ativo de um lar não ganha um segundo vínculo ativo (membro_um_lar_ativo)', async () => {
      const outro = await montarLar(app, novoUsuario('fabio'), null);
      const erro = await comCliente(banco.app, async (c) => {
        await c.query('begin');
        try {
          // o titular de A (já ativo em A) tenta ser titular do lar novo dele
          await definirGuc(c, { usuario: A.titular.usuario.id, email: A.titular.usuario.email });
          const l = await c.query<{ id: string }>(
            `insert into app.lar (nome, criado_por) values ('Segundo', app.usuario_atual()) returning id`,
          );
          await c.query(
            `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, app.usuario_atual(), 'Ana', 'titular')`,
            [l.rows[0]!.id],
          );
          return null;
        } catch (e) {
          return e as { code?: string; constraint?: string };
        } finally {
          await c.query('rollback');
        }
      });
      expect(erro).toMatchObject({ code: UNICO, constraint: 'membro_um_lar_ativo' });
      expect(outro.id).not.toBe(A.id);
    });

    it('um só convite pendente por lar (convite_um_pendente)', async () => {
      const erro = await comCliente(banco.app, async (c) => {
        await c.query('begin');
        try {
          await definirGuc(c, idTitular(B)); // o convite de B já foi aceito: nenhum pendente
          await convidar(c, idTitular(B), 'mais@exemplo.com');
          await convidar(c, idTitular(B), 'outro@exemplo.com');
          return null;
        } catch (e) {
          return e as { code?: string; constraint?: string };
        } finally {
          await c.query('rollback');
        }
      });
      expect(erro).toMatchObject({ code: UNICO, constraint: 'convite_um_pendente' });
    });
  });

  describe('referências amarradas ao lar e constraints (G-07, SDD 3.4, 3.5)', () => {
    async function comoOwner(sql: string): Promise<string | null> {
      return comCliente(banco.owner, (c) => codigoDoErro(c, sql));
    }

    it('categoria individual com dono de outro lar é recusada pela FK composta', async () => {
      expect(
        await comoOwner(
          `insert into app.categoria (lar_id, tipo, escopo, dono_id, nome, variavel)
           values ('${B.id}', 'despesa', 'individual', '${A.titular.membro}', 'Cruzada', false)`,
        ),
      ).toBe(FK);
    });

    it('convite com convidado_por de outro lar é recusado pela FK composta', async () => {
      expect(
        await comoOwner(
          `insert into app.convite (lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
           values ('${B.id}', '${A.titular.membro}', 'x@y.z', '\\x${randomBytes(32).toString('hex')}', 'C', 'X', now(), now() + interval '7 days')`,
        ),
      ).toBe(FK);
    });

    it('checks: receita conjunta, nome de categoria com mais de 120, convite fora de 7 dias, papel desconhecido', async () => {
      expect(
        await comoOwner(
          `insert into app.categoria (lar_id, tipo, escopo, nome) values ('${A.id}', 'receita', 'conjunto', 'Salário')`,
        ),
      ).toBe(CHECK);
      expect(
        await comoOwner(
          `insert into app.categoria (lar_id, tipo, escopo, nome, variavel) values ('${A.id}', 'despesa', 'conjunto', '${'x'.repeat(121)}', false)`,
        ),
      ).toBe(CHECK);
      expect(
        await comoOwner(
          `insert into app.convite (lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
           values ('${A.id}', '${A.titular.membro}', 'x@y.z', '\\x${randomBytes(32).toString('hex')}', 'C', 'X', now(), now() + interval '8 days')`,
        ),
      ).toBe(CHECK);
      expect(
        await comoOwner(
          `insert into app.membro (lar_id, usuario_id, nome, papel) values ('${A.id}', null, 'X', 'dono')`,
        ),
      ).toBe(CHECK);
    });
  });

  describe('backup_ro lê tudo pela política backup_leitura, sem BYPASSRLS (SDD 3.7)', () => {
    it.each(TABELAS)('%s: lê as linhas dos dois lares', async (tabela) => {
      const coluna = tabela === 'lar' ? 'id' : 'lar_id';
      const r = await comCliente(banco.backup, (c) =>
        c.query<{ n: number }>(`select count(distinct ${coluna})::int as n from app.${tabela}`),
      );
      expect(r.rows[0]!.n).toBeGreaterThanOrEqual(2);
    });
  });
});
