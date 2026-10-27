import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  avisarSemBanco,
  codigoDoErro,
  comCliente,
  criarBancoDescartavel,
  temBanco,
  type BancoDescartavel,
} from './apoio-banco-teste';

/**
 * Tabela `exclusao_conta` (etapa 14; SDD 3.3 e 4; RN-26, CA-26.2; G-04, G-49). Postgres 18 real, banco descartável,
 * como `controle_app`: insere e confirma o pedido, mas não apaga nem marca a purga (só o owner, no `purgar.ts`).
 */
avisarSemBanco();

const NEGADO = '42501';
const CHECK = '23514';
const UNICO = '23505';

describe.skipIf(!temBanco)('exclusao_conta (grants e constraints)', () => {
  let banco: BancoDescartavel;

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_exclusao');
  }, 120_000);

  afterAll(async () => {
    await banco?.apagar();
  }, 60_000);

  it('app insere e confirma o pedido com a purga em 30 dias; não apaga nem grava purgada_em', async () => {
    const u = randomUUID();
    await comCliente(banco.app, async (c) => {
      await c.query(`insert into app.exclusao_conta (usuario_id, solicitada_em) values ($1, '2026-10-24T12:00:00Z')`, [
        u,
      ]);
      const r = await c.query(
        `update app.exclusao_conta set confirmada_em = '2026-10-24T12:10:00Z',
                purgar_em = '2026-10-24T12:10:00Z'::timestamptz + interval '30 days' where usuario_id = $1`,
        [u],
      );
      expect(r.rowCount).toBe(1);
      expect(await codigoDoErro(c, `delete from app.exclusao_conta where usuario_id = '${u}'`)).toBe(NEGADO);
      expect(await codigoDoErro(c, `update app.exclusao_conta set purgada_em = now() where usuario_id = '${u}'`)).toBe(
        NEGADO,
      );
      expect(await codigoDoErro(c, `update app.exclusao_conta set usuario_id = gen_random_uuid()`)).toBe(NEGADO);
    });
  });

  it('a purga é exatamente a confirmação + 30 dias, e só existe com a confirmação (CA-26.2)', async () => {
    await comCliente(banco.app, async (c) => {
      const u = randomUUID();
      expect(
        await codigoDoErro(
          c,
          `insert into app.exclusao_conta (usuario_id, solicitada_em, confirmada_em, purgar_em)
           values ('${u}', now(), now(), now() + interval '29 days')`,
        ),
      ).toBe(CHECK);
      expect(
        await codigoDoErro(
          c,
          `insert into app.exclusao_conta (usuario_id, solicitada_em, purgar_em) values ('${u}', now(), now())`,
        ),
      ).toBe(CHECK);
      expect(
        await codigoDoErro(
          c,
          `insert into app.exclusao_conta (usuario_id, solicitada_em, confirmada_em, purgar_em)
           values ('${u}', now(), now() - interval '1 day', now() + interval '29 days')`,
        ),
      ).toBe(CHECK);
    });
  });

  it('um pedido em aberto por usuário; depois de purgado, outro pode existir', async () => {
    const u = randomUUID();
    await comCliente(banco.app, async (c) => {
      await c.query(`insert into app.exclusao_conta (usuario_id) values ($1)`, [u]);
      expect(await codigoDoErro(c, `insert into app.exclusao_conta (usuario_id) values ('${u}')`)).toBe(UNICO);
    });
    await comCliente(banco.owner, (c) =>
      c.query(
        `update app.exclusao_conta set confirmada_em = solicitada_em, purgar_em = solicitada_em + interval '30 days',
                purgada_em = now() where usuario_id = $1`,
        [u],
      ),
    );
    await comCliente(banco.app, (c) => c.query(`insert into app.exclusao_conta (usuario_id) values ($1)`, [u]));
  });
});
