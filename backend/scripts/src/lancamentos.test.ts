import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  avisarSemBanco,
  codigoDoErro,
  consultar,
  criarBancoDescartavel,
  emTransacao,
  linhasAfetadas,
  temBanco,
  type BancoDescartavel,
  type Identidade,
} from './apoio-banco-teste';

/**
 * Lançamento, parte privada do pagamento e parcela no banco (PLANO etapa 8; SDD 3.5, 4; RN-01, RN-04, RN-06,
 * RN-07, RN-14; G-01, G-04, G-10; CA-T1.1, CA-T1.2, CA-T1.5, CA-06.8). Postgres 17 real, banco descartável,
 * tudo como `controle_app` com a identidade em GUC local, como a API grava.
 * Teste negativo POR TABELA: o lar B não lê nem escreve nada do lar A; o membro não vê o individual do outro
 * nem a parte privada (`lancamento_pagamento`) da conjunta que o outro pagou.
 */
avisarSemBanco();

const NEGADO = '42501';
const FK = '23503';
const CHECK = '23514';
const TABELAS = ['lancamento', 'lancamento_pagamento', 'parcela'];

interface Pessoa {
  usuario: string;
  email: string;
  membro: string;
}
interface Lar {
  id: string;
  a: Pessoa;
  b: Pessoa;
  catConjunta: string;
  catIndA: string;
  catIndB: string;
  catReceitaA: string;
  contaA: string;
  formaA: string;
  formaB: string;
  /** Conjunta paga por A no Pix, individual de A, conjunta paga por B. */
  conjA: string;
  indA: string;
  conjB: string;
}

const identidade = (l: Lar, p: Pessoa): Identidade => ({
  usuario: p.usuario,
  email: p.email,
  lar: l.id,
  membro: p.membro,
  papel: p === l.a ? 'titular' : 'membro',
});

