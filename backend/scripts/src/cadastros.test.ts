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
 * Conta, forma de pagamento e movimento de conta no banco (PLANO etapa 7; SDD 3.5, 4; RN-03, RN-12;
 * G-01, G-04, G-08; CA-T1.2, CA-T1.5, CA-03.1, CA-03.2, CA-03.4, CA-03.5). Postgres 18 real, banco descartável.
 * Tudo como `controle_app` (sem BYPASSRLS), com a identidade em GUC local, como a API grava.
 * Teste negativo POR TABELA: o lar B não lê nem escreve nada do lar A, e o membro não vê o individual do outro.
 */
avisarSemBanco();

const NEGADO = '42501'; // insufficient_privilege (grant ausente ou violação de RLS)
const UNICO = '23505';
const FK = '23503';
const CHECK = '23514';
const TABELAS = ['conta', 'forma_pagamento', 'movimento_conta'];

interface Pessoa {
  usuario: string;
  email: string;
  membro: string;
}
interface Lar {
  id: string;
  a: Pessoa;
  b: Pessoa;
  /** Cadastros de cada membro (ids). */
  contaA: string;
  contaB: string;
  formaA: string;
  formaB: string;
  movA: string;
  movB: string;
}

const identidade = (l: Lar, p: Pessoa): Identidade => ({
  usuario: p.usuario,
  email: p.email,
  lar: l.id,
  membro: p.membro,
  papel: p === l.a ? 'titular' : 'membro',
});

/**
 * Monta um lar com 2 membros e os cadastros de cada um direto como owner (superusuário local, fora da RLS):
 * os testes abaixo medem o que a role app enxerga e consegue fazer, não a montagem.
 */
async function montarLar(c: pg.Client, prefixo: string): Promise<Lar> {
  const pessoa = async (nome: string, papel: 'titular' | 'membro', lar: string): Promise<Pessoa> => {
    const email = `${prefixo}.${nome}.${randomBytes(3).toString('hex')}@exemplo.com`;
    const u = await c.query<{ id: string }>(
      `insert into app.usuario (email, nome, senha_hash) values ($1, $2, 'sem-senha') returning id`,
      [email, nome],
    );
    const usuario = u.rows[0]!.id;
    if (papel === 'titular') {
      await c.query(`insert into app.lar (id, nome, criado_por) values ($1, 'Casa', $2)`, [lar, usuario]);
    }
    const m = await c.query<{ id: string }>(
      `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, $2, $3, $4) returning id`,
      [lar, usuario, nome, papel],
    );
    return { usuario, email, membro: m.rows[0]!.id };
  };
  const larId = randomUUID();
  const a = await pessoa('ana', 'titular', larId);
  const b = await pessoa('bruno', 'membro', larId);
  const cadastros = async (p: Pessoa) => {
    const conta = randomUUID();
    const forma = randomUUID();
    await c.query(
      `insert into app.conta (id, lar_id, dono_id, nome, saldo_inicial_centavos) values ($1, $2, $3, 'Itaú', 10000)`,
      [conta, larId, p.membro],
    );
    await c.query(
      `insert into app.forma_pagamento (id, lar_id, dono_id, nome, tipo, conta_id) values ($1, $2, $3, 'Pix', 'pix', $4)`,
      [forma, larId, p.membro, conta],
    );
    const mov = await c.query<{ id: string }>(
      `insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data)
       values ($1, $2, $3, 'ajuste', 'entrada', 500, '2026-10-24') returning id`,
      [larId, p.membro, conta],
    );
    return { conta, forma, mov: mov.rows[0]!.id };
  };
  const ca = await cadastros(a);
  const cb = await cadastros(b);
  return {
    id: larId,
    a,
    b,
    contaA: ca.conta,
    contaB: cb.conta,
    formaA: ca.forma,
    formaB: cb.forma,
    movA: ca.mov,
    movB: cb.mov,
  };
}

