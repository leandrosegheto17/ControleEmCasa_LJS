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
 * Tabelas do push no banco (etapa 15; SDD 3.6, 4; RN-27; CA-27.4, CA-27.5, CA-27.6; G-01, G-04; TM-PUSH-01,
 * TM-PUSH-04; ADR-014). Postgres 17 real, banco descartável, como `controle_app` com a identidade em GUC local.
 * Teste negativo: um usuário nunca vê nem mexe na inscrição ou na preferência de outro (do mesmo lar ou de outro lar);
 * o "já avisado" só existe para o cron; o cron (e só ele) lê inscrições de todos e marca convite vencido.
 */
avisarSemBanco();

const NEGADO = '42501';
const CHECK = '23514';
const UNICO = '23505';
const RLS = '42501';

interface Pessoa {
  usuario: string;
  email: string;
  membro: string;
}
interface Lar {
  id: string;
  a: Pessoa;
  b: Pessoa;
}

const P256DH = () => 'B' + randomBytes(64).toString('base64url').slice(0, 86);
const AUTH = () => randomBytes(16).toString('base64url');
const endpoint = () => `https://fcm.googleapis.com/fcm/send/${randomBytes(12).toString('hex')}`;

const id = (l: Lar, p: Pessoa): Identidade => ({
  usuario: p.usuario,
  email: p.email,
  lar: l.id,
  membro: p.membro,
  papel: p === l.a ? 'titular' : 'membro',
});

