import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  avisarSemBanco,
  comCliente,
  criarBancoDescartavel,
  definirGuc,
  temBanco,
  URL_OWNER,
  type BancoDescartavel,
} from './apoio-banco-teste';
import { purgar, TABELAS_DO_LAR, type CancelamentoAsaas, type OpcoesPurga, type RelatorioPurga } from './purgar';

/**
 * Purga (RN-26: CA-26.3, CA-26.4, CA-26.8, CA-26.10; CA-19.8; CA-23.12 e as pendências das etapas 8 e 10; SDD D-05,
 * E-1, E-2; G-49; TM-PUSH-01; ADR-013). Postgres 17 real, banco descartável.
 *
 * A purga roda com uma role de LOGIN que é membro de `controle_owner`, sem SUPERUSER nem BYPASSRLS: é o owner como
 * será no Neon (no docker local o owner é superusuário e passaria por cima da RLS, escondendo a falta das políticas).
 * Os dados de cada cenário são montados como superusuário, direto no banco, com o mesmo formato que a API grava.
 */
avisarSemBanco();

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date('2026-12-01T12:00:00.000Z');
const atras = (dias: number) => new Date(AGORA.getTime() - dias * DIA).toISOString();

let banco: BancoDescartavel;
let urlPurga: string;
let rolePurga: string;
let su: pg.Client;

/** Asaas falso: guarda os cancelamentos; pode falhar. */
function asaasFalso() {
  const canceladas: string[] = [];
  let falhar = false;
  const cliente: CancelamentoAsaas = {
    async cancelarAssinatura(id) {
      if (falhar) throw new Error('asaas fora do ar');
      canceladas.push(id);
      return 'cancelada';
    },
  };
  return {
    cliente,
    canceladas,
    falhar(sim = true) {
      falhar = sim;
    },
  };
}

async function rodarPurga(opcoes: Partial<OpcoesPurga> = {}): Promise<RelatorioPurga & { log: string[] }> {
  const log: string[] = [];
  const r = await comCliente(urlPurga, (c) =>
    purgar(c, { agora: AGORA, asaas: asaasFalso().cliente, log: (l) => log.push(l), ...opcoes }),
  );
  return { ...r, log };
}

const um = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) =>
  (await su.query<T>(sql, params)).rows[0]!;
const n = async (sql: string, params: unknown[] = []) => (await um<{ n: number }>(sql, params)).n;

interface Usuario {
  id: string;
  email: string;
  nome: string;
}

async function usuario(
  prefixo: string,
  confirmado: Date | null = new Date(atras(400)),
  criado = atras(400),
): Promise<Usuario> {
  const email = `${prefixo}.${randomBytes(4).toString('hex')}@exemplo.com`;
  const nome = `Pessoa ${prefixo}`;
  const r = await um<{ id: string }>(
    `insert into app.usuario (email, nome, senha_hash, email_confirmado_em, criado_em)
     values ($1, $2, 'sem-senha', $3, $4) returning id`,
    [email, nome, confirmado?.toISOString() ?? null, criado],
  );
  // Sessão viva, token e aceite: somem em cascata com o usuário.
  await su.query(
    `insert into app.sessao (token_hash, usuario_id, criada_em, ultimo_uso_em, expira_absoluta_em)
     values ($1, $2, $3, $3, $3::timestamptz + interval '12 hours')`,
    [randomBytes(32), r.id, atras(1)],
  );
  await su.query(
    `insert into app.token_email (usuario_id, finalidade, token_hash, criado_em, expira_em)
     values ($1, 'exclusao', $2, $3, $3::timestamptz + interval '30 minutes')`,
    [r.id, randomBytes(32), atras(31)],
  );
  await su.query(
    `insert into app.aceite_termos (usuario_id, versao_termos, versao_privacidade) values ($1, 'v', 'v')`,
    [r.id],
  );
  return { id: r.id, email, nome };
}

interface Individual {
  membro: string;
  categoria: string;
  conta: string;
  pix: string;
  lancamentoIndividual: string;
  /** Conjunta paga por ele. */
  conjunta: string;
  metaIndividual: string;
  /** Movimento dele na meta conjunta, ligado a um movimento da conta dele. */
  movimentoNaConjunta: string;
}

interface Lar {
  id: string;
  titular: Usuario;
  t: Individual;
  convidado: Usuario | null;
  m: Individual | null;
  mercado: string;
  metaConjunta: string;
  fixa: string;
}