describe.skipIf(!temBanco)('conta, forma de pagamento e movimento de conta (Postgres 18 real, role app)', () => {
  let banco: BancoDescartavel;
  let app: pg.Client;
  let owner: pg.Client;
  let A: Lar;
  let B: Lar;

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_cad');
    app = new pg.Client({ connectionString: banco.app });
    owner = new pg.Client({ connectionString: banco.owner });
    await app.connect();
    await owner.connect();
    A = await montarLar(owner, 'a');
    B = await montarLar(owner, 'b');
  }, 120_000);

  afterAll(async () => {
    if (!temBanco) return;
    await app?.end();
    await owner?.end();
    await banco?.apagar();
  }, 60_000);

  describe('estrutura (G-01, G-04, SDD 3.7)', () => {
    it('as 3 tabelas têm ENABLE e FORCE ROW LEVEL SECURITY', async () => {
      const r = await owner.query<{ relname: string; rls: boolean; force: boolean }>(
        `select relname, relrowsecurity as rls, relforcerowsecurity as force from pg_class
          where relnamespace = 'app'::regnamespace and relname = any($1) order by 1`,
        [TABELAS],
      );
      expect(r.rows).toEqual(TABELAS.map((relname) => ({ relname, rls: true, force: true })));
    });

    it('cada comando concedido à app tem política para controle_app, e nenhuma é using/with check (true)', async () => {
      const politicas = await owner.query<{
        tablename: string;
        cmd: string;
        qual: string | null;
        with_check: string | null;
      }>(
        `select tablename, cmd, qual, with_check from pg_policies
          where schemaname = 'app' and tablename = any($1) and 'controle_app' = any(roles)`,
        [TABELAS],
      );
      const comandos = (t: string) =>
        politicas.rows
          .filter((p) => p.tablename === t)
          .map((p) => p.cmd)
          .sort();
      expect(comandos('conta')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
      expect(comandos('forma_pagamento')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
      expect(comandos('movimento_conta')).toEqual(['INSERT', 'SELECT']);
      for (const p of politicas.rows) {
        expect(p.qual, `${p.tablename} ${p.cmd}`).not.toBe('true');
        expect(p.with_check, `${p.tablename} ${p.cmd}`).not.toBe('true');
      }
      const backup = await owner.query<{ tablename: string }>(
        `select tablename from pg_policies
          where schemaname = 'app' and tablename = any($1) and policyname = 'backup_leitura'
            and roles = '{controle_backup_ro}' and cmd = 'SELECT' order by 1`,
        [TABELAS],
      );
      expect(backup.rows.map((x) => x.tablename)).toEqual(TABELAS);
    });
  });

  describe('grants: a app não apaga o movimento, não o altera e não muda chave, dono, lar nem tipo (SDD 4, G-08)', () => {
    it.each([
      ['DELETE em movimento_conta', 'delete from app.movimento_conta'],
      ['UPDATE em movimento_conta', 'update app.movimento_conta set valor_centavos = 1'],
      ['TRUNCATE conta', 'truncate app.conta'],
      ['UPDATE conta.dono_id', 'update app.conta set dono_id = dono_id'],
      ['UPDATE conta.lar_id', 'update app.conta set lar_id = lar_id'],
      ['UPDATE conta.id', 'update app.conta set id = id'],
      ['UPDATE forma_pagamento.tipo', `update app.forma_pagamento set tipo = 'pix'`],
      ['UPDATE forma_pagamento.dono_id', 'update app.forma_pagamento set dono_id = dono_id'],
      ['UPDATE forma_pagamento.lar_id', 'update app.forma_pagamento set lar_id = lar_id'],
      ['ALTER TABLE conta', 'alter table app.conta disable row level security'],
      ['DROP POLICY', 'drop policy conta_select on app.conta'],
    ])('recusa %s com permissão negada', async (_nome, sql) => {
      expect(await codigoDoErro(app, sql, identidade(A, A.a))).toBe(NEGADO);
    });
  });

  describe('sem GUC (ou GUC vazio), nenhuma linha (G-02)', () => {
    it.each(TABELAS)('%s: 0 linhas', async (tabela) => {
      const r = await consultar<{ n: number }>(app, `select count(*)::int as n from app.${tabela}`, {});
      expect(r).toEqual([{ n: 0 }]);
    });
  });

  describe('lar B × lar A, por tabela (CA-T1.1, CA-T1.5, R3)', () => {
    const idB = () => identidade(B, B.a);

    it('conta: B não lê, altera, apaga nem cria conta no lar A', async () => {
      expect(await consultar(app, `select * from app.conta where lar_id = $1`, idB(), [A.id])).toEqual([]);
      expect(await linhasAfetadas(app, `update app.conta set nome = 'X' where lar_id = $1`, idB(), [A.id])).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.conta where lar_id = $1`, idB(), [A.id])).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.conta (id, lar_id, dono_id, nome) values ($1, $2, $3, 'Intrusa')`,
          idB(),
          [randomUUID(), A.id, A.a.membro],
        ),
      ).toBe(NEGADO);
    });

    it('forma_pagamento: B não lê, altera, apaga nem cria forma no lar A (nem aponta para a conta de A)', async () => {
      expect(await consultar(app, `select * from app.forma_pagamento where lar_id = $1`, idB(), [A.id])).toEqual([]);
      expect(
        await linhasAfetadas(app, `update app.forma_pagamento set nome = 'X' where lar_id = $1`, idB(), [A.id]),
      ).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.forma_pagamento where lar_id = $1`, idB(), [A.id])).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.forma_pagamento (id, lar_id, dono_id, nome, tipo, conta_id) values ($1, $2, $3, 'Intrusa', 'pix', $4)`,
          idB(),
          [randomUUID(), A.id, A.a.membro, A.contaA],
        ),
      ).toBe(NEGADO);
    });

    it('movimento_conta: B não lê nem cria movimento no lar A', async () => {
      expect(await consultar(app, `select * from app.movimento_conta where lar_id = $1`, idB(), [A.id])).toEqual([]);
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data)
           values ($1, $2, $3, 'ajuste', 'entrada', 1, '2026-10-24')`,
          idB(),
          [A.id, A.a.membro, A.contaA],
        ),
      ).toBe(NEGADO);
    });

    it('as contagens de B não mudam com os dados de A (nada de A entra em total)', async () => {
      const contar = (t: string) => consultar<{ n: number }>(app, `select count(*)::int as n from app.${t}`, idB());
      for (const t of TABELAS) expect(await contar(t), t).toEqual([{ n: 1 }]);
    });
  });

  describe('membro × individual do outro membro (CA-T1.2, RN-02)', () => {
    it.each(TABELAS)('%s: cada membro vê só as próprias linhas, nunca as do outro', async (tabela) => {
      const donos = (p: Pessoa) =>
        consultar<{ dono_id: string }>(app, `select dono_id from app.${tabela}`, identidade(A, p));
      expect(await donos(A.a)).toEqual([{ dono_id: A.a.membro }]);
      expect(await donos(A.b)).toEqual([{ dono_id: A.b.membro }]);
    });

    it('o membro não altera, não apaga nem cria conta, forma ou movimento em nome do outro', async () => {
      const outro = A.a.membro;
      const eu = identidade(A, A.b);
      expect(await linhasAfetadas(app, `update app.conta set nome = 'X' where dono_id = $1`, eu, [outro])).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.conta where dono_id = $1`, eu, [outro])).toBe(0);
      expect(
        await linhasAfetadas(app, `update app.forma_pagamento set nome = 'X' where dono_id = $1`, eu, [outro]),
      ).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.forma_pagamento where dono_id = $1`, eu, [outro])).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.conta (id, lar_id, dono_id, nome) values ($1, $2, $3, 'Plantada')`,
          eu,
          [randomUUID(), A.id, outro],
        ),
      ).toBe(NEGADO);
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data)
           values ($1, $2, $3, 'ajuste', 'entrada', 1, '2026-10-24')`,
          eu,
          [A.id, outro, A.contaA],
        ),
      ).toBe(NEGADO);
    });

    it('uma forma minha não pode apontar para a conta do outro membro (FK composta por dono)', async () => {
      const codigo = await codigoDoErro(
        app,
        `insert into app.forma_pagamento (id, dono_id, nome, tipo, conta_id) values ($1, app.membro_atual(), 'X', 'pix', $2)`,
        identidade(A, A.b),
        [randomUUID(), A.contaA],
      );
      // A conta do outro é invisível; o FK, porém, é checado sem RLS: recusa de qualquer forma.
      expect(codigo).toBe(FK);
    });

    it('um movimento meu não pode usar a conta nem a forma de crédito do outro (FK composta por dono)', async () => {
      const eu = identidade(A, A.b);
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (dono_id, conta_id, tipo, sentido, valor_centavos, data)
           values (app.membro_atual(), $1, 'ajuste', 'entrada', 1, '2026-10-24')`,
          eu,
          [A.contaA],
        ),
      ).toBe(FK);
    });
  });

  describe('checks (RN-03, RN-18)', () => {
    const eu = () => identidade(A, A.a);
    const forma = (campos: string, valores: unknown[]) =>
      codigoDoErro(
        app,
        `insert into app.forma_pagamento (id, dono_id, nome, ${campos}) values ($1, app.membro_atual(), 'F', ${valores
          .map((_, i) => `$${i + 2}`)
          .join(', ')})`,
        eu(),
        [randomUUID(), ...valores],
      );

    it('CA-03.1: Pix e Débito sem conta são recusados; com dia também', async () => {
      expect(await forma('tipo', ['pix'])).toBe(CHECK);
      expect(await forma('tipo', ['debito'])).toBe(CHECK);
      expect(await forma('tipo, conta_id, dia_vencimento', ['pix', A.contaA, 10])).toBe(CHECK);
      expect(await forma('tipo, conta_id', ['pix', A.contaA])).toBeNull();
      expect(await forma('tipo, conta_id', ['debito', A.contaA])).toBeNull();
    });

    it('CA-03.2: Crédito sem dia ou com dia fora de 1 a 31 é recusado; a conta é opcional', async () => {
      expect(await forma('tipo', ['credito'])).toBe(CHECK);
      expect(await forma('tipo, dia_vencimento', ['credito', 0])).toBe(CHECK);
      expect(await forma('tipo, dia_vencimento', ['credito', 32])).toBe(CHECK);
      expect(await forma('tipo, dia_vencimento', ['credito', 1])).toBeNull();
      expect(await forma('tipo, dia_vencimento', ['credito', 31])).toBeNull();
      expect(await forma('tipo, dia_vencimento, conta_id', ['credito', 10, A.contaA])).toBeNull();
    });

    it('tipo desconhecido e nome vazio ou acima de 120 caracteres são recusados', async () => {
      expect(await forma('tipo, conta_id', ['boleto', A.contaA])).toBe(CHECK);
      const nome = (n: string) =>
        codigoDoErro(
          app,
          `insert into app.forma_pagamento (id, dono_id, nome, tipo, conta_id) values ($1, app.membro_atual(), $2, 'pix', $3)`,
          eu(),
          [randomUUID(), n, A.contaA],
        );
      expect(await nome('   ')).toBe(CHECK);
      expect(await nome('a'.repeat(121))).toBe(CHECK);
      expect(await nome('a'.repeat(120))).toBeNull();
    });

    it('conta: nome de 1 a 80 caracteres e saldo inicial de −10^11 a 10^11 (pode ser negativo)', async () => {
      const conta = (nome: string, saldo: number) =>
        codigoDoErro(
          app,
          `insert into app.conta (id, dono_id, nome, saldo_inicial_centavos) values ($1, app.membro_atual(), $2, $3)`,
          eu(),
          [randomUUID(), nome, saldo],
        );
      expect(await conta('', 0)).toBe(CHECK);
      expect(await conta('a'.repeat(81), 0)).toBe(CHECK);
      expect(await conta('a'.repeat(80), 0)).toBeNull();
      expect(await conta('x', -5000)).toBeNull();
      expect(await conta('x', 100_000_000_000)).toBeNull();
      expect(await conta('x', -100_000_000_000)).toBeNull();
      expect(await conta('x', 100_000_000_001)).toBe(CHECK);
      expect(await conta('x', -100_000_000_001)).toBe(CHECK);
    });

    it('movimento: valor positivo, sentido e tipo válidos, forma de crédito só no pagamento de cartão', async () => {
      const mov = (campos: string, valores: unknown[]) =>
        codigoDoErro(
          app,
          `insert into app.movimento_conta (dono_id, conta_id, data, ${campos}) values (app.membro_atual(), $1, '2026-10-24', ${valores
            .map((_, i) => `$${i + 2}`)
            .join(', ')})`,
          eu(),
          [A.contaA, ...valores],
        );
      expect(await mov('tipo, sentido, valor_centavos', ['ajuste', 'entrada', 0])).toBe(CHECK);
      expect(await mov('tipo, sentido, valor_centavos', ['ajuste', 'entrada', -1])).toBe(CHECK);
      expect(await mov('tipo, sentido, valor_centavos', ['ajuste', 'lateral', 1])).toBe(CHECK);
      expect(await mov('tipo, sentido, valor_centavos', ['deposito', 'entrada', 1])).toBe(CHECK);
      expect(await mov('tipo, sentido, valor_centavos', ['pagamento_cartao', 'saida', 1])).toBe(CHECK);
      expect(await mov('tipo, sentido, valor_centavos, forma_credito_id', ['ajuste', 'saida', 1, A.formaA])).toBe(
        CHECK,
      );
      expect(await mov('tipo, sentido, valor_centavos', ['ajuste', 'saida', 1])).toBeNull();
    });
  });

  describe('uma preferida por dono (CA-03.4)', () => {
    it('duas preferidas do mesmo dono batem no índice; a do outro membro convive', async () => {
      const eu = identidade(A, A.a);
      const outra = randomUUID();
      await owner.query(
        `insert into app.forma_pagamento (id, lar_id, dono_id, nome, tipo, conta_id, preferida)
         values ($1, $2, $3, 'Outra', 'pix', $4, false)`,
        [outra, A.id, A.a.membro, A.contaA],
      );
      expect(
        await linhasAfetadas(app, `update app.forma_pagamento set preferida = true where id = $1`, eu, [A.formaA]),
      ).toBe(1);
      // duas preferidas na mesma transação: a segunda viola o índice
      await app.query('begin');
      try {
        await app.query(`select set_config('app.membro_id', $1, true), set_config('app.lar_id', $2, true)`, [
          A.a.membro,
          A.id,
        ]);
        await app.query(`update app.forma_pagamento set preferida = true where id = $1`, [A.formaA]);
        const erro = await app
          .query(`update app.forma_pagamento set preferida = true where id = $1`, [outra])
          .catch((e: { code?: string }) => e.code);
        expect(erro).toBe(UNICO);
      } finally {
        await app.query('rollback');
      }
      // o outro membro tem a própria preferida sem conflito
      expect(
        await linhasAfetadas(app, `update app.forma_pagamento set preferida = true where id = $1`, identidade(A, A.b), [
          A.formaB,
        ]),
      ).toBe(1);
    });
  });

  describe('excluir com vínculo (CA-03.5)', () => {
    it('conta com forma ou com movimento é recusada pela FK; sem vínculo, é apagada', async () => {
      const eu = identidade(A, A.a);
      expect(await codigoDoErro(app, `delete from app.conta where id = $1`, eu, [A.contaA])).toBe(FK);
      const livre = randomUUID();
      await owner.query(`insert into app.conta (id, lar_id, dono_id, nome) values ($1, $2, $3, 'Livre')`, [
        livre,
        A.id,
        A.a.membro,
      ]);
      expect(await linhasAfetadas(app, `delete from app.conta where id = $1`, eu, [livre])).toBe(1);
      // com movimento mas sem forma
      const comMov = randomUUID();
      await owner.query(`insert into app.conta (id, lar_id, dono_id, nome) values ($1, $2, $3, 'ComMov')`, [
        comMov,
        A.id,
        A.a.membro,
      ]);
      await owner.query(
        `insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data)
         values ($1, $2, $3, 'ajuste', 'saida', 5, '2026-10-24')`,
        [A.id, A.a.membro, comMov],
      );
      expect(await codigoDoErro(app, `delete from app.conta where id = $1`, eu, [comMov])).toBe(FK);
    });

    it('forma ligada a pagamento de cartão é recusada pela FK', async () => {
      const cartao = randomUUID();
      await owner.query(
        `insert into app.forma_pagamento (id, lar_id, dono_id, nome, tipo, dia_vencimento) values ($1, $2, $3, 'Cartão', 'credito', 10)`,
        [cartao, A.id, A.a.membro],
      );
      await owner.query(
        `insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data, forma_credito_id)
         values ($1, $2, $3, 'pagamento_cartao', 'saida', 100, '2026-10-24', $4)`,
        [A.id, A.a.membro, A.contaA, cartao],
      );
      expect(
        await codigoDoErro(app, `delete from app.forma_pagamento where id = $1`, identidade(A, A.a), [cartao]),
      ).toBe(FK);
    });
  });

  describe('o dono pertence ao lar da linha (FK composta, SDD 3.1)', () => {
    it('conta com dono de outro lar é recusada mesmo com o GUC do dono', async () => {
      // owner (sem RLS): a FK (dono_id, lar_id) → membro (id, lar_id) é a rede de segurança
      const codigo = await owner
        .query(`insert into app.conta (id, lar_id, dono_id, nome) values ($1, $2, $3, 'X')`, [
          randomUUID(),
          B.id,
          A.a.membro,
        ])
        .catch((e: { code?: string }) => e.code);
      expect(codigo).toBe(FK);
    });
  });
});
