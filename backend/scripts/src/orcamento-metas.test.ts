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
 * Orçamento, meta e movimento de meta no banco (PLANO etapa 10; SDD 3.5, 4; RN-08, RN-09, RN-16, RN-18; G-01, G-04,
 * G-10; CA-T1.1, CA-T1.5, CA-08.5, CA-09.1 a CA-09.4). Postgres 18 real, banco descartável, tudo como
 * `controle_app` com a identidade em GUC local, como a API grava. Teste negativo POR TABELA: o lar B não lê nem
 * escreve nada do lar A; e o membro B não vê o individual de A (orçamento e meta) nem a conta do movimento de A.
 */
avisarSemBanco();

const NEGADO = '42501';
const FK = '23503';
const CHECK = '23514';
const UNICO = '23505';
const TABELAS = ['orcamento', 'meta', 'movimento_meta'];

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
  contaB: string;
  orcConjunto: string;
  orcIndA: string;
  metaConjunta: string;
  metaIndA: string;
  movConjunta: string;
  movIndA: string;
  movContaDeA: string;
}

const identidade = (l: Lar, p: Pessoa): Identidade => ({
  usuario: p.usuario,
  email: p.email,
  lar: l.id,
  membro: p.membro,
  papel: p === l.a ? 'titular' : 'membro',
});

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
  const conta = async (dono: string, nome: string) => {
    const id = randomUUID();
    await c.query(`insert into app.conta (id, lar_id, dono_id, nome) values ($1, $2, $3, $4)`, [id, larId, dono, nome]);
    return id;
  };
  const contaA = await conta(a.membro, 'Conta de Ana');
  const contaB = await conta(b.membro, 'Conta de Bruno');

  const orc = async (categoria_id: string, escopo: string, dono: string | null) => {
    const id = randomUUID();
    await c.query(
      `insert into app.orcamento (id, lar_id, mes, categoria_id, escopo, dono_id, valor_centavos)
       values ($1, $2, '2026-10-01', $3, $4, $5, 50000)`,
      [id, larId, categoria_id, escopo, dono],
    );
    return id;
  };
  const orcConjunto = await orc(catConjunta, 'conjunto', null);
  const orcIndA = await orc(catIndA, 'individual', a.membro);

  const meta = async (escopo: string, nome: string) => {
    const id = randomUUID();
    await c.query(
      `insert into app.meta (id, lar_id, dono_id, nome, alvo_centavos, escopo) values ($1, $2, $3, $4, 100000, $5)`,
      [id, larId, a.membro, nome, escopo],
    );
    return id;
  };
  const metaConjunta = await meta('conjunto', 'Viagem');
  const metaIndA = await meta('individual', 'Reserva de Ana');
  const mov = async (metaId: string, autor: string, local: string, ligarConta?: string) => {
    const id = randomUUID();
    await c.query(
      `insert into app.movimento_meta (id, lar_id, meta_id, tipo, valor_centavos, data, local, autor_id)
       values ($1, $2, $3, 'aporte', 20000, '2026-10-05', $4, $5)`,
      [id, larId, metaId, local, autor],
    );
    if (ligarConta) {
      await c.query(
        `insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data, movimento_meta_id)
         values ($1, $2, $3, 'aporte', 'saida', 20000, '2026-10-05', $4)`,
        [larId, autor, ligarConta, id],
      );
    }
    return id;
  };
  const movConjunta = await mov(metaConjunta, a.membro, 'Nubank', contaA);
  const movIndA = await mov(metaIndA, a.membro, 'Cofre');
  const r = await c.query<{ id: string }>(`select id from app.movimento_conta where movimento_meta_id = $1`, [
    movConjunta,
  ]);
  return {
    id: larId,
    a,
    b,
    catConjunta,
    catIndA,
    catIndB,
    catReceitaA,
    contaA,
    contaB,
    orcConjunto,
    orcIndA,
    metaConjunta,
    metaIndA,
    movConjunta,
    movIndA,
    movContaDeA: r.rows[0]!.id,
  };
}