/** O individual de um membro: categoria, conta, Pix, lançamentos, orçamento, meta e movimentos. */
async function individualDe(larId: string, membro: string, mercado: string, metaConjunta: string): Promise<Individual> {
  const categoria = randomUUID();
  await su.query(
    `insert into app.categoria (id, lar_id, tipo, escopo, dono_id, nome, variavel)
     values ($1, $2, 'despesa', 'individual', $3, 'Lazer pessoal', false)`,
    [categoria, larId, membro],
  );
  const conta = randomUUID();
  await su.query(
    `insert into app.conta (id, lar_id, dono_id, nome, saldo_inicial_centavos) values ($1, $2, $3, 'Conta', 1000)`,
    [conta, larId, membro],
  );
  const pix = randomUUID();
  await su.query(
    `insert into app.forma_pagamento (id, lar_id, dono_id, nome, tipo, conta_id) values ($1, $2, $3, 'Pix', 'pix', $4)`,
    [pix, larId, membro, conta],
  );
  const lancar = async (escopo: 'conjunto' | 'individual', cat: string, descricao: string) => {
    const id = randomUUID();
    await su.query(
      `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, descricao, valor_total_centavos, num_parcelas)
       values ($1, $2, $3, 'despesa', $4, $5, $6, 5000, 1)`,
      [id, larId, membro, escopo, cat, descricao],
    );
    await su.query(
      `insert into app.lancamento_pagamento (lancamento_id, lar_id, dono_id, forma_pagamento_id, conta_id, data_operacao)
       values ($1, $2, $3, $4, $5, '2026-10-10')`,
      [id, larId, membro, pix, conta],
    );
    await su.query(
      `insert into app.parcela (lancamento_id, lar_id, escopo, dono_id, numero, valor_centavos, data)
       values ($1, $2, $3, $4, 1, 5000, '2026-10-10')`,
      [id, larId, escopo, membro],
    );
    return id;
  };
  const lancamentoIndividual = await lancar('individual', categoria, 'Cinema secreto');
  const conjunta = await lancar('conjunto', mercado, 'Mercado da semana');
  await su.query(
    `insert into app.orcamento (lar_id, mes, categoria_id, escopo, dono_id, valor_centavos)
     values ($1, '2026-10-01', $2, 'individual', $3, 10000)`,
    [larId, categoria, membro],
  );
  const metaIndividual = randomUUID();
  await su.query(
    `insert into app.meta (id, lar_id, dono_id, nome, alvo_centavos, escopo) values ($1, $2, $3, 'Reserva', 100000, 'individual')`,
    [metaIndividual, larId, membro],
  );
  const mover = async (meta: string) => {
    const id = randomUUID();
    await su.query(
      `insert into app.movimento_meta (id, lar_id, meta_id, tipo, valor_centavos, data, local, autor_id)
       values ($1, $2, $3, 'aporte', 2000, '2026-10-05', 'Cofre', $4)`,
      [id, larId, meta, membro],
    );
    await su.query(
      `insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data, movimento_meta_id)
       values ($1, $2, $3, 'aporte', 'saida', 2000, '2026-10-05', $4)`,
      [larId, membro, conta, id],
    );
    return id;
  };
  await mover(metaIndividual);
  const movimentoNaConjunta = await mover(metaConjunta);
  await su.query(
    `insert into app.movimento_conta (lar_id, dono_id, conta_id, tipo, sentido, valor_centavos, data)
     values ($1, $2, $3, 'ajuste', 'entrada', 500, '2026-10-01')`,
    [larId, membro, conta],
  );
  return { membro, categoria, conta, pix, lancamentoIndividual, conjunta, metaIndividual, movimentoNaConjunta };
}

