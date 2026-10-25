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
 * Despesa fixa e ocorrência no banco (PLANO etapa 9; SDD 3.5, 4; RN-15, RN-28; G-01, G-04; CA-T1.1, CA-T1.5,
 * CA-15.1, CA-15.3, CA-15.9). Postgres 17 real, banco descartável, tudo como `controle_app` com a identidade em GUC
 * local, como a API grava. Teste negativo POR TABELA: o lar B não lê nem escreve nada do lar A. As duas tabelas são
 * do lar: os dois membros as veem (não há dado individual nelas).
 */
avisarSemBanco();

const NEGADO = '42501';
const FK = '23503';
const CHECK = '23514';
const UNICO = '23505';
const TABELAS = ['despesa_fixa', 'ocorrencia_fixa'];

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
  catReceitaA: string;
  fixa: string;
  ocorrencia: string;
  /** Lançamento conjunto de A que paga uma ocorrência de outubro. */
  pagamento: string;
  ocorrenciaPaga: string;
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
  const catConjunta = await categoria('despesa', 'conjunto', null, 'Moradia');
  const catIndA = await categoria('despesa', 'individual', a.membro, 'Lazer');
  const catReceitaA = await categoria('receita', 'individual', a.membro, 'Salário');
  const fixa = randomUUID();
  await c.query(
    `insert into app.despesa_fixa (id, lar_id, descricao, categoria_id, valor_previsto_centavos, dia_vencimento, inicio)
     values ($1, $2, 'Aluguel', $3, 150000, 10, '2026-01-01')`,
    [fixa, larId, catConjunta],
  );
  const ocorrencia = async (mes: string, vencimento: string) => {
    const r = await c.query<{ id: string }>(
      `insert into app.ocorrencia_fixa (lar_id, despesa_fixa_id, mes, vencimento, valor_previsto_centavos)
       values ($1, $2, $3, $4, 150000) returning id`,
      [larId, fixa, mes, vencimento],
    );
    return r.rows[0]!.id;
  };
  const ocorrenciaPaga = await ocorrencia('2026-10-01', '2026-10-10');
  const pagamento = randomUUID();
  await c.query(
    `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
     values ($1, $2, $3, 'despesa', 'conjunto', $4, 150000, 1)`,
    [pagamento, larId, a.membro, catConjunta],
  );
  await c.query(
    `insert into app.parcela (lancamento_id, lar_id, escopo, dono_id, numero, valor_centavos, data)
     values ($1, $2, 'conjunto', $3, 1, 150000, '2026-10-10')`,
    [pagamento, larId, a.membro],
  );
  await c.query(`update app.ocorrencia_fixa set lancamento_id = $1 where id = $2`, [pagamento, ocorrenciaPaga]);
  return {
    id: larId,
    a,
    b,
    catConjunta,
    catIndA,
    catReceitaA,
    fixa,
    ocorrencia: await ocorrencia('2026-11-01', '2026-11-10'),
    pagamento,
    ocorrenciaPaga,
  };
}

