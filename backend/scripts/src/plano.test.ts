import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  avisarSemBanco,
  codigoDoErro,
  consultar,
  criarBancoDescartavel,
  linhasAfetadas,
  temBanco,
  type BancoDescartavel,
  type Identidade,
} from './apoio-banco-teste';

/**
 * Assinatura e webhook_evento no banco (PLANO etapa 13; SDD 3.3, 3.4, 4; RN-24; G-01, G-04, G-29, G-31, G-50;
 * CA-T1.5). Postgres 18 real, banco descartável, tudo como `controle_app` com a identidade em GUC local, como a API
 * grava. Teste negativo: o lar B não lê nem escreve a assinatura do lar A; o convidado lê, mas não escreve; o
 * `webhook_evento` só existe no contexto de sistema (webhook).
 */
avisarSemBanco();

const NEGADO = '42501';
const CHECK = '23514';
const UNICO = '23505';

interface Pessoa {
  usuario: string;
  email: string;
  membro: string;
}
interface Lar {
  id: string;
  titular: Pessoa;
  convidado: Pessoa;
}

const como = (l: Lar, p: Pessoa): Identidade => ({
  usuario: p.usuario,
  email: p.email,
  lar: l.id,
  membro: p.membro,
  papel: p === l.titular ? 'titular' : 'membro',
});
const SISTEMA = 'webhook';

async function montarLar(c: pg.Client, prefixo: string): Promise<Lar> {
  const larId = randomUUID();
  const pessoa = async (nome: string, papel: 'titular' | 'membro'): Promise<Pessoa> => {
    const email = `${prefixo}.${nome}.${randomBytes(3).toString('hex')}@exemplo.com`;
    const u = await c.query<{ id: string }>(
      `insert into app.usuario (email, nome, senha_hash) values ($1, $2, 'sem-senha') returning id`,
      [email, nome],
    );
    const usuario = u.rows[0]!.id;
    if (papel === 'titular') {
      await c.query(`insert into app.lar (id, nome, criado_por) values ($1, 'Casa', $2)`, [larId, usuario]);
    }
    const m = await c.query<{ id: string }>(
      `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, $2, $3, $4) returning id`,
      [larId, usuario, nome, papel],
    );
    return { usuario, email, membro: m.rows[0]!.id };
  };
  const titular = await pessoa('ana', 'titular');
  const convidado = await pessoa('bruno', 'membro');
  await c.query(
    `insert into app.assinatura (lar_id, situacao, trial_ate, asaas_assinatura_id) values ($1, 'trial', now() + interval '14 days', $2)`,
    [larId, `sub_${prefixo}`],
  );
  return { id: larId, titular, convidado };
}

/** Roda o SQL numa transação descartada como sistema (`app.sistema`), sem usuário nem lar. */
async function comoSistema<T extends pg.QueryResultRow>(c: pg.Client, sql: string, params: unknown[] = []) {
  await c.query('begin');
  try {
    await c.query(`select set_config('app.sistema', $1, true)`, [SISTEMA]);
    return await c.query<T>(sql, params);
  } finally {
    await c.query('rollback');
  }
}