/** Lar completo: titular (e convidado), conjunto, individuais, fixa paga, convite, assinatura. */
async function montarLar(
  prefixo: string,
  opcoes: { comConvidado?: boolean; assinatura?: { id: string; situacao: string } | null } = {},
): Promise<Lar> {
  const titular = await usuario(`${prefixo}.titular`);
  const larId = randomUUID();
  await su.query(`insert into app.lar (id, nome, criado_por) values ($1, $2, $3)`, [
    larId,
    `Casa ${prefixo}`,
    titular.id,
  ]);
  const mt = await um<{ id: string }>(
    `insert into app.membro (lar_id, usuario_id, nome, papel, entrou_em) values ($1, $2, $3, 'titular', $4) returning id`,
    [larId, titular.id, titular.nome, atras(400)],
  );
  const mercado = randomUUID();
  await su.query(
    `insert into app.categoria (id, lar_id, tipo, escopo, nome, variavel) values ($1, $2, 'despesa', 'conjunto', 'Mercado', true)`,
    [mercado, larId],
  );
  await su.query(
    `insert into app.orcamento (lar_id, mes, categoria_id, escopo, valor_centavos) values ($1, '2026-10-01', $2, 'conjunto', 90000)`,
    [larId, mercado],
  );
  const metaConjunta = randomUUID();
  await su.query(
    `insert into app.meta (id, lar_id, dono_id, nome, alvo_centavos, escopo) values ($1, $2, $3, 'Viagem', 500000, 'conjunto')`,
    [metaConjunta, larId, mt.id],
  );
  const t = await individualDe(larId, mt.id, mercado, metaConjunta);
  // Fixa paga pela conjunta do titular.
  const fixa = randomUUID();
  await su.query(
    `insert into app.despesa_fixa (id, lar_id, descricao, categoria_id, valor_previsto_centavos, dia_vencimento, inicio)
     values ($1, $2, 'Aluguel', $3, 150000, 10, '2026-01-01')`,
    [fixa, larId, mercado],
  );
  await su.query(
    `insert into app.ocorrencia_fixa (lar_id, despesa_fixa_id, mes, vencimento, valor_previsto_centavos, lancamento_id)
     values ($1, $2, '2026-10-01', '2026-10-10', 150000, $3)`,
    [larId, fixa, t.conjunta],
  );
  await su.query(
    `insert into app.convite (lar_id, convidado_por, email, token_hash, lar_nome, convidado_por_nome, criado_em, expira_em)
     values ($1, $2, $3, $4, 'Casa', 'Titular', $5, $5::timestamptz + interval '7 days')`,
    [larId, mt.id, `convidado.${randomBytes(3).toString('hex')}@exemplo.com`, randomBytes(32), atras(2)],
  );
  const a = opcoes.assinatura === undefined ? null : opcoes.assinatura;
  await su.query(
    `insert into app.assinatura (lar_id, situacao, trial_ate, asaas_cliente_id, asaas_assinatura_id)
     values ($1, $2, $3, $4, $5)`,
    [larId, a?.situacao ?? 'trial', atras(300), a ? 'cus_x' : null, a?.id ?? null],
  );
  let convidado: Usuario | null = null;
  let m: Individual | null = null;
  if (opcoes.comConvidado) {
    convidado = await usuario(`${prefixo}.convidado`);
    const mm = await um<{ id: string }>(
      `insert into app.membro (lar_id, usuario_id, nome, papel, entrou_em) values ($1, $2, $3, 'membro', $4) returning id`,
      [larId, convidado.id, convidado.nome, atras(400)],
    );
    m = await individualDe(larId, mm.id, mercado, metaConjunta);
  }
  return { id: larId, titular, t, convidado, m, mercado, metaConjunta, fixa };
}

/** Exclusão confirmada há `dias` dias (purga = confirmação + 30). */
async function excluir(u: Usuario, diasDesdeConfirmacao: number): Promise<string> {
  const confirmada = atras(diasDesdeConfirmacao);
  const r = await um<{ id: string }>(
    `insert into app.exclusao_conta (usuario_id, solicitada_em, confirmada_em, purgar_em)
     values ($1, $2, $2, $2::timestamptz + interval '30 days') returning id`,
    [u.id, confirmada],
  );
  return r.id;
}

/** Saída do membro como a API faz (CA-23.12): `saiu_em`, nome "Ex-membro"; `apagarParte` simula a saída voluntária. */
async function sair(membro: string, dias: number, apagarParte: boolean): Promise<void> {
  if (apagarParte) await su.query(`delete from app.lancamento_pagamento where dono_id = $1`, [membro]);
  await su.query(`update app.membro set saiu_em = $2, nome = 'Ex-membro' where id = $1`, [membro, atras(dias)]);
}

/** Linhas do lar em todas as tabelas com `lar_id`, mais o próprio lar. */
async function linhasDoLar(larId: string): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  for (const t of [...TABELAS_DO_LAR, 'lar']) {
    r[t] = await n(`select count(*)::int as n from app.${t} where ${t === 'lar' ? 'id' : 'lar_id'} = $1`, [larId]);
  }
  return r;
}

async function individualRestante(membro: string): Promise<Record<string, number>> {
  return {
    conta: await n(`select count(*)::int as n from app.conta where dono_id = $1`, [membro]),
    forma: await n(`select count(*)::int as n from app.forma_pagamento where dono_id = $1`, [membro]),
    movimento_conta: await n(`select count(*)::int as n from app.movimento_conta where dono_id = $1`, [membro]),
    pagamento: await n(`select count(*)::int as n from app.lancamento_pagamento where dono_id = $1`, [membro]),
    lancamento_individual: await n(
      `select count(*)::int as n from app.lancamento where dono_id = $1 and escopo = 'individual'`,
      [membro],
    ),
    orcamento: await n(`select count(*)::int as n from app.orcamento where dono_id = $1`, [membro]),
    meta_individual: await n(`select count(*)::int as n from app.meta where dono_id = $1 and escopo = 'individual'`, [
      membro,
    ]),
    categoria: await n(`select count(*)::int as n from app.categoria where dono_id = $1`, [membro]),
  };
}