/** Monta o lar como owner (fora da RLS): os testes medem o que a role app enxerga e consegue fazer. */
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
  const categoria = async (tipo: string, escopo: string, dono: string | null, nome: string) => {
    const id = randomUUID();
    await c.query(
      `insert into app.categoria (id, lar_id, tipo, escopo, dono_id, nome, variavel) values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, larId, tipo, escopo, dono, nome, tipo === 'despesa' ? false : null],
    );
    return id;
  };
  const catConjunta = await categoria('despesa', 'conjunto', null, 'Mercado');
  const catIndA = await categoria('despesa', 'individual', a.membro, 'Lazer');
  const catIndB = await categoria('despesa', 'individual', b.membro, 'Lazer');
  const catReceitaA = await categoria('receita', 'individual', a.membro, 'Salário');
  const cadastros = async (p: Pessoa) => {
    const conta = randomUUID();
    const forma = randomUUID();
    await c.query(`insert into app.conta (id, lar_id, dono_id, nome) values ($1, $2, $3, 'Itaú')`, [
      conta,
      larId,
      p.membro,
    ]);
    await c.query(
      `insert into app.forma_pagamento (id, lar_id, dono_id, nome, tipo, conta_id) values ($1, $2, $3, 'Pix', 'pix', $4)`,
      [forma, larId, p.membro, conta],
    );
    return { conta, forma };
  };
  const ca = await cadastros(a);
  const cb = await cadastros(b);
  const lancar = async (dono: Pessoa, escopo: string, cat: string, forma: string, conta: string) => {
    const id = randomUUID();
    await c.query(
      `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
       values ($1, $2, $3, 'despesa', $4, $5, 1000, 1)`,
      [id, larId, dono.membro, escopo, cat],
    );
    await c.query(
      `insert into app.lancamento_pagamento (lancamento_id, lar_id, dono_id, forma_pagamento_id, conta_id, data_operacao)
       values ($1, $2, $3, $4, $5, '2026-10-15')`,
      [id, larId, dono.membro, forma, conta],
    );
    await c.query(
      `insert into app.parcela (lancamento_id, lar_id, escopo, dono_id, numero, valor_centavos, data)
       values ($1, $2, $3, $4, 1, 1000, '2026-10-15')`,
      [id, larId, escopo, dono.membro],
    );
    return id;
  };
  return {
    id: larId,
    a,
    b,
    catConjunta,
    catIndA,
    catIndB,
    catReceitaA,
    contaA: ca.conta,
    formaA: ca.forma,
    formaB: cb.forma,
    conjA: await lancar(a, 'conjunto', catConjunta, ca.forma, ca.conta),
    indA: await lancar(a, 'individual', catIndA, ca.forma, ca.conta),
    conjB: await lancar(b, 'conjunto', catConjunta, cb.forma, cb.conta),
  };
}

describe.skipIf(!temBanco)('lançamento, parte privada e parcela (Postgres 17 real, role app)', () => {
  let banco: BancoDescartavel;
  let app: pg.Client;
  let owner: pg.Client;
  let A: Lar;
  let B: Lar;

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_lanc');
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

    it('cada comando tem política para controle_app (nenhuma true) e há backup_leitura em todas', async () => {
      const p = await owner.query<{ tablename: string; cmd: string; qual: string | null; with_check: string | null }>(
        `select tablename, cmd, qual, with_check from pg_policies
          where schemaname = 'app' and tablename = any($1) and 'controle_app' = any(roles)`,
        [TABELAS],
      );
      for (const t of TABELAS) {
        expect(
          p.rows
            .filter((x) => x.tablename === t)
            .map((x) => x.cmd)
            .sort(),
          t,
        ).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
      }
      for (const x of p.rows) {
        expect(x.qual, `${x.tablename} ${x.cmd}`).not.toBe('true');
        expect(x.with_check, `${x.tablename} ${x.cmd}`).not.toBe('true');
      }
      const backup = await owner.query<{ tablename: string }>(
        `select tablename from pg_policies where schemaname = 'app' and tablename = any($1)
            and policyname = 'backup_leitura' and roles = '{controle_backup_ro}' and cmd = 'SELECT' order by 1`,
        [TABELAS],
      );
      expect(backup.rows.map((x) => x.tablename)).toEqual(TABELAS);
    });
  });

  describe('grants: a app não muda chave, lar, dono, tipo nem número (SDD 4, G-08)', () => {
    it.each([
      ['UPDATE lancamento.id', 'update app.lancamento set id = id'],
      ['UPDATE lancamento.lar_id', 'update app.lancamento set lar_id = lar_id'],
      ['UPDATE lancamento.dono_id', 'update app.lancamento set dono_id = dono_id'],
      ['UPDATE lancamento.tipo', `update app.lancamento set tipo = 'despesa'`],
      ['UPDATE lancamento.criado_em', 'update app.lancamento set criado_em = now()'],
      ['UPDATE lancamento_pagamento.dono_id', 'update app.lancamento_pagamento set dono_id = dono_id'],
      [
        'UPDATE lancamento_pagamento.lancamento_id',
        'update app.lancamento_pagamento set lancamento_id = lancamento_id',
      ],
      ['UPDATE parcela.numero', 'update app.parcela set numero = numero'],
      ['UPDATE parcela.escopo', `update app.parcela set escopo = 'conjunto'`],
      ['UPDATE parcela.dono_id', 'update app.parcela set dono_id = dono_id'],
      ['UPDATE parcela.lancamento_id', 'update app.parcela set lancamento_id = lancamento_id'],
      ['TRUNCATE lancamento', 'truncate app.lancamento'],
      ['ALTER TABLE parcela', 'alter table app.parcela disable row level security'],
    ])('recusa %s com permissão negada', async (_nome, sql) => {
      expect(await codigoDoErro(app, sql, identidade(A, A.a))).toBe(NEGADO);
    });
  });

  describe('sem GUC (ou GUC vazio), nenhuma linha (G-02)', () => {
    it.each(TABELAS)('%s: 0 linhas', async (tabela) => {
      expect(await consultar(app, `select count(*)::int as n from app.${tabela}`, {})).toEqual([{ n: 0 }]);
    });
  });

  describe('lar B × lar A, por tabela (CA-T1.1, CA-T1.5, R3)', () => {
    const idB = () => identidade(B, B.a);

    it.each(TABELAS)('%s: B não lê, não altera e não apaga nada do lar A', async (tabela) => {
      expect(await consultar(app, `select * from app.${tabela} where lar_id = $1`, idB(), [A.id])).toEqual([]);
      const coluna = tabela === 'lancamento' ? 'descricao' : tabela === 'parcela' ? 'data_ajustada' : 'conta_id';
      const valor = tabela === 'lancamento' ? `'x'` : tabela === 'parcela' ? 'true' : 'null';
      expect(
        await linhasAfetadas(app, `update app.${tabela} set ${coluna} = ${valor} where lar_id = $1`, idB(), [A.id]),
      ).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.${tabela} where lar_id = $1`, idB(), [A.id])).toBe(0);
    });

    it('B não cria lançamento no lar A, nem em nome de A, nem parcela nem parte privada nele', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
           values ($1, $2, $3, 'despesa', 'conjunto', $4, 10, 1)`,
          idB(),
          [randomUUID(), A.id, A.a.membro, A.catConjunta],
        ),
      ).toBe(NEGADO);
      expect(
        await codigoDoErro(
          app,
          `insert into app.parcela (lancamento_id, lar_id, escopo, dono_id, numero, valor_centavos, data)
           values ($1, $2, 'conjunto', $3, 2, 10, '2026-10-01')`,
          idB(),
          [A.conjA, A.id, A.a.membro],
        ),
      ).toBe(NEGADO);
      expect(
        await codigoDoErro(
          app,
          `insert into app.lancamento_pagamento (lancamento_id, lar_id, dono_id, data_operacao) values ($1, $2, $3, '2026-10-01')`,
          idB(),
          [randomUUID(), A.id, A.a.membro],
        ),
      ).toBe(NEGADO);
    });

    it('um lançamento de B não pode usar a categoria conjunta do lar A (FK por lar)', async () => {
      const codigo = await codigoDoErro(
        app,
        `insert into app.lancamento (id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
         values ($1, 'despesa', 'conjunto', $2, 10, 1)`,
        idB(),
        [randomUUID(), A.catConjunta],
      );
      expect(codigo).toBe(FK);
    });
  });

  describe('membro × individual e parte privada do outro (CA-T1.2, RN-02, RN-04, G-10)', () => {
    it('B vê as conjuntas do lar (as dele e as de A) e o próprio individual; nunca o individual de A', async () => {
      const ids = await consultar<{ id: string }>(app, `select id from app.lancamento order by id`, identidade(A, A.b));
      expect(ids.map((x) => x.id).sort()).toEqual([A.conjA, A.conjB].sort());
      const parcelas = await consultar<{ lancamento_id: string }>(
        app,
        `select lancamento_id from app.parcela`,
        identidade(A, A.b),
      );
      expect(parcelas.map((x) => x.lancamento_id).sort()).toEqual([A.conjA, A.conjB].sort());
    });

    it('G-10: como B, SELECT * em lancamento_pagamento da conjunta de A devolve 0 linhas; B só vê a própria', async () => {
      const eu = identidade(A, A.b);
      expect(
        await consultar(app, `select * from app.lancamento_pagamento where lancamento_id = $1`, eu, [A.conjA]),
      ).toEqual([]);
      const visiveis = await consultar<{ lancamento_id: string }>(
        app,
        `select lancamento_id from app.lancamento_pagamento`,
        eu,
      );
      expect(visiveis.map((x) => x.lancamento_id)).toEqual([A.conjB]);
    });

    it('B não altera nem apaga a parte privada de A, nem o individual de A', async () => {
      const eu = identidade(A, A.b);
      expect(
        await linhasAfetadas(
          app,
          `update app.lancamento_pagamento set data_operacao = '2000-01-01' where lancamento_id = $1`,
          eu,
          [A.conjA],
        ),
      ).toBe(0);
      expect(
        await linhasAfetadas(app, `delete from app.lancamento_pagamento where lancamento_id = $1`, eu, [A.conjA]),
      ).toBe(0);
      expect(await linhasAfetadas(app, `update app.lancamento set descricao = 'x' where id = $1`, eu, [A.indA])).toBe(
        0,
      );
      expect(await linhasAfetadas(app, `delete from app.lancamento where id = $1`, eu, [A.indA])).toBe(0);
      expect(
        await linhasAfetadas(app, `update app.parcela set valor_centavos = 1 where lancamento_id = $1`, eu, [A.indA]),
      ).toBe(0);
    });

    it('B edita a conjunta de A (descrição e valor das parcelas), mas não a torna individual (with check)', async () => {
      const eu = identidade(A, A.b);
      expect(
        await linhasAfetadas(app, `update app.lancamento set descricao = 'Feira' where id = $1`, eu, [A.conjA]),
      ).toBe(1);
      expect(
        await linhasAfetadas(app, `update app.parcela set valor_centavos = 999 where lancamento_id = $1`, eu, [
          A.conjA,
        ]),
      ).toBe(1);
      expect(
        await codigoDoErro(
          app,
          `update app.lancamento set escopo = 'individual', categoria_id = $2 where id = $1`,
          eu,
          [A.conjA, A.catIndB],
        ),
      ).toBe(NEGADO);
    });

    it('B não cria lançamento em nome de A nem usa a categoria individual ou a forma de A (FK por dono)', async () => {
      const eu = identidade(A, A.b);
      expect(
        await codigoDoErro(
          app,
          `insert into app.lancamento (id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
           values ($1, $2, 'despesa', 'conjunto', $3, 10, 1)`,
          eu,
          [randomUUID(), A.a.membro, A.catConjunta],
        ),
      ).toBe(NEGADO);
      expect(
        await codigoDoErro(
          app,
          `insert into app.lancamento (id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
           values ($1, 'despesa', 'individual', $2, 10, 1)`,
          eu,
          [randomUUID(), A.catIndA],
        ),
      ).toBe(FK);
      const meu = randomUUID();
      const codigo = await emTransacao(app, eu, async () => {
        await app.query(
          `insert into app.lancamento (id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
           values ($1, 'despesa', 'conjunto', $2, 10, 1)`,
          [meu, A.catConjunta],
        );
        return app
          .query(
            `insert into app.lancamento_pagamento (lancamento_id, forma_pagamento_id, data_operacao) values ($1, $2, '2026-10-01')`,
            [meu, A.formaA],
          )
          .then(() => null)
          .catch((e: { code?: string }) => e.code);
      }).catch(() => 'falhou');
      expect(codigo).toBe(FK);
      await owner.query(`delete from app.lancamento where id = $1`, [meu]);
    });
  });

  describe('cascatas (RN-07, CA-06.8)', () => {
    it('A troca a conjunta para individual: as parcelas acompanham e somem para B', async () => {
      const id = randomUUID();
      await owner.query(
        `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
         values ($1, $2, $3, 'despesa', 'conjunto', $4, 300, 3)`,
        [id, A.id, A.a.membro, A.catConjunta],
      );
      for (const n of [1, 2, 3]) {
        await owner.query(
          `insert into app.parcela (lancamento_id, lar_id, escopo, dono_id, numero, valor_centavos, data)
           values ($1, $2, 'conjunto', $3, $4, 100, '2026-11-10')`,
          [id, A.id, A.a.membro, n],
        );
      }
      await emTransacao(app, identidade(A, A.a), () =>
        app.query(`update app.lancamento set escopo = 'individual', categoria_id = $2 where id = $1`, [id, A.catIndA]),
      );
      const escopos = await owner.query<{ escopo: string }>(
        `select distinct escopo from app.parcela where lancamento_id = $1`,
        [id],
      );
      expect(escopos.rows).toEqual([{ escopo: 'individual' }]);
      expect(
        await consultar(app, `select id from app.parcela where lancamento_id = $1`, identidade(A, A.b), [id]),
      ).toEqual([]);
    });

    it('B exclui a conjunta de A: as parcelas e a parte privada de A somem junto (cascata)', async () => {
      const id = randomUUID();
      await owner.query(
        `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
         values ($1, $2, $3, 'despesa', 'conjunto', $4, 100, 1)`,
        [id, A.id, A.a.membro, A.catConjunta],
      );
      await owner.query(
        `insert into app.lancamento_pagamento (lancamento_id, lar_id, dono_id, forma_pagamento_id, conta_id, data_operacao)
         values ($1, $2, $3, $4, $5, '2026-10-15')`,
        [id, A.id, A.a.membro, A.formaA, A.contaA],
      );
      await owner.query(
        `insert into app.parcela (lancamento_id, lar_id, escopo, dono_id, numero, valor_centavos, data)
         values ($1, $2, 'conjunto', $3, 1, 100, '2026-10-15')`,
        [id, A.id, A.a.membro],
      );
      await emTransacao(app, identidade(A, A.b), () => app.query(`delete from app.lancamento where id = $1`, [id]));
      const resto = await owner.query<{ n: number }>(
        `select ((select count(*) from app.lancamento_pagamento where lancamento_id = $1)
               + (select count(*) from app.parcela where lancamento_id = $1))::int as n`,
        [id],
      );
      expect(resto.rows[0]).toEqual({ n: 0 });
    });

    it('excluir a conta ou a forma usadas num lançamento é recusado pela FK (em_uso)', async () => {
      expect(
        await codigoDoErro(app, `delete from app.forma_pagamento where id = $1`, identidade(A, A.a), [A.formaA]),
      ).toBe(FK);
      expect(await codigoDoErro(app, `delete from app.conta where id = $1`, identidade(A, A.a), [A.contaA])).toBe(FK);
    });
  });

  describe('checks (RN-14, RN-17, RN-18)', () => {
    const inserir = (campos: Record<string, unknown>) => {
      const base: Record<string, unknown> = {
        id: randomUUID(),
        tipo: 'despesa',
        escopo: 'conjunto',
        categoria_id: A.catConjunta,
        valor_total_centavos: 100,
        num_parcelas: 1,
        ...campos,
      };
      const nomes = Object.keys(base);
      return codigoDoErro(
        app,
        `insert into app.lancamento (${nomes.join(', ')}) values (${nomes.map((_, i) => `$${i + 1}`).join(', ')})`,
        identidade(A, A.a),
        Object.values(base),
      );
    };

    it('valor de 1 a 10^11 (CA-T5.1)', async () => {
      expect(await inserir({ valor_total_centavos: 0 })).toBe(CHECK);
      expect(await inserir({ valor_total_centavos: 100_000_000_001 })).toBe(CHECK);
      expect(await inserir({ valor_total_centavos: 1 })).toBeNull();
      expect(await inserir({ valor_total_centavos: 100_000_000_000 })).toBeNull();
    });

    it('nº de parcelas de 1 a 24', async () => {
      expect(await inserir({ num_parcelas: 0 })).toBe(CHECK);
      expect(await inserir({ num_parcelas: 25 })).toBe(CHECK);
      expect(await inserir({ num_parcelas: 24 })).toBeNull();
    });

    it('descrição nula ou aparada até 120 caracteres', async () => {
      expect(await inserir({ descricao: '   ' })).toBe(CHECK);
      expect(await inserir({ descricao: 'a'.repeat(121) })).toBe(CHECK);
      expect(await inserir({ descricao: 'a'.repeat(120) })).toBeNull();
      expect(await inserir({ descricao: null })).toBeNull();
    });

    it('o escopo vem da categoria (RN-01): conjunta com escopo individual, ou tipo trocado, falham na FK', async () => {
      expect(await inserir({ escopo: 'individual' })).toBe(FK);
      expect(await inserir({ tipo: 'receita', escopo: 'individual', categoria_id: A.catIndA })).toBe(FK);
      expect(await inserir({ tipo: 'receita', escopo: 'individual', categoria_id: A.catReceitaA })).toBeNull();
    });

    it('receita conjunta é recusada (lancamento_receita_individual)', async () => {
      expect(await inserir({ tipo: 'receita', escopo: 'conjunto' })).toBe(CHECK);
    });

    it('parcela com valor 0 ou número fora de 1 a 24 é recusada; dia aplicado fora de 1 a 31 também', async () => {
      const parcela = (numero: number, valor: number) =>
        codigoDoErro(
          app,
          `insert into app.parcela (lancamento_id, escopo, numero, valor_centavos, data) values ($1, 'conjunto', $2, $3, '2026-10-01')`,
          identidade(A, A.a),
          [A.conjA, numero, valor],
        );
      expect(await parcela(2, 0)).toBe(CHECK);
      expect(await parcela(25, 1)).toBe(CHECK);
      expect(await parcela(2, 1)).toBeNull();
      expect(
        await codigoDoErro(
          app,
          `update app.lancamento_pagamento set dia_vencimento_aplicado = 32 where lancamento_id = $1`,
          identidade(A, A.a),
          [A.conjA],
        ),
      ).toBe(CHECK);
    });
  });
});