describe.skipIf(!temBanco)('despesa fixa e ocorrência (Postgres 17 real, role app)', () => {
  let banco: BancoDescartavel;
  let app: pg.Client;
  let owner: pg.Client;
  let A: Lar;
  let B: Lar;

  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_fixa');
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
    it('as 2 tabelas têm ENABLE e FORCE ROW LEVEL SECURITY', async () => {
      const r = await owner.query<{ relname: string; rls: boolean; force: boolean }>(
        `select relname, relrowsecurity as rls, relforcerowsecurity as force from pg_class
          where relnamespace = 'app'::regnamespace and relname = any($1) order by 1`,
        [TABELAS],
      );
      expect(r.rows).toEqual(TABELAS.map((relname) => ({ relname, rls: true, force: true })));
    });

    it('políticas para controle_app (nenhuma true): a fixa sem DELETE; a ocorrência com os 4 comandos', async () => {
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
      expect(comandos('despesa_fixa')).toEqual(['INSERT', 'SELECT', 'UPDATE']);
      expect(comandos('ocorrencia_fixa')).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
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

  describe('grants: a fixa não se exclui; chave, lar, tipo, escopo e início não mudam (SDD 4, G-04)', () => {
    it.each([
      ['DELETE despesa_fixa', 'delete from app.despesa_fixa'],
      ['UPDATE despesa_fixa.id', 'update app.despesa_fixa set id = id'],
      ['UPDATE despesa_fixa.lar_id', 'update app.despesa_fixa set lar_id = lar_id'],
      ['UPDATE despesa_fixa.escopo', `update app.despesa_fixa set escopo = 'conjunto'`],
      ['UPDATE despesa_fixa.tipo', `update app.despesa_fixa set tipo = 'despesa'`],
      ['UPDATE despesa_fixa.inicio', 'update app.despesa_fixa set inicio = inicio'],
      ['UPDATE ocorrencia_fixa.mes', 'update app.ocorrencia_fixa set mes = mes'],
      ['UPDATE ocorrencia_fixa.despesa_fixa_id', 'update app.ocorrencia_fixa set despesa_fixa_id = despesa_fixa_id'],
      ['UPDATE ocorrencia_fixa.lar_id', 'update app.ocorrencia_fixa set lar_id = lar_id'],
      ['TRUNCATE despesa_fixa', 'truncate app.despesa_fixa'],
      ['ALTER TABLE ocorrencia_fixa', 'alter table app.ocorrencia_fixa disable row level security'],
    ])('recusa %s com permissão negada', async (_nome, sql) => {
      expect(await codigoDoErro(app, sql, identidade(A, A.a))).toBe(NEGADO);
    });

    it('a app atualiza descrição, categoria, previsto, dia e encerramento da fixa, e previsto, vencimento e lançamento da ocorrência', async () => {
      const eu = identidade(A, A.b);
      expect(
        await linhasAfetadas(
          app,
          `update app.despesa_fixa set descricao = descricao, categoria_id = categoria_id,
                  valor_previsto_centavos = valor_previsto_centavos, dia_vencimento = dia_vencimento,
                  encerrada_em = encerrada_em where id = $1`,
          eu,
          [A.fixa],
        ),
      ).toBe(1);
      expect(
        await linhasAfetadas(
          app,
          `update app.ocorrencia_fixa set valor_previsto_centavos = valor_previsto_centavos, vencimento = vencimento,
                  lancamento_id = lancamento_id where id = $1`,
          eu,
          [A.ocorrencia],
        ),
      ).toBe(1);
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
      expect(
        await linhasAfetadas(app, `update app.${tabela} set valor_previsto_centavos = 1 where lar_id = $1`, idB(), [
          A.id,
        ]),
      ).toBe(0);
      if (tabela === 'ocorrencia_fixa') {
        expect(await linhasAfetadas(app, `delete from app.ocorrencia_fixa where lar_id = $1`, idB(), [A.id])).toBe(0);
      }
      const intacto = await owner.query<{ n: number }>(
        `select count(*)::int as n from app.${tabela} where lar_id = $1 and valor_previsto_centavos = 150000`,
        [A.id],
      );
      expect(intacto.rows[0]!.n).toBeGreaterThan(0);
    });

    it('B não cria fixa nem ocorrência no lar A', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.despesa_fixa (id, lar_id, descricao, categoria_id, valor_previsto_centavos, dia_vencimento, inicio)
           values ($1, $2, 'x', $3, 1, 1, '2026-10-01')`,
          idB(),
          [randomUUID(), A.id, A.catConjunta],
        ),
      ).toBe(NEGADO);
      expect(
        await codigoDoErro(
          app,
          `insert into app.ocorrencia_fixa (lar_id, despesa_fixa_id, mes, vencimento, valor_previsto_centavos)
           values ($1, $2, '2026-12-01', '2026-12-10', 1)`,
          idB(),
          [A.id, A.fixa],
        ),
      ).toBe(NEGADO);
    });

    it('B não usa a categoria conjunta do lar A numa fixa dele, nem a fixa de A numa ocorrência dele (FK por lar)', async () => {
      expect(
        await codigoDoErro(
          app,
          `insert into app.despesa_fixa (id, descricao, categoria_id, valor_previsto_centavos, dia_vencimento, inicio)
           values ($1, 'x', $2, 1, 1, '2026-10-01')`,
          idB(),
          [randomUUID(), A.catConjunta],
        ),
      ).toBe(FK);
      expect(
        await codigoDoErro(
          app,
          `insert into app.ocorrencia_fixa (despesa_fixa_id, mes, vencimento, valor_previsto_centavos)
           values ($1, '2026-12-01', '2026-12-10', 1)`,
          idB(),
          [A.fixa],
        ),
      ).toBe(FK);
    });

    it('B não liga a ocorrência dele a um lançamento do lar A (FK composta por lar)', async () => {
      const lancA = randomUUID();
      await owner.query(
        `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
         values ($1, $2, $3, 'despesa', 'conjunto', $4, 100, 1)`,
        [lancA, A.id, A.a.membro, A.catConjunta],
      );
      expect(
        await codigoDoErro(app, `update app.ocorrencia_fixa set lancamento_id = $1 where id = $2`, idB(), [
          lancA,
          B.ocorrencia,
        ]),
      ).toBe(FK);
    });
  });

  describe('os dois membros do lar enxergam e editam a fixa (RN-15)', () => {
    it('B vê a fixa e as ocorrências de A (inclusive a paga por A) e as edita', async () => {
      const eu = identidade(A, A.b);
      expect(await consultar(app, `select id from app.despesa_fixa`, eu)).toEqual([{ id: A.fixa }]);
      const ocorrencias = await consultar<{ id: string }>(app, `select id from app.ocorrencia_fixa order by mes`, eu);
      expect(ocorrencias.map((x) => x.id)).toEqual([A.ocorrenciaPaga, A.ocorrencia]);
      expect(
        await linhasAfetadas(app, `update app.despesa_fixa set descricao = 'Aluguel' where id = $1`, eu, [A.fixa]),
      ).toBe(1);
    });
  });

  describe('regras do modelo e da ocorrência (RN-15, RN-18; CA-15.1, CA-15.3, CA-15.9)', () => {
    const inserirFixa = (campos: Record<string, unknown>) => {
      const base: Record<string, unknown> = {
        id: randomUUID(),
        descricao: 'Luz',
        categoria_id: A.catConjunta,
        valor_previsto_centavos: 100,
        dia_vencimento: 5,
        inicio: '2026-10-01',
        ...campos,
      };
      const nomes = Object.keys(base);
      return codigoDoErro(
        app,
        `insert into app.despesa_fixa (${nomes.join(', ')}) values (${nomes.map((_, i) => `$${i + 1}`).join(', ')})`,
        identidade(A, A.a),
        Object.values(base),
      );
    };

    it('CA-15.9: categoria individual ou de receita é recusada pela FK (sempre conjunta de despesa)', async () => {
      expect(await inserirFixa({ categoria_id: A.catIndA })).toBe(FK);
      expect(await inserirFixa({ categoria_id: A.catReceitaA })).toBe(FK);
      expect(await inserirFixa({ escopo: 'individual', categoria_id: A.catIndA })).toBe(CHECK);
      expect(await inserirFixa({})).toBeNull();
    });

    it('descrição, previsto, dia e início no dia 1', async () => {
      expect(await inserirFixa({ descricao: '  ' })).toBe(CHECK);
      expect(await inserirFixa({ descricao: 'a'.repeat(121) })).toBe(CHECK);
      expect(await inserirFixa({ valor_previsto_centavos: 0 })).toBe(CHECK);
      expect(await inserirFixa({ valor_previsto_centavos: 100_000_000_001 })).toBe(CHECK);
      expect(await inserirFixa({ dia_vencimento: 0 })).toBe(CHECK);
      expect(await inserirFixa({ dia_vencimento: 32 })).toBe(CHECK);
      expect(await inserirFixa({ inicio: '2026-10-15' })).toBe(CHECK);
    });

    it('CA-15.1: no máximo 1 ocorrência por fixa e mês; o vencimento fica no mês da ocorrência', async () => {
      const ins = (mes: string, vencimento: string) =>
        codigoDoErro(
          app,
          `insert into app.ocorrencia_fixa (despesa_fixa_id, mes, vencimento, valor_previsto_centavos)
           values ($1, $2, $3, 1)`,
          identidade(A, A.a),
          [A.fixa, mes, vencimento],
        );
      expect(await ins('2026-11-01', '2026-11-10')).toBe(UNICO);
      expect(await ins('2027-02-01', '2027-03-01')).toBe(CHECK);
      expect(await ins('2027-02-15', '2027-02-15')).toBe(CHECK);
      expect(await ins('2027-02-01', '2027-02-28')).toBeNull();
    });

    it('um lançamento paga no máximo uma ocorrência', async () => {
      expect(
        await codigoDoErro(app, `update app.ocorrencia_fixa set lancamento_id = $1 where id = $2`, identidade(A, A.a), [
          A.pagamento,
          A.ocorrencia,
        ]),
      ).toBe(UNICO);
    });
  });

  describe('cascatas e vínculos (RN-15, RN-17)', () => {
    it('excluir o lançamento do pagamento volta a ocorrência a pendente (on delete set null), mesmo pelo app', async () => {
      const id = randomUUID();
      await owner.query(
        `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
         values ($1, $2, $3, 'despesa', 'conjunto', $4, 100, 1)`,
        [id, A.id, A.a.membro, A.catConjunta],
      );
      const ocorrencia = await owner.query<{ id: string }>(
        `insert into app.ocorrencia_fixa (lar_id, despesa_fixa_id, mes, vencimento, valor_previsto_centavos, lancamento_id)
         values ($1, $2, '2027-01-01', '2027-01-10', 100, $3) returning id`,
        [A.id, A.fixa, id],
      );
      await emTransacao(app, identidade(A, A.a), () => app.query(`delete from app.lancamento where id = $1`, [id]));
      const r = await owner.query(`select lancamento_id from app.ocorrencia_fixa where id = $1`, [
        ocorrencia.rows[0]!.id,
      ]);
      expect(r.rows).toEqual([{ lancamento_id: null }]);
    });

    it('excluir a categoria usada só numa fixa é recusado pela FK (categoria_em_uso)', async () => {
      const cat = randomUUID();
      await owner.query(
        `insert into app.categoria (id, lar_id, tipo, escopo, nome, variavel) values ($1, $2, 'despesa', 'conjunto', 'Água', false)`,
        [cat, A.id],
      );
      await owner.query(
        `insert into app.despesa_fixa (id, lar_id, descricao, categoria_id, valor_previsto_centavos, dia_vencimento, inicio)
         values ($1, $2, 'Água', $3, 100, 5, '2026-10-01')`,
        [randomUUID(), A.id, cat],
      );
      expect(await codigoDoErro(app, `delete from app.categoria where id = $1`, identidade(A, A.a), [cat])).toBe(FK);
    });
  });
});