describe.skipIf(!temBanco)('assinatura e webhook_evento (Postgres 18 real, role app)', () => {
  let banco: BancoDescartavel;
  let app: pg.Client;
  let owner: pg.Client;
  let A: Lar;
  let B: Lar;

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_plano');
    app = new pg.Client({ connectionString: banco.app });
    owner = new pg.Client({ connectionString: banco.owner });
    await app.connect();
    await owner.connect();
    A = await montarLar(owner, 'a');
    B = await montarLar(owner, 'b');
    await owner.query(
      `insert into app.webhook_evento (event_id, tipo, asaas_assinatura_id, ocorrido_em) values ('evt_a', 'PAYMENT_RECEIVED', 'sub_a', now())`,
    );
  }, 120_000);

  afterAll(async () => {
    if (!temBanco) return;
    await app?.end();
    await owner?.end();
    await banco?.apagar();
  }, 60_000);

  describe('estrutura (G-01, G-04)', () => {
    it('as 2 tabelas têm ENABLE e FORCE ROW LEVEL SECURITY', async () => {
      const r = await owner.query<{ relname: string; rls: boolean; force: boolean }>(
        `select relname, relrowsecurity as rls, relforcerowsecurity as force from pg_class
          where relnamespace = 'app'::regnamespace and relname in ('assinatura', 'webhook_evento') order by 1`,
      );
      expect(r.rows).toEqual([
        { relname: 'assinatura', rls: true, force: true },
        { relname: 'webhook_evento', rls: true, force: true },
      ]);
    });

    it('app sem DELETE nas duas; UPDATE só nas colunas liberadas', async () => {
      const r = await owner.query<{ t: string; del: boolean }>(
        `select t, has_table_privilege('controle_app', 'app.' || t, 'DELETE') as del
           from unnest(array['assinatura', 'webhook_evento']) t`,
      );
      for (const linha of r.rows) expect(linha.del, linha.t).toBe(false);
      const colunas = await owner.query<{ col: string; pode: boolean }>(
        `select col, has_column_privilege('controle_app', 'app.assinatura', col, 'UPDATE') as pode
           from unnest(array['lar_id', 'criado_em', 'situacao', 'periodo_ate', 'asaas_assinatura_id']) col`,
      );
      expect(Object.fromEntries(colunas.rows.map((x) => [x.col, x.pode]))).toEqual({
        lar_id: false,
        criado_em: false,
        situacao: true,
        periodo_ate: true,
        asaas_assinatura_id: true,
      });
      const ev = await owner.query<{ col: string; pode: boolean }>(
        `select col, has_column_privilege('controle_app', 'app.webhook_evento', col, 'UPDATE') as pode
           from unnest(array['event_id', 'tipo', 'resumo', 'processado_em']) col`,
      );
      expect(Object.fromEntries(ev.rows.map((x) => [x.col, x.pode]))).toEqual({
        event_id: false,
        tipo: false,
        resumo: false,
        processado_em: true,
      });
      expect(
        await owner
          .query<{ pode: boolean }>(
            `select has_column_privilege('controle_app', 'app.usuario', 'trial_usado_em', 'UPDATE') as pode`,
          )
          .then((x) => x.rows[0]?.pode),
      ).toBe(true);
    });

    it('situação fora da lista, cobrança pela metade e id do Asaas repetido são recusados', async () => {
      const id = como(A, A.titular);
      expect(
        await codigoDoErro(app, `update app.assinatura set situacao = 'premium' where lar_id = $1`, id, [A.id]),
      ).toBe(CHECK);
      expect(
        await codigoDoErro(app, `update app.assinatura set cobranca_id = 'pay_1' where lar_id = $1`, id, [A.id]),
      ).toBe(CHECK);
      expect(
        await codigoDoErro(app, `update app.assinatura set asaas_assinatura_id = 'sub_b' where lar_id = $1`, id, [
          A.id,
        ]),
      ).toBe(UNICO);
    });
  });

  describe('isolamento por lar (CA-T1.5; G-31)', () => {
    it('cada membro lê só a assinatura do próprio lar (o convidado também lê: plano e validade)', async () => {
      for (const [lar, pessoa] of [
        [A, A.titular],
        [A, A.convidado],
        [B, B.titular],
      ] as const) {
        const linhas = await consultar<{ lar_id: string }>(app, `select lar_id from app.assinatura`, como(lar, pessoa));
        expect(linhas).toEqual([{ lar_id: lar.id }]);
      }
    });

    it('sem identidade nada aparece', async () => {
      expect(await consultar(app, `select 1 from app.assinatura`, {})).toEqual([]);
    });

    it('o lar B não altera a assinatura do lar A; o convidado não altera nem a do próprio lar', async () => {
      const sql = `update app.assinatura set situacao = 'ativa' where lar_id = $1`;
      expect(await linhasAfetadas(app, sql, como(B, B.titular), [A.id])).toBe(0);
      expect(await linhasAfetadas(app, sql, como(A, A.convidado), [A.id])).toBe(0);
      expect(await linhasAfetadas(app, sql, como(A, A.titular), [A.id])).toBe(1);
    });

    it('ninguém cria assinatura para outro lar; o convidado não cria nem para o próprio', async () => {
      const lar = randomUUID();
      await owner.query(`insert into app.lar (id, nome, criado_por) values ($1, 'Outro', $2)`, [
        lar,
        B.titular.usuario,
      ]);
      const ins = `insert into app.assinatura (lar_id, situacao, trial_ate) values ($1, 'free', now())`;
      expect(await codigoDoErro(app, ins, como(A, A.titular), [lar])).toBe(NEGADO);
      expect(await codigoDoErro(app, ins, como(A, A.convidado), [lar])).toBe(NEGADO);
    });

    it('o sistema (webhook) lê e atualiza qualquer assinatura pelo id do Asaas', async () => {
      const r = await comoSistema<{ lar_id: string }>(
        app,
        `select lar_id from app.assinatura where asaas_assinatura_id = 'sub_b'`,
      );
      expect(r.rows).toEqual([{ lar_id: B.id }]);
      const u = await comoSistema(
        app,
        `update app.assinatura set situacao = 'ativa' where asaas_assinatura_id = 'sub_b'`,
      );
      expect(u.rowCount).toBe(1);
    });
  });

  describe('webhook_evento: só o sistema (G-29, G-50)', () => {
    it('usuário de lar não lê nem grava eventos', async () => {
      expect(await consultar(app, `select 1 from app.webhook_evento`, como(A, A.titular))).toEqual([]);
      expect(
        await codigoDoErro(
          app,
          `insert into app.webhook_evento (event_id, tipo, ocorrido_em) values ('evt_x', 'X', now())`,
          como(A, A.titular),
        ),
      ).toBe(NEGADO);
    });

    it('o sistema lê e grava; o mesmo event_id não entra duas vezes', async () => {
      const r = await comoSistema<{ event_id: string }>(app, `select event_id from app.webhook_evento`);
      expect(r.rows).toEqual([{ event_id: 'evt_a' }]);
      await app.query('begin');
      try {
        await app.query(`select set_config('app.sistema', 'webhook', true)`);
        const ins = await app.query(
          `insert into app.webhook_evento (event_id, tipo, ocorrido_em) values ('evt_a', 'X', now()) on conflict (event_id) do nothing`,
        );
        expect(ins.rowCount).toBe(0);
      } finally {
        await app.query('rollback');
      }
    });

    it('sem DELETE, nem para o sistema', async () => {
      await app.query('begin');
      try {
        await app.query(`select set_config('app.sistema', 'webhook', true)`);
        await expect(app.query(`delete from app.webhook_evento`)).rejects.toMatchObject({ code: NEGADO });
      } finally {
        await app.query('rollback');
      }
    });
  });
});