describe.skipIf(!temBanco)('push_subscription, preferencia_notificacao e aviso_push (RLS e grants)', () => {
  let banco: BancoDescartavel;
  let app: pg.Client;
  let su: pg.Client;
  let l1: Lar;
  let l2: Lar;

  async function montarLar(prefixo: string): Promise<Lar> {
    const larId = randomUUID();
    const pessoa = async (nome: string, papel: 'titular' | 'membro'): Promise<Pessoa> => {
      const email = `${prefixo}.${nome}.${randomBytes(3).toString('hex')}@exemplo.com`;
      const u = await su.query<{ id: string }>(
        `insert into app.usuario (email, nome, senha_hash) values ($1, $2, 'x') returning id`,
        [email, nome],
      );
      if (papel === 'titular') {
        await su.query(`insert into app.lar (id, nome, criado_por) values ($1, 'Casa', $2)`, [larId, u.rows[0]!.id]);
      }
      const m = await su.query<{ id: string }>(
        `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, $2, $3, $4) returning id`,
        [larId, u.rows[0]!.id, nome, papel],
      );
      return { usuario: u.rows[0]!.id, email, membro: m.rows[0]!.id };
    };
    const a = await pessoa('ana', 'titular');
    const b = await pessoa('bruno', 'membro');
    return { id: larId, a, b };
  }

  /** Inscrição gravada direto (superusuário), como a API grava. */
  async function inscricao(l: Lar, p: Pessoa, e = endpoint()): Promise<string> {
    await su.query(
      `insert into app.push_subscription (usuario_id, lar_id, membro_id, endpoint, p256dh, auth)
       values ($1, $2, $3, $4, $5, $6)`,
      [p.usuario, l.id, p.membro, e, P256DH(), AUTH()],
    );
    return e;
  }

  /** Roda o SQL numa transação descartada no contexto do cron (com o lar fixado, se dado). */
  async function comoCron<T extends pg.QueryResultRow>(sql: string, params: unknown[] = [], lar = ''): Promise<T[]> {
    await app.query('begin');
    try {
      await app.query(`select set_config('app.sistema', 'cron', true), set_config('app.lar_id', $1, true)`, [lar]);
      return (await app.query<T>(sql, params)).rows;
    } finally {
      await app.query('rollback');
    }
  }

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_push');
    app = new pg.Client({ connectionString: banco.app });
    su = new pg.Client({ connectionString: banco.owner });
    await app.connect();
    await su.connect();
    l1 = await montarLar('l1');
    l2 = await montarLar('l2');
  }, 120_000);

  afterAll(async () => {
    await app?.end();
    await su?.end();
    await banco?.apagar();
  }, 60_000);

  describe('push_subscription', () => {
    it('o usuário insere a própria inscrição no vínculo atual; não insere para outro membro, lar ou usuário', async () => {
      const ok = await linhasAfetadas(
        app,
        `insert into app.push_subscription (endpoint, p256dh, auth) values ($1, $2, $3)`,
        id(l1, l1.a),
        [endpoint(), P256DH(), AUTH()],
      );
      expect(ok).toBe(1);
      for (const [campo, valor] of [
        ['membro_id', l1.b.membro],
        ['usuario_id', l1.b.usuario],
        ['lar_id', l2.id],
      ] as const) {
        expect(
          await codigoDoErro(
            app,
            `insert into app.push_subscription (endpoint, p256dh, auth, ${campo}) values ($1, $2, $3, $4)`,
            id(l1, l1.a),
            [endpoint(), P256DH(), AUTH(), valor],
          ),
          campo,
        ).not.toBeNull();
      }
      // Sem vínculo (sem lar): não há como inscrever.
      expect(
        await codigoDoErro(
          app,
          `insert into app.push_subscription (endpoint, p256dh, auth) values ($1, $2, $3)`,
          { usuario: l1.a.usuario, email: l1.a.email },
          [endpoint(), P256DH(), AUTH()],
        ),
      ).not.toBeNull();
    });

    it('membro do mesmo lar e usuário de outro lar não veem nem apagam a inscrição de A (TM-PUSH-04)', async () => {
      const e = await inscricao(l1, l1.a);
      const ver = `select count(*)::int as n from app.push_subscription where endpoint = $1`;
      expect((await consultar<{ n: number }>(app, ver, id(l1, l1.a), [e]))[0]!.n).toBe(1);
      expect((await consultar<{ n: number }>(app, ver, id(l1, l1.b), [e]))[0]!.n).toBe(0);
      expect((await consultar<{ n: number }>(app, ver, id(l2, l2.a), [e]))[0]!.n).toBe(0);
      expect((await consultar<{ n: number }>(app, ver, {}, [e]))[0]!.n).toBe(0);
      const apagar = `delete from app.push_subscription where endpoint = $1`;
      expect(await linhasAfetadas(app, apagar, id(l1, l1.b), [e])).toBe(0);
      expect(await linhasAfetadas(app, apagar, id(l2, l2.a), [e])).toBe(0);
      expect(await linhasAfetadas(app, apagar, id(l1, l1.a), [e])).toBe(1);
    });

    it('com o GUC do endpoint (só a rota de inscrição o grava), o aparelho trocado de dono é visível e removível', async () => {
      const e = await inscricao(l1, l1.a);
      await app.query('begin');
      try {
        await app.query(
          `select set_config('app.usuario_id', $1, true), set_config('app.lar_id', $2, true),
                  set_config('app.membro_id', $3, true), set_config('app.push_endpoint', $4, true)`,
          [l2.a.usuario, l2.id, l2.a.membro, e],
        );
        expect((await app.query(`delete from app.push_subscription where endpoint = $1`, [e])).rowCount).toBe(1);
        // Outro endpoint de A continua invisível.
        const outro = await inscricao(l1, l1.a);
        expect((await app.query(`select 1 from app.push_subscription where endpoint = $1`, [outro])).rowCount).toBe(0);
      } finally {
        await app.query('rollback');
      }
      // Sem usuário na sessão, o GUC do endpoint não basta.
      await app.query('begin');
      try {
        await app.query(`select set_config('app.push_endpoint', $1, true)`, [e]);
        expect((await app.query(`select 1 from app.push_subscription where endpoint = $1`, [e])).rowCount).toBe(0);
      } finally {
        await app.query('rollback');
      }
    });

    it('o usuário não atualiza nada (nem as chaves); só o cron atualiza envio e falhas', async () => {
      const e = await inscricao(l1, l1.a);
      expect(
        await codigoDoErro(app, `update app.push_subscription set p256dh = p256dh where endpoint = $1`, id(l1, l1.a), [
          e,
        ]),
      ).toBe(NEGADO);
      expect(
        await linhasAfetadas(app, `update app.push_subscription set falhas = 1 where endpoint = $1`, id(l1, l1.a), [e]),
      ).toBe(0);
      const r = await comoCron<{ falhas: number }>(
        `update app.push_subscription set falhas = 1, ultimo_envio_em = now() where endpoint = $1 returning falhas`,
        [e],
      );
      expect(r).toEqual([{ falhas: 1 }]);
    });

    it('o cron lê as inscrições de todos os lares e apaga; o webhook (outro sistema) não', async () => {
      const e1 = await inscricao(l1, l1.b);
      const e2 = await inscricao(l2, l2.b);
      const r = await comoCron<{ endpoint: string }>(
        `select endpoint from app.push_subscription where endpoint = any($1)`,
        [[e1, e2]],
      );
      expect(r.map((x) => x.endpoint).sort()).toEqual([e1, e2].sort());
      await app.query('begin');
      try {
        await app.query(`select set_config('app.sistema', 'webhook', true)`);
        expect(
          (await app.query(`select 1 from app.push_subscription where endpoint = any($1)`, [[e1, e2]])).rowCount,
        ).toBe(0);
      } finally {
        await app.query('rollback');
      }
    });

    it('formato: endpoint https até 1024 e único, chaves base64url do tamanho certo, falhas de 0 a 5', async () => {
      const base = [l1.a.usuario, l1.id, l1.a.membro];
      const inserir = (e: string, p: string, a: string, falhas = 0) =>
        su.query(
          `insert into app.push_subscription (usuario_id, lar_id, membro_id, endpoint, p256dh, auth, falhas)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [...base, e, p, a, falhas],
        );
      const erro = async (p: Promise<unknown>) => {
        try {
          await p;
          return null;
        } catch (e) {
          return (e as { code?: string }).code;
        }
      };
      expect(await erro(inserir('http://fcm.googleapis.com/x', P256DH(), AUTH()))).toBe(CHECK);
      expect(await erro(inserir(`https://fcm.googleapis.com/${'x'.repeat(1024)}`, P256DH(), AUTH()))).toBe(CHECK);
      expect(await erro(inserir(endpoint(), 'curta', AUTH()))).toBe(CHECK);
      expect(await erro(inserir(endpoint(), P256DH(), 'a/b+'))).toBe(CHECK);
      expect(await erro(inserir(endpoint(), P256DH(), AUTH(), 6))).toBe(CHECK);
      const e = endpoint();
      expect(await erro(inserir(e, P256DH(), AUTH()))).toBeNull();
      expect(await erro(inserir(e, P256DH(), AUTH()))).toBe(UNICO);
    });

    it('apagar o usuário apaga as inscrições dele em cascata (purga; G-49)', async () => {
      const l = await montarLar('cascata');
      const e = await inscricao(l, l.b);
      await su.query(`update app.membro set saiu_em = now() where id = $1`, [l.b.membro]);
      await su.query(`delete from app.usuario where id = $1`, [l.b.usuario]);
      expect((await su.query(`select 1 from app.push_subscription where endpoint = $1`, [e])).rowCount).toBe(0);
    });
  });

  describe('preferencia_notificacao', () => {
    it('cada membro grava e lê só a própria; o outro membro e outro lar não veem; sem delete', async () => {
      const gravar = `insert into app.preferencia_notificacao (fixas, lembrete_diario, lembrete_hora, metas)
                      values (false, true, 7, false)`;
      await app.query('begin');
      try {
        await app.query(
          `select set_config('app.usuario_id', $1, true), set_config('app.lar_id', $2, true),
                  set_config('app.membro_id', $3, true)`,
          [l1.a.usuario, l1.id, l1.a.membro],
        );
        await app.query(gravar);
        await app.query('commit');
      } catch (e) {
        await app.query('rollback');
        throw e;
      }
      const ler = `select membro_id::text as membro_id, lembrete_hora from app.preferencia_notificacao`;
      expect(await consultar(app, ler, id(l1, l1.a))).toEqual([{ membro_id: l1.a.membro, lembrete_hora: 7 }]);
      expect(await consultar(app, ler, id(l1, l1.b))).toEqual([]);
      expect(await consultar(app, ler, id(l2, l2.a))).toEqual([]);
      expect(await linhasAfetadas(app, `update app.preferencia_notificacao set metas = true`, id(l1, l1.b))).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.preferencia_notificacao (membro_id, lar_id) values ($1, $2)`,
          id(l1, l1.b),
          [l1.a.membro, l1.id],
        ),
      ).not.toBeNull();
      expect(await codigoDoErro(app, `delete from app.preferencia_notificacao`, id(l1, l1.a))).toBe(NEGADO);
      // A hora vai de 0 a 23.
      expect(await codigoDoErro(app, `update app.preferencia_notificacao set lembrete_hora = 24`, id(l1, l1.a))).toBe(
        CHECK,
      );
      // O cron lê a de todos.
      const r = await comoCron<{ membro_id: string }>(
        `select membro_id::text as membro_id from app.preferencia_notificacao where membro_id = $1`,
        [l1.a.membro],
      );
      expect(r).toHaveLength(1);
    });
  });

  describe('aviso_push (CA-27.4)', () => {
    it('só o cron grava e lê; a segunda marca do mesmo (membro, tipo, referência, dia) não entra', async () => {
      const marcar = `insert into app.aviso_push (membro_id, lar_id, tipo, referencia, dia)
                      values ($1, $2, 'fixa_vencendo', '', '2026-10-26') on conflict do nothing`;
      expect(await codigoDoErro(app, marcar, id(l1, l1.a), [l1.a.membro, l1.id])).toBe(RLS);
      await app.query('begin');
      try {
        await app.query(`select set_config('app.sistema', 'cron', true)`);
        expect((await app.query(marcar, [l1.a.membro, l1.id])).rowCount).toBe(1);
        expect((await app.query(marcar, [l1.a.membro, l1.id])).rowCount).toBe(0);
        // Outro dia, outro tipo ou outro membro: entra.
        expect(
          (
            await app.query(
              `insert into app.aviso_push (membro_id, lar_id, tipo, referencia, dia)
               values ($1, $2, 'fixa_vencendo', '', '2026-10-27'), ($1, $2, 'fixa_atrasada', '', '2026-10-26'),
                      ($3, $2, 'fixa_vencendo', '', '2026-10-26')`,
              [l1.a.membro, l1.id, l1.b.membro],
            )
          ).rowCount,
        ).toBe(3);
        expect(
          await app
            .query(`insert into app.aviso_push (membro_id, lar_id, tipo, dia) values ($1, $2, 'outro', '2026-10-26')`, [
              l1.a.membro,
              l1.id,
            ])
            .then(() => null)
            .catch((e: { code?: string }) => e.code),
        ).toBe(CHECK);
        await app.query('commit');
      } catch (e) {
        await app.query('rollback');
        throw e;
      }
      expect(
        await consultar(app, `select 1 from app.aviso_push where membro_id = $1`, id(l1, l1.a), [l1.a.membro]),
      ).toEqual([]);
    });
  });

  describe('convite vencido (limpeza do cron)', () => {
    it('o cron só passa pendente para expirado; o usuário sem vínculo não toca', async () => {
      const convite = randomUUID();
      await su.query(
        `insert into app.convite (id, lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
         values ($1, $2, $3, 'x@exemplo.com', $4, 'Casa', 'Ana', now() - interval '8 days', now() - interval '1 day')`,
        [convite, l2.id, l2.a.membro, randomBytes(32)],
      );
      expect(
        await comoCron(`update app.convite set situacao = 'aceito' where id = $1 returning id`, [convite]).catch(
          (e: { code?: string }) => e.code,
        ),
      ).toBe(RLS);
      expect(
        await comoCron(`update app.convite set situacao = 'expirado' where id = $1 returning id`, [convite]),
      ).toHaveLength(1);
      expect(
        await linhasAfetadas(app, `update app.convite set situacao = 'expirado' where id = $1`, {}, [convite]),
      ).toBe(0);
    });
  });

  describe('catálogo', () => {
    it('a app não tem DELETE em preferencia_notificacao e só atualiza envio/falhas da inscrição', async () => {
      const r = await su.query<{ t: string; del: boolean; upd_chave: boolean; upd_falhas: boolean }>(
        `select 'push_subscription' as t,
                has_table_privilege('controle_app', 'app.push_subscription', 'DELETE') as del,
                has_column_privilege('controle_app', 'app.push_subscription', 'p256dh', 'UPDATE') as upd_chave,
                has_column_privilege('controle_app', 'app.push_subscription', 'falhas', 'UPDATE') as upd_falhas
         union all
         select 'preferencia_notificacao',
                has_table_privilege('controle_app', 'app.preferencia_notificacao', 'DELETE'),
                has_column_privilege('controle_app', 'app.preferencia_notificacao', 'membro_id', 'UPDATE'),
                has_column_privilege('controle_app', 'app.preferencia_notificacao', 'lembrete_hora', 'UPDATE')`,
      );
      expect(r.rows).toEqual([
        { t: 'push_subscription', del: true, upd_chave: false, upd_falhas: true },
        { t: 'preferencia_notificacao', del: false, upd_chave: false, upd_falhas: true },
      ]);
    });
  });
});