describe.skipIf(!temBanco)('orçamento, meta e movimento de meta (Postgres 18 real, role app)', () => {
  let banco: BancoDescartavel;
  let app: pg.Client;
  let owner: pg.Client;
  let A: Lar;
  let B: Lar;

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_orcmeta');
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
        [[...TABELAS].sort()],
      );
      expect(r.rows).toEqual([...TABELAS].sort().map((relname) => ({ relname, rls: true, force: true })));
    });

    it('políticas para controle_app (nenhuma true): orçamento com os 4 comandos; meta sem DELETE; movimento só SELECT e INSERT', async () => {
      const p = await owner.query<{ tablename: string; cmd: string; qual: string | null; with_check: string | null }>(
        `select tablename, cmd, qual, with_check from pg_policies
          where schemaname = 'app' and tablename = any($1) and 'controle_app' = any(roles)`,
        [TABELAS],
      );
      const comandos = (t: string) =>
        p.rows
          .filter((x) => x.tablename === t)
          .map((x) => x.cmd)
          .sort();
      expect(comandos('orcamento')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
      expect(comandos('meta')).toEqual(['INSERT', 'SELECT', 'UPDATE']);
      expect(comandos('movimento_meta')).toEqual(['INSERT', 'SELECT']);
      for (const x of p.rows) {
        expect(x.qual, `${x.tablename} ${x.cmd}`).not.toBe('true');
        expect(x.with_check, `${x.tablename} ${x.cmd}`).not.toBe('true');
      }
      const backup = await owner.query<{ tablename: string }>(
        `select tablename from pg_policies where schemaname = 'app' and tablename = any($1)
            and policyname = 'backup_leitura' and roles = '{controle_backup_ro}' and cmd = 'SELECT' order by 1`,
        [TABELAS],
      );
      expect(backup.rows.map((x) => x.tablename)).toEqual([...TABELAS].sort());
    });
  });

  describe('grants: a meta não se exclui, o movimento é imutável, o escopo não muda (SDD 4, G-04)', () => {
    it.each([
      ['DELETE meta', 'delete from app.meta'],
      ['UPDATE meta.escopo', `update app.meta set escopo = 'conjunto'`],
      ['UPDATE meta.dono_id', 'update app.meta set dono_id = dono_id'],
      ['UPDATE meta.lar_id', 'update app.meta set lar_id = lar_id'],
      ['UPDATE movimento_meta.valor_centavos', 'update app.movimento_meta set valor_centavos = 1'],
      ['UPDATE movimento_meta.local', `update app.movimento_meta set local = 'x'`],
      ['DELETE movimento_meta', 'delete from app.movimento_meta'],
      ['UPDATE orcamento.escopo', `update app.orcamento set escopo = 'conjunto'`],
      ['UPDATE orcamento.categoria_id', 'update app.orcamento set categoria_id = categoria_id'],
      ['UPDATE orcamento.mes', 'update app.orcamento set mes = mes'],
      ['TRUNCATE meta', 'truncate app.meta'],
      ['ALTER TABLE movimento_meta', 'alter table app.movimento_meta disable row level security'],
    ])('recusa %s com permissão negada', async (_nome, sql) => {
      expect(await codigoDoErro(app, sql, identidade(A, A.a))).toBe(NEGADO);
    });

    it('a app atualiza nome, alvo, prazo e atingida_em da meta e o valor do orçamento, e apaga orçamento', async () => {
      const eu = identidade(A, A.a);
      expect(
        await linhasAfetadas(
          app,
          `update app.meta set nome = nome, alvo_centavos = alvo_centavos, prazo = prazo, atingida_em = atingida_em
            where id = $1`,
          eu,
          [A.metaConjunta],
        ),
      ).toBe(1);
      expect(
        await linhasAfetadas(app, `update app.orcamento set valor_centavos = 60000 where id = $1`, eu, [A.orcConjunto]),
      ).toBe(1);
      expect(await linhasAfetadas(app, `delete from app.orcamento where id = $1`, eu, [A.orcConjunto])).toBe(1);
    });
  });

  describe('sem GUC (ou GUC vazio), nenhuma linha (G-02)', () => {
    it.each(TABELAS)('%s: 0 linhas', async (tabela) => {
      expect(await consultar(app, `select count(*)::int as n from app.${tabela}`, {})).toEqual([{ n: 0 }]);
    });
  });

  describe('lar B × lar A, por tabela (CA-T1.1, CA-T1.5, R3)', () => {
    const idB = () => identidade(B, B.a);

    it.each(TABELAS)('%s: B não lê nada do lar A', async (tabela) => {
      expect(await consultar(app, `select * from app.${tabela} where lar_id = $1`, idB(), [A.id])).toEqual([]);
    });

    it('B não altera nem apaga o que é do lar A', async () => {
      expect(
        await linhasAfetadas(app, `update app.orcamento set valor_centavos = 1 where lar_id = $1`, idB(), [A.id]),
      ).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.orcamento where lar_id = $1`, idB(), [A.id])).toBe(0);
      expect(await linhasAfetadas(app, `update app.meta set nome = 'x' where lar_id = $1`, idB(), [A.id])).toBe(0);
      const intacto = await owner.query<{ n: number }>(
        `select count(*)::int as n from app.orcamento where lar_id = $1 and valor_centavos = 50000`,
        [A.id],
      );
      expect(intacto.rows[0]!.n).toBeGreaterThan(0);
    });

    it('B não cria orçamento, meta nem movimento no lar A', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.orcamento (lar_id, mes, categoria_id, escopo, valor_centavos)
           values ($1, '2026-11-01', $2, 'conjunto', 1)`,
          idB(),
          [A.id, A.catConjunta],
        ),
      ).toBe(NEGADO);
      expect(
        await codigoDoErro(
          app,
          `insert into app.meta (id, lar_id, dono_id, nome, alvo_centavos, escopo)
           values ($1, $2, $3, 'x', 1, 'conjunto')`,
          idB(),
          [randomUUID(), A.id, B.a.membro],
        ),
      ).toBe(NEGADO);
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_meta (id, lar_id, meta_id, tipo, valor_centavos, data, local, autor_id)
           values ($1, $2, $3, 'aporte', 1, '2026-10-01', 'x', $4)`,
          idB(),
          [randomUUID(), A.id, A.metaConjunta, B.a.membro],
        ),
      ).toBe(NEGADO);
    });

    it('B não usa a categoria nem a meta do lar A (FK por lar), mesmo no lar dele', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.orcamento (mes, categoria_id, escopo, valor_centavos)
           values ('2026-11-01', $1, 'conjunto', 1)`,
          idB(),
          [A.catConjunta],
        ),
      ).toBe(FK);
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_meta (id, meta_id, tipo, valor_centavos, data, local)
           values ($1, $2, 'aporte', 1, '2026-10-01', 'x')`,
          idB(),
          [randomUUID(), A.metaConjunta],
        ),
      ).toBe(NEGADO);
    });
  });

  describe('privacidade entre os membros do mesmo lar (RN-08, G-10; CA-T1.2)', () => {
    const idA = () => identidade(A, A.a);
    const idBruno = () => identidade(A, A.b);

    it('B vê o orçamento e a meta conjuntos de A e os movimentos da meta conjunta', async () => {
      expect(
        (await consultar<{ id: string }>(app, `select id from app.orcamento`, idBruno())).map((x) => x.id),
      ).toEqual([A.orcConjunto]);
      expect((await consultar<{ id: string }>(app, `select id from app.meta`, idBruno())).map((x) => x.id)).toEqual([
        A.metaConjunta,
      ]);
      expect(
        (await consultar<{ id: string }>(app, `select id from app.movimento_meta`, idBruno())).map((x) => x.id),
      ).toEqual([A.movConjunta]);
    });

    it('A vê o próprio individual: orçamento, meta e movimento', async () => {
      expect(
        (await consultar<{ id: string }>(app, `select id from app.orcamento order by id`, idA()))
          .map((x) => x.id)
          .sort(),
      ).toEqual([A.orcConjunto, A.orcIndA].sort());
      expect((await consultar<{ id: string }>(app, `select id from app.meta`, idA())).map((x) => x.id).sort()).toEqual(
        [A.metaConjunta, A.metaIndA].sort(),
      );
      expect(
        (await consultar<{ id: string }>(app, `select id from app.movimento_meta`, idA())).map((x) => x.id).sort(),
      ).toEqual([A.movConjunta, A.movIndA].sort());
    });

    it('B não altera, não apaga nem usa o orçamento individual de A', async () => {
      expect(
        await linhasAfetadas(app, `update app.orcamento set valor_centavos = 1 where id = $1`, idBruno(), [A.orcIndA]),
      ).toBe(0);
      expect(await linhasAfetadas(app, `delete from app.orcamento where id = $1`, idBruno(), [A.orcIndA])).toBe(0);
      expect(
        await codigoDoErro(
          app,
          `insert into app.orcamento (mes, categoria_id, escopo, dono_id, valor_centavos)
           values ('2026-11-01', $1, 'individual', $2, 1)`,
          idBruno(),
          [A.catIndA, A.b.membro],
        ),
      ).toBe(FK);
    });

    it('B não edita a meta individual de A nem movimenta nela, mesmo com o id', async () => {
      expect(await linhasAfetadas(app, `update app.meta set nome = 'x' where id = $1`, idBruno(), [A.metaIndA])).toBe(
        0,
      );
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_meta (id, meta_id, tipo, valor_centavos, data, local)
           values ($1, $2, 'aporte', 1, '2026-10-01', 'x')`,
          idBruno(),
          [randomUUID(), A.metaIndA],
        ),
      ).toBe(NEGADO);
    });

    it('B edita a meta conjunta e movimenta nela como autor dele; não como autor de A (CA-08.5)', async () => {
      expect(
        await linhasAfetadas(app, `update app.meta set nome = 'Viagem 2' where id = $1`, idBruno(), [A.metaConjunta]),
      ).toBe(1);
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_meta (id, meta_id, tipo, valor_centavos, data, local)
           values ($1, $2, 'aporte', 1, '2026-10-01', 'x')`,
          idBruno(),
          [randomUUID(), A.metaConjunta],
        ),
      ).toBeNull();
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_meta (id, lar_id, meta_id, tipo, valor_centavos, data, local, autor_id)
           values ($1, $2, $3, 'aporte', 1, '2026-10-01', 'x', $4)`,
          idBruno(),
          [randomUUID(), A.id, A.metaConjunta, A.a.membro],
        ),
      ).toBe(NEGADO);
    });

    it('o movimento de conta de A, ligado ao aporte da meta conjunta, é invisível a B (G-10)', async () => {
      expect(await consultar(app, `select id from app.movimento_conta`, idBruno())).toEqual([]);
      expect(
        await consultar(app, `select id from app.movimento_conta where movimento_meta_id = $1`, idBruno(), [
          A.movConjunta,
        ]),
      ).toEqual([]);
      expect(
        (await consultar<{ id: string }>(app, `select id from app.movimento_conta`, idA())).map((x) => x.id),
      ).toEqual([A.movContaDeA]);
    });

    it('B não liga um movimento de conta dele ao aporte de A (FK composta com o autor)', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (conta_id, tipo, sentido, valor_centavos, data, movimento_meta_id)
           values ($1, 'aporte', 'saida', 1, '2026-10-05', $2)`,
          idBruno(),
          [A.contaB, A.movIndA],
        ),
      ).toBe(FK);
    });
  });

  describe('regras do orçamento (RN-16, RN-18; CA-16.7)', () => {
    const eu = () => identidade(A, A.a);
    const inserir = (campos: Record<string, unknown>) => {
      const base: Record<string, unknown> = {
        mes: '2026-12-01',
        categoria_id: A.catConjunta,
        escopo: 'conjunto',
        dono_id: null,
        valor_centavos: 100,
        ...campos,
      };
      return codigoDoErro(
        app,
        `insert into app.orcamento (mes, categoria_id, escopo, dono_id, valor_centavos) values ($1, $2, $3, $4, $5)`,
        eu(),
        [base['mes'], base['categoria_id'], base['escopo'], base['dono_id'], base['valor_centavos']],
      );
    };

    it('aceita conjunto sem dono e individual com o dono da categoria', async () => {
      expect(await inserir({})).toBeNull();
      expect(await inserir({ categoria_id: A.catIndA, escopo: 'individual', dono_id: A.a.membro })).toBeNull();
    });

    // Como owner (sem RLS): a RLS da app recusa antes (42501); aqui se prova que a constraint também segura.
    const comoOwner = (categoria: string, escopo: string, dono: string | null) =>
      codigoDoErro(
        owner,
        `insert into app.orcamento (lar_id, mes, categoria_id, escopo, dono_id, valor_centavos)
         values ($1, '2026-12-01', $2, $3, $4, 100)`,
        {},
        [A.id, categoria, escopo, dono],
      );

    it('recusa dono na conjunta e individual sem dono (orcamento_dono_so_individual), e a app é barrada também pela RLS', async () => {
      expect(await comoOwner(A.catConjunta, 'conjunto', A.a.membro)).toBe(CHECK);
      expect(await comoOwner(A.catIndA, 'individual', null)).toBe(CHECK);
      expect(await inserir({ dono_id: A.a.membro })).toBe(CHECK);
      expect(await inserir({ categoria_id: A.catIndA, escopo: 'individual', dono_id: null })).toBe(NEGADO);
    });

    it('recusa categoria de receita e escopo diferente do da categoria', async () => {
      expect(await inserir({ categoria_id: A.catReceitaA, escopo: 'individual', dono_id: A.a.membro })).toBe(FK);
      expect(await inserir({ categoria_id: A.catIndA, escopo: 'conjunto', dono_id: null })).toBe(FK);
    });

    it('recusa individual no nome do outro dono (categoria de A, dono B): FK e RLS', async () => {
      expect(await comoOwner(A.catIndA, 'individual', A.b.membro)).toBe(FK);
      expect(await inserir({ categoria_id: A.catIndA, escopo: 'individual', dono_id: A.b.membro })).toBe(NEGADO);
    });

    it.each([0, -1, 100_000_000_001])('recusa valor %s', async (valor_centavos) => {
      expect(await inserir({ valor_centavos })).toBe(CHECK);
    });

    it('aceita o teto de 10^11; recusa mês que não é dia 1', async () => {
      expect(await inserir({ valor_centavos: 100_000_000_000 })).toBeNull();
      expect(await inserir({ mes: '2026-12-15' })).toBe(CHECK);
    });

    it('um valor por categoria e mês (unique)', async () => {
      expect(await inserir({ mes: '2026-10-01' })).toBe(UNICO);
    });

    it('a categoria com orçamento não se exclui (FK)', async () => {
      expect(await codigoDoErro(app, `delete from app.categoria where id = $1`, eu(), [A.catConjunta])).toBe(FK);
    });
  });

  describe('regras da meta e do movimento (RN-08, RN-09, RN-18; CA-09.4)', () => {
    const eu = () => identidade(A, A.a);
    const metaNova = (campos: Record<string, unknown>) => {
      const b: Record<string, unknown> = { nome: 'Carro', alvo: 1000, prazo: null, escopo: 'conjunto', ...campos };
      return codigoDoErro(
        app,
        `insert into app.meta (id, nome, alvo_centavos, prazo, escopo) values ($1, $2, $3, $4, $5)`,
        eu(),
        [randomUUID(), b['nome'], b['alvo'], b['prazo'], b['escopo']],
      );
    };
    const movNovo = (campos: Record<string, unknown>) => {
      const b: Record<string, unknown> = { tipo: 'aporte', valor: 100, local: 'Nubank', ...campos };
      return codigoDoErro(
        app,
        `insert into app.movimento_meta (id, meta_id, tipo, valor_centavos, data, local)
         values ($1, $2, $3, $4, '2026-10-10', $5)`,
        eu(),
        [randomUUID(), A.metaConjunta, b['tipo'], b['valor'], b['local']],
      );
    };

    it('meta: aceita prazo no dia 1; recusa nome vazio, alvo fora da faixa, prazo fora do dia 1 e escopo desconhecido', async () => {
      expect(await metaNova({ prazo: '2027-03-01' })).toBeNull();
      expect(await metaNova({ nome: '  ' })).toBe(CHECK);
      expect(await metaNova({ nome: 'x'.repeat(121) })).toBe(CHECK);
      expect(await metaNova({ alvo: 0 })).toBe(CHECK);
      expect(await metaNova({ alvo: 100_000_000_001 })).toBe(CHECK);
      expect(await metaNova({ prazo: '2027-03-15' })).toBe(CHECK);
      expect(await metaNova({ escopo: 'todos' })).toBe(CHECK);
    });

    it('movimento: aceita aporte e retirada; recusa tipo, valor e local fora da regra', async () => {
      expect(await movNovo({})).toBeNull();
      expect(await movNovo({ tipo: 'retirada' })).toBeNull();
      expect(await movNovo({ tipo: 'ajuste' })).toBe(CHECK);
      expect(await movNovo({ valor: 0 })).toBe(CHECK);
      expect(await movNovo({ valor: 100_000_000_001 })).toBe(CHECK);
      expect(await movNovo({ local: '' })).toBe(CHECK);
      expect(await movNovo({ local: ' Nubank' })).toBe(CHECK);
      expect(await movNovo({ local: 'x'.repeat(61) })).toBe(CHECK);
      expect(await movNovo({ local: 'x'.repeat(60) })).toBeNull();
    });

    it('o movimento não reaproveita o id de outro (chave primária)', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_meta (id, meta_id, tipo, valor_centavos, data, local)
           values ($1, $2, 'aporte', 1, '2026-10-10', 'x')`,
          eu(),
          [A.movConjunta, A.metaConjunta],
        ),
      ).toBe(UNICO);
    });
  });

  describe('movimento de conta ligado ao movimento de meta (RN-09; movimento_conta_meta_ck)', () => {
    const eu = () => identidade(A, A.a);

    it('aporte e retirada exigem o movimento de meta; os demais tipos não podem tê-lo', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (conta_id, tipo, sentido, valor_centavos, data)
           values ($1, 'aporte', 'saida', 1, '2026-10-05')`,
          eu(),
          [A.contaA],
        ),
      ).toBe(CHECK);
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (conta_id, tipo, sentido, valor_centavos, data, movimento_meta_id)
           values ($1, 'ajuste', 'entrada', 1, '2026-10-05', $2)`,
          eu(),
          [A.contaA, A.movIndA],
        ),
      ).toBe(CHECK);
    });

    it('um movimento de meta liga no máximo um movimento de conta (unique)', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (conta_id, tipo, sentido, valor_centavos, data, movimento_meta_id)
           values ($1, 'aporte', 'saida', 1, '2026-10-05', $2)`,
          eu(),
          [A.contaA, A.movConjunta],
        ),
      ).toBe(UNICO);
    });

    it('a conta é do autor do movimento (FK composta): a de B não serve ao aporte de A', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (conta_id, tipo, sentido, valor_centavos, data, movimento_meta_id)
           values ($1, 'aporte', 'saida', 1, '2026-10-05', $2)`,
          eu(),
          [A.contaB, A.movIndA],
        ),
      ).toBe(FK);
    });

    it('ligar a conta de A ao aporte dele sem conta anterior funciona', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.movimento_conta (conta_id, tipo, sentido, valor_centavos, data, movimento_meta_id)
           values ($1, 'aporte', 'saida', 1, '2026-10-05', $2)`,
          eu(),
          [A.contaA, A.movIndA],
        ),
      ).toBeNull();
    });
  });
});