const ZERADO = {
  conta: 0,
  forma: 0,
  movimento_conta: 0,
  pagamento: 0,
  lancamento_individual: 0,
  orcamento: 0,
  meta_individual: 0,
  categoria: 0,
};

const usuarioExiste = async (u: Usuario) =>
  (await n(`select count(*)::int as n from app.usuario where id = $1`, [u.id])) === 1;

describe.skipIf(!temBanco)('purgar.ts (Postgres 17 real, role owner sem BYPASSRLS)', () => {
  beforeAll(async () => {
    banco = await criarBancoDescartavel('controle_purga');
    rolePurga = `controle_purga_teste_${randomBytes(4).toString('hex')}`;
    const senha = randomBytes(12).toString('hex');
    await comCliente(URL_OWNER as string, (c) =>
      c.query(`create role ${rolePurga} login password '${senha}' nosuperuser nobypassrls in role controle_owner`),
    );
    const u = new URL(banco.owner);
    u.username = rolePurga;
    u.password = senha;
    urlPurga = u.toString();
    su = new pg.Client({ connectionString: banco.owner });
    await su.connect();
  }, 120_000);

  afterAll(async () => {
    await su?.end();
    await banco?.apagar();
    if (rolePurga) await comCliente(URL_OWNER as string, (c) => c.query(`drop role if exists ${rolePurga}`));
  }, 60_000);

  describe('catálogo e políticas (ADR-013)', () => {
    it('a role da purga não é superusuária nem tem BYPASSRLS, e sem o GUC da purga não enxerga nem apaga nada', async () => {
      const l = await montarLar('pol');
      await comCliente(urlPurga, async (c) => {
        const r = (await c.query(`select rolsuper, rolbypassrls from pg_roles where rolname = current_user`)).rows[0];
        expect(r).toEqual({ rolsuper: false, rolbypassrls: false });
        expect((await c.query(`select count(*)::int as n from app.lar where id = $1`, [l.id])).rows[0]).toEqual({
          n: 0,
        });
        expect((await c.query(`delete from app.categoria where lar_id = $1`, [l.id])).rowCount).toBe(0);
        await c.query('begin');
        await c.query(`select set_config('app.sistema', 'cron', true)`);
        expect((await c.query(`select count(*)::int as n from app.lar where id = $1`, [l.id])).rows[0]).toEqual({
          n: 0,
        });
        await c.query(`select set_config('app.sistema', 'purga', true)`);
        expect((await c.query(`select count(*)::int as n from app.lar where id = $1`, [l.id])).rows[0]).toEqual({
          n: 1,
        });
        await c.query('rollback');
      });
      expect((await linhasDoLar(l.id)).categoria).toBeGreaterThan(0);
    });

    it('toda tabela com RLS tem purga_select e purga_delete para o owner, e nada além disso', async () => {
      const r = await su.query<{ relname: string; politicas: string[] }>(
        `select c.relname, array_agg(p.polname::text order by p.polname) filter (where p.polname like 'purga%') as politicas
           from pg_class c left join pg_policy p on p.polrelid = c.oid
          where c.relnamespace = 'app'::regnamespace and c.relkind = 'r' and c.relrowsecurity
          group by c.relname`,
      );
      expect(r.rows.length).toBeGreaterThanOrEqual(17);
      for (const t of r.rows) expect(t.politicas, t.relname).toEqual(['purga_delete', 'purga_select']);
      const papeis = await su.query<{ cmd: string; papeis: string }>(
        `select distinct p.polcmd::text as cmd, pg_get_userbyid(unnest(p.polroles)) as papeis
           from pg_policy p where p.polname like 'purga%'`,
      );
      expect(new Set(papeis.rows.map((x) => x.papeis))).toEqual(new Set(['controle_owner']));
      expect(new Set(papeis.rows.map((x) => x.cmd))).toEqual(new Set(['r', 'd']));
    });

    it('toda tabela com lar_id está na ordem de exclusão do lar (uma tabela nova não fica para trás)', async () => {
      const r = await su.query<{ relname: string }>(
        `select c.relname from pg_class c join pg_attribute a on a.attrelid = c.oid
          where c.relnamespace = 'app'::regnamespace and c.relkind = 'r' and a.attname = 'lar_id' and not a.attisdropped
          order by c.relname`,
      );
      expect(r.rows.map((x) => x.relname).sort()).toEqual([...TABELAS_DO_LAR].sort());
    });

    it('a app não ganha DELETE em usuario, lar, membro, meta, movimento_meta, despesa_fixa nem exclusao_conta', async () => {
      const r = await su.query<{ relname: string; pode: boolean }>(
        `select relname, has_table_privilege('controle_app', oid, 'DELETE') as pode from pg_class
          where relnamespace = 'app'::regnamespace
            and relname in ('usuario', 'lar', 'membro', 'meta', 'movimento_meta', 'despesa_fixa', 'exclusao_conta')`,
      );
      expect(r.rows).toHaveLength(7);
      for (const t of r.rows) expect(t.pode, t.relname).toBe(false);
    });
  });

  describe('exclusão do titular', () => {
    it('antes dos 30 dias nada é apagado (CA-26.10)', async () => {
      const l = await montarLar('cedo');
      const exclusao = await excluir(l.titular, 29);
      const antes = await linhasDoLar(l.id);
      const r = await rodarPurga();
      expect(r.falhas).toEqual([]);
      expect(await linhasDoLar(l.id)).toEqual(antes);
      expect(await usuarioExiste(l.titular)).toBe(true);
      expect(
        await n(`select count(*)::int as n from app.exclusao_conta where id = $1 and purgada_em is null`, [exclusao]),
      ).toBe(1);
    });

    it('sem convidado, depois dos 30 dias: o lar e todos os dados somem, a assinatura é cancelada e o e-mail fica livre (CA-26.3, CA-26.4)', async () => {
      const asaas = asaasFalso();
      const l = await montarLar('sozinho', { assinatura: { id: 'sub_sozinho', situacao: 'ativa' } });
      const exclusao = await excluir(l.titular, 31);
      const r = await rodarPurga({ asaas: asaas.cliente });
      expect(r.falhas).toEqual([]);
      expect(asaas.canceladas).toEqual(['sub_sozinho']);
      const depois = await linhasDoLar(l.id);
      for (const [t, qtd] of Object.entries(depois)) expect(qtd, t).toBe(0);
      expect(await usuarioExiste(l.titular)).toBe(false);
      for (const t of ['sessao', 'token_email', 'aceite_termos']) {
        expect(await n(`select count(*)::int as n from app.${t} where usuario_id = $1`, [l.titular.id]), t).toBe(0);
      }
      // A linha mínima da exclusão fica, marcada como purgada (sem nome nem e-mail).
      const linha = await um<{ purgada_em: Date | null }>(`select purgada_em from app.exclusao_conta where id = $1`, [
        exclusao,
      ]);
      expect(linha.purgada_em?.toISOString()).toBe(AGORA.toISOString());
      // CA-26.4: o mesmo e-mail pode se cadastrar de novo.
      await su.query(`insert into app.usuario (email, nome, senha_hash) values ($1, 'De novo', 'x')`, [
        l.titular.email,
      ]);
    });

    it('assinatura já cancelada (na confirmação) não chama o Asaas de novo', async () => {
      const asaas = asaasFalso();
      const l = await montarLar('jacancelada', { assinatura: { id: 'sub_ja', situacao: 'cancelada' } });
      await excluir(l.titular, 31);
      const r = await rodarPurga({ asaas: asaas.cliente });
      expect(r.falhas).toEqual([]);
      expect(asaas.canceladas).toEqual([]);
      expect((await linhasDoLar(l.id)).lar).toBe(0);
    });

    it('com convidado ativo (D1, CA-26.8): o lar inteiro some, inclusive o individual do convidado, que fica sem lar', async () => {
      const l = await montarLar('d1', { comConvidado: true });
      await excluir(l.titular, 30);
      const r = await rodarPurga();
      expect(r.falhas).toEqual([]);
      const depois = await linhasDoLar(l.id);
      for (const [t, qtd] of Object.entries(depois)) expect(qtd, t).toBe(0);
      expect(await individualRestante(l.m!.membro)).toEqual(ZERADO);
      // O convidado continua com a conta, sem vínculo nenhum: no próximo acesso cai no primeiro acesso (RN-22).
      expect(await usuarioExiste(l.convidado!)).toBe(true);
      expect(await n(`select count(*)::int as n from app.membro where usuario_id = $1`, [l.convidado!.id])).toBe(0);
      expect(await n(`select count(*)::int as n from app.sessao where usuario_id = $1`, [l.convidado!.id])).toBe(1);
      // E pode criar um lar novo como titular, pela própria RLS da app.
      await comCliente(banco.app, async (c) => {
        await c.query('begin');
        await definirGuc(c, { usuario: l.convidado!.id, email: l.convidado!.email });
        const lar = (
          await c.query(`insert into app.lar (nome, criado_por) values ('Novo', $1) returning id`, [l.convidado!.id])
        ).rows[0];
        await c.query(`insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, $2, 'Bia', 'titular')`, [
          lar.id,
          l.convidado!.id,
        ]);
        await c.query('rollback');
      });
    });

    it('apaga também o lar descartado no aceite de convite, criado pelo mesmo usuário', async () => {
      const outro = await montarLar('descarte.outro');
      const u = await usuario('descarte');
      const descartado = randomUUID();
      await su.query(`insert into app.lar (id, nome, criado_por) values ($1, 'Antigo', $2)`, [descartado, u.id]);
      await su.query(
        `insert into app.membro (lar_id, usuario_id, nome, papel, entrou_em, saiu_em)
         values ($1, $2, 'Ex-membro', 'titular', $3, $4)`,
        [descartado, u.id, atras(400), atras(60)],
      );
      await su.query(`insert into app.assinatura (lar_id, situacao, trial_ate) values ($1, 'trial', $2)`, [
        descartado,
        atras(40),
      ]);
      const m = await um<{ id: string }>(
        `insert into app.membro (lar_id, usuario_id, nome, papel, entrou_em) values ($1, $2, 'Novo membro', 'membro', $3) returning id`,
        [outro.id, u.id, atras(50)],
      );
      await sair(m.id, 31, true);
      await excluir(u, 31);
      const r = await rodarPurga();
      expect(r.falhas).toEqual([]);
      expect((await linhasDoLar(descartado)).lar).toBe(0);
      expect(await usuarioExiste(u)).toBe(false);
      expect((await linhasDoLar(outro.id)).lar).toBe(1);
    });
  });

  describe('convidado que excluiu a conta e ex-membros (CA-23.12, E-2)', () => {
    it('convidado excluído: o individual some, a conjunta que pagou e o movimento na meta conjunta ficam (sem a conta); o titular segue', async () => {
      const l = await montarLar('convexc', { comConvidado: true });
      const m = l.m!;
      await sair(m.membro, 31, true); // a confirmação faz a saída (CA-23.12)
      await excluir(l.convidado!, 31);
      const titularAntes = await individualRestante(l.t.membro);
      const r = await rodarPurga();
      expect(r.falhas).toEqual([]);
      expect(await individualRestante(m.membro)).toEqual(ZERADO);
      expect(await usuarioExiste(l.convidado!)).toBe(false);
      // A linha de membro fica como "Ex-membro", sem usuário.
      expect(await um(`select nome, usuario_id from app.membro where id = $1`, [m.membro])).toEqual({
        nome: 'Ex-membro',
        usuario_id: null,
      });
      expect(await n(`select count(*)::int as n from app.lancamento where id = $1`, [m.conjunta])).toBe(1);
      expect(await n(`select count(*)::int as n from app.parcela where lancamento_id = $1`, [m.conjunta])).toBe(1);
      expect(await n(`select count(*)::int as n from app.movimento_meta where id = $1`, [m.movimentoNaConjunta])).toBe(
        1,
      );
      expect(
        await n(`select count(*)::int as n from app.movimento_conta where movimento_meta_id = $1`, [
          m.movimentoNaConjunta,
        ]),
      ).toBe(0);
      // O titular e o conjunto ficam intactos.
      expect(await individualRestante(l.t.membro)).toEqual(titularAntes);
      expect((await linhasDoLar(l.id)).lar).toBe(1);
      expect(await usuarioExiste(l.titular)).toBe(true);
    });

    it('membro removido pelo titular há 30 dias: a parte privada e os movimentos de conta somem (pendências das etapas 8 e 10); a conta de usuário fica', async () => {
      const l = await montarLar('removido', { comConvidado: true });
      const m = l.m!;
      await sair(m.membro, 30, false); // remoção: a parte privada ficou até a purga
      expect((await individualRestante(m.membro)).pagamento).toBe(2);
      const r = await rodarPurga();
      expect(r.falhas).toEqual([]);
      expect(await individualRestante(m.membro)).toEqual(ZERADO);
      expect(r.ex_membros_purgados).toBeGreaterThanOrEqual(1);
      expect(await usuarioExiste(l.convidado!)).toBe(true);
      expect(await n(`select count(*)::int as n from app.lancamento where id = $1`, [m.conjunta])).toBe(1);
      expect(await n(`select count(*)::int as n from app.ocorrencia_fixa where despesa_fixa_id = $1`, [l.fixa])).toBe(
        1,
      );
    });

    it('ex-membro há 29 dias: nada é apagado ainda', async () => {
      const l = await montarLar('recente', { comConvidado: true });
      await sair(l.m!.membro, 29, true);
      const antes = await individualRestante(l.m!.membro);
      await rodarPurga();
      expect(await individualRestante(l.m!.membro)).toEqual(antes);
      expect(antes.conta).toBe(1);
    });
  });

  describe('falha do Asaas, idempotência e reexecução', () => {
    it('Asaas fora do ar: nada desse usuário é apagado (nem o lar descartado), a falha vai ao relatório e a próxima execução termina', async () => {
      const asaas = asaasFalso();
      const l = await montarLar('asaasfalha', { assinatura: { id: 'sub_falha', situacao: 'ativa' } });
      const descartado = randomUUID();
      await su.query(`insert into app.lar (id, nome, criado_por) values ($1, 'Antigo', $2)`, [
        descartado,
        l.titular.id,
      ]);
      const exclusao = await excluir(l.titular, 31);
      const outro = await montarLar('asaasfalha.outro');
      await excluir(outro.titular, 31);
      const antes = await linhasDoLar(l.id);

      asaas.falhar();
      const r1 = await rodarPurga({ asaas: asaas.cliente });
      expect(r1.falhas).toEqual([{ unidade: 'exclusao', id: exclusao, motivo: 'asaas_indisponivel' }]);
      expect(await linhasDoLar(l.id)).toEqual(antes);
      expect((await linhasDoLar(descartado)).lar).toBe(1);
      expect(await usuarioExiste(l.titular)).toBe(true);
      // A outra exclusão da mesma execução foi purgada.
      expect(await usuarioExiste(outro.titular)).toBe(false);

      asaas.falhar(false);
      const r2 = await rodarPurga({ asaas: asaas.cliente });
      expect(r2.falhas).toEqual([]);
      expect(asaas.canceladas).toEqual(['sub_falha']);
      expect((await linhasDoLar(l.id)).lar).toBe(0);
      expect((await linhasDoLar(descartado)).lar).toBe(0);
      expect(await usuarioExiste(l.titular)).toBe(false);
    });

    it('sem Asaas configurado: lar com assinatura ativa fica para depois (asaas_sem_configuracao)', async () => {
      const l = await montarLar('semasaas', { assinatura: { id: 'sub_sem', situacao: 'atrasada' } });
      const exclusao = await excluir(l.titular, 31);
      const r = await rodarPurga({ asaas: null });
      expect(r.falhas).toContainEqual({ unidade: 'exclusao', id: exclusao, motivo: 'asaas_sem_configuracao' });
      expect((await linhasDoLar(l.id)).lar).toBe(1);
    });

    it('idempotente: a segunda execução não apaga nada nem falha', async () => {
      const l = await montarLar('idem', { comConvidado: true });
      await excluir(l.titular, 31);
      const r1 = await rodarPurga();
      expect(r1.exclusoes_purgadas).toBeGreaterThanOrEqual(1);
      const r2 = await rodarPurga();
      expect(r2.falhas).toEqual([]);
      expect(r2.exclusoes_purgadas).toBe(0);
      expect(r2.ex_membros_purgados).toBe(0);
      expect(r2.linhas).toEqual({});
    });

    it('limite por execução: com limite 1 e 2 exclusões vencidas, a segunda fica para a execução seguinte', async () => {
      // Esvazia as pendências de outros testes antes de medir.
      await rodarPurga();
      const a = await montarLar('lim.a');
      const b = await montarLar('lim.b');
      await excluir(a.titular, 32);
      await excluir(b.titular, 31);
      const r1 = await rodarPurga({ limite: 1 });
      expect(r1.exclusoes_purgadas).toBe(1);
      expect(await usuarioExiste(a.titular)).toBe(false);
      expect(await usuarioExiste(b.titular)).toBe(true);
      const r2 = await rodarPurga({ limite: 1 });
      expect(r2.exclusoes_purgadas).toBe(1);
      expect(await usuarioExiste(b.titular)).toBe(false);
    });
  });

  describe('isolamento: outro lar nunca é afetado (TM-PUSH-01, RT-01)', () => {
    it('purgar o lar A não muda uma linha do lar B nem os usuários de B', async () => {
      const a = await montarLar('iso.a', { comConvidado: true, assinatura: { id: 'sub_iso', situacao: 'ativa' } });
      const b = await montarLar('iso.b', { comConvidado: true, assinatura: { id: 'sub_iso_b', situacao: 'ativa' } });
      await excluir(a.titular, 31);
      // B tem um pedido NÃO confirmado: não conta.
      await su.query(`insert into app.exclusao_conta (usuario_id, solicitada_em) values ($1, $2)`, [
        b.titular.id,
        atras(90),
      ]);
      const antesB = await linhasDoLar(b.id);
      const asaas = asaasFalso();
      await rodarPurga({ asaas: asaas.cliente });
      expect(await linhasDoLar(b.id)).toEqual(antesB);
      expect(await usuarioExiste(b.titular)).toBe(true);
      expect(await usuarioExiste(b.convidado!)).toBe(true);
      expect(asaas.canceladas).toEqual(['sub_iso']);
      expect((await linhasDoLar(a.id)).lar).toBe(0);
    });
  });

  describe('contas não confirmadas (CA-19.8) e poda (RN-26)', () => {
    it('apaga conta não confirmada com 7 dias ou mais; mantém a de 6 dias e as confirmadas antigas', async () => {
      const velha = await usuario('naoconf.velha', null, atras(8));
      const nova = await usuario('naoconf.nova', null, atras(6));
      const confirmada = await usuario('naoconf.confirmada', new Date(atras(100)), atras(100));
      const r = await rodarPurga();
      expect(r.contas_nao_confirmadas).toBeGreaterThanOrEqual(1);
      expect(await usuarioExiste(velha)).toBe(false);
      expect(await usuarioExiste(nova)).toBe(true);
      expect(await usuarioExiste(confirmada)).toBe(true);
    });

    it('poda tentativas, tokens e sessões vencidos há mais de 30 dias e eventos do webhook com mais de 12 meses', async () => {
      const u = await usuario('poda');
      const h = () => randomBytes(32);
      await su.query(
        `insert into app.tentativa_login (email_hash, sucesso, momento) values ($1, false, $2), ($3, false, $4)`,
        [h(), atras(31), h(), atras(29)],
      );
      await su.query(
        `insert into app.sessao (token_hash, usuario_id, criada_em, ultimo_uso_em, expira_absoluta_em)
         values ($1, $3, $4, $4, $4::timestamptz + interval '12 hours'), ($2, $3, $5, $5, $5::timestamptz + interval '12 hours')`,
        [h(), h(), u.id, atras(32), atras(20)],
      );
      await su.query(
        `insert into app.webhook_evento (event_id, tipo, ocorrido_em, recebido_em)
         values ('evt_velho_poda', 'PAYMENT_CREATED', $1, $1), ('evt_novo_poda', 'PAYMENT_CREATED', $2, $2)`,
        [atras(400), atras(300)],
      );
      const r = await rodarPurga();
      expect(r.falhas).toEqual([]);
      expect(await n(`select count(*)::int as n from app.tentativa_login where momento < $1`, [atras(30)])).toBe(0);
      expect(await n(`select count(*)::int as n from app.tentativa_login where momento = $1`, [atras(29)])).toBe(1);
      // Sessão vencida há 32 dias some; a de 20 dias fica; a token de exclusão (vencido há 31 dias) some.
      expect(
        await n(`select count(*)::int as n from app.sessao where usuario_id = $1 and criada_em = $2`, [
          u.id,
          atras(32),
        ]),
      ).toBe(0);
      expect(
        await n(`select count(*)::int as n from app.sessao where usuario_id = $1 and criada_em = $2`, [
          u.id,
          atras(20),
        ]),
      ).toBe(1);
      expect(await n(`select count(*)::int as n from app.token_email where usuario_id = $1`, [u.id])).toBe(0);
      expect(await n(`select count(*)::int as n from app.webhook_evento where event_id = 'evt_velho_poda'`)).toBe(0);
      expect(await n(`select count(*)::int as n from app.webhook_evento where event_id = 'evt_novo_poda'`)).toBe(1);
      expect(r.webhook_eventos).toBeGreaterThanOrEqual(1);
      expect(await usuarioExiste(u)).toBe(true);
    });
  });

  describe('relatório e log sem dado pessoal (G-46, G-50)', () => {
    it('o log leva só contagens e ids técnicos: nenhum e-mail, nome ou descrição', async () => {
      const asaas = asaasFalso();
      const l = await montarLar('log', { comConvidado: true, assinatura: { id: 'sub_log', situacao: 'ativa' } });
      await excluir(l.titular, 31);
      const falha = await montarLar('log.falha', { assinatura: { id: 'sub_log_falha', situacao: 'ativa' } });
      await excluir(falha.titular, 31);
      asaas.falhar();
      const r = await rodarPurga({ asaas: asaas.cliente });
      const texto = r.log.join('\n');
      expect(texto).toContain('purga_concluida');
      expect(texto).toContain('purga_falhou');
      for (const p of [l.titular, l.convidado!, falha.titular]) {
        expect(texto).not.toContain(p.email);
        expect(texto).not.toContain(p.nome);
      }
      expect(texto).not.toMatch(/@/);
      expect(texto).not.toContain('Cinema secreto');
      expect(texto).not.toContain('Mercado da semana');
      for (const linha of r.log) expect(() => JSON.parse(linha)).not.toThrow();
    });
  });
});
