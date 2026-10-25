import { createHash, randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { FIXAS, FORMAS, planejarMassa, type Quem } from './massa-plano';
import { hostEhLocal } from './seed';

/**
 * Grava a massa sintética de 2 anos (PLANO etapa 9; SDD 10 "Medição") num lar NOVO do banco local, como owner, e
 * imprime os cookies de sessão de Ana e Bruno para medir a CPU no `wrangler dev` (`medir-cpu.ts`).
 * Só roda em banco local (como o seed). Cada execução cria um lar novo com e-mails aleatórios; não mexe em mais
 * nada. As sessões valem 12 h (e expiram com 15 min sem uso): são de teste local, nunca de produção.
 * Uso: `pnpm --filter @controle/scripts massa` (lê DATABASE_URL_OWNER do .env).
 */

const CONJUNTAS: [string, boolean][] = [
  ['Mercado', true],
  ['Delivery/iFood do casal', true],
  ['Moradia', false],
  ['Contas da casa', false],
  ['Outros da casa', false],
  ['Almoço/Alimentação fora', true],
];
const INDIVIDUAIS: [string, boolean][] = [
  ['Delivery pessoal', true],
  ['Transporte', true],
  ['Lazer pessoal', true],
  ['Outros', false],
];
const RECEITAS = ['Salário', 'Extra', 'Outros'];

function hojeEmSaoPaulo(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p['year']}-${p['month']}-${p['day']}`;
}

async function principal(): Promise<void> {
  const url = process.env['DATABASE_URL_OWNER'];
  if (!url) throw new Error('Defina DATABASE_URL_OWNER (veja .env.example).');
  if (!hostEhLocal(url)) throw new Error('A massa só roda em banco local.');
  const hoje = hojeEmSaoPaulo();
  const [anoHoje, mesHoje] = hoje.split('-').map(Number) as [number, number];
  const plano = planejarMassa(hoje);
  const sufixo = randomBytes(3).toString('hex');

  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('begin');
    const membros = {} as Record<Quem, { usuario: string; membro: string; email: string }>;
    const larId = randomUUID();
    for (const quem of ['ana', 'bruno'] as const) {
      const email = `${quem}.massa.${sufixo}@exemplo.local`;
      const u = await c.query<{ id: string }>(
        `insert into app.usuario (email, nome, senha_hash, email_confirmado_em) values ($1, $2, 'sem-senha', now()) returning id`,
        [email, quem === 'ana' ? 'Ana (massa)' : 'Bruno (massa)'],
      );
      const usuario = u.rows[0]!.id;
      await c.query(
        `insert into app.aceite_termos (usuario_id, versao_termos, versao_privacidade) values ($1, 'massa', 'massa')`,
        [usuario],
      );
      if (quem === 'ana')
        await c.query(`insert into app.lar (id, nome, criado_por) values ($1, 'Lar da massa', $2)`, [larId, usuario]);
      const m = await c.query<{ id: string }>(
        `insert into app.membro (lar_id, usuario_id, nome, papel) values ($1, $2, $3, $4) returning id`,
        [larId, usuario, quem === 'ana' ? 'Ana' : 'Bruno', quem === 'ana' ? 'titular' : 'membro'],
      );
      membros[quem] = { usuario, membro: m.rows[0]!.id, email };
    }

    const categorias = new Map<string, string>();
    const categoria = async (
      nome: string,
      tipo: string,
      escopo: string,
      dono: string | null,
      variavel: boolean | null,
    ) => {
      const id = randomUUID();
      await c.query(
        `insert into app.categoria (id, lar_id, tipo, escopo, dono_id, nome, variavel) values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, larId, tipo, escopo, dono, nome, variavel],
      );
      return id;
    };
    for (const [nome, v] of CONJUNTAS)
      categorias.set(`conjunto:${nome}`, await categoria(nome, 'despesa', 'conjunto', null, v));
    const contas = {} as Record<Quem, string>;
    const formas = {} as Record<Quem, string[]>;
    for (const quem of ['ana', 'bruno'] as const) {
      const dono = membros[quem].membro;
      for (const [nome, v] of INDIVIDUAIS)
        categorias.set(`${quem}:${nome}`, await categoria(nome, 'despesa', 'individual', dono, v));
      for (const nome of RECEITAS)
        categorias.set(`${quem}:receita:${nome}`, await categoria(nome, 'receita', 'individual', dono, null));
      contas[quem] = randomUUID();
      await c.query(
        `insert into app.conta (id, lar_id, dono_id, nome, saldo_inicial_centavos) values ($1, $2, $3, 'Conta', 500000)`,
        [contas[quem], larId, dono],
      );
      formas[quem] = [];
      for (const f of FORMAS) {
        const id = randomUUID();
        await c.query(
          `insert into app.forma_pagamento (id, lar_id, dono_id, nome, tipo, conta_id, dia_vencimento) values ($1, $2, $3, $4, $5, $6, $7)`,
          [id, larId, dono, f.nome, f.tipo, f.tipo === 'credito' ? null : contas[quem], f.dia],
        );
        formas[quem].push(id);
      }
    }

    const fixas: string[] = [];
    const inicio = `${anoHoje - 2}-${String(mesHoje).padStart(2, '0')}-01`;
    for (const f of FIXAS) {
      const id = randomUUID();
      await c.query(
        `insert into app.despesa_fixa (id, lar_id, descricao, categoria_id, valor_previsto_centavos, dia_vencimento, inicio)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, larId, f.descricao, categorias.get(`conjunto:${f.categoria}`), f.previsto, f.dia, inicio],
      );
      fixas.push(id);
    }

    // Lançamentos, partes privadas e parcelas em lote (unnest).
    const L = {
      id: [] as string[],
      dono: [] as string[],
      tipo: [] as string[],
      escopo: [] as string[],
      cat: [] as string[],
      valor: [] as string[],
      n: [] as number[],
    };
    const P = {
      lanc: [] as string[],
      dono: [] as string[],
      forma: [] as (string | null)[],
      conta: [] as (string | null)[],
      data: [] as string[],
      dia: [] as (number | null)[],
    };
    const Q = {
      lanc: [] as string[],
      escopo: [] as string[],
      dono: [] as string[],
      numero: [] as number[],
      valor: [] as string[],
      data: [] as string[],
    };
    const O = {
      fixa: [] as string[],
      mes: [] as string[],
      venc: [] as string[],
      prev: [] as string[],
      lanc: [] as string[],
    };
    for (const l of plano) {
      const id = randomUUID();
      const dono = membros[l.quem].membro;
      const chave =
        l.tipo === 'receita'
          ? `${l.quem}:receita:${l.categoria}`
          : l.escopo === 'conjunto'
            ? `conjunto:${l.categoria}`
            : `${l.quem}:${l.categoria}`;
      L.id.push(id);
      L.dono.push(dono);
      L.tipo.push(l.tipo);
      L.escopo.push(l.escopo);
      L.cat.push(categorias.get(chave)!);
      L.valor.push(String(l.valorTotal));
      L.n.push(l.parcelas.length);
      const forma = l.forma === null ? null : FORMAS[l.forma]!;
      P.lanc.push(id);
      P.dono.push(dono);
      P.forma.push(l.forma === null ? null : formas[l.quem][l.forma]!);
      P.conta.push(forma?.tipo === 'credito' ? null : contas[l.quem]);
      P.data.push(l.dataOperacao);
      P.dia.push(forma?.dia ?? null);
      for (const p of l.parcelas) {
        Q.lanc.push(id);
        Q.escopo.push(l.escopo);
        Q.dono.push(dono);
        Q.numero.push(p.numero);
        Q.valor.push(String(p.valor));
        Q.data.push(p.data);
      }
      if (l.fixa !== null) {
        O.fixa.push(fixas[l.fixa]!);
        O.mes.push(`${l.dataOperacao.slice(0, 7)}-01`);
        O.venc.push(l.dataOperacao);
        O.prev.push(String(FIXAS[l.fixa]!.previsto));
        O.lanc.push(id);
      }
    }
    await c.query(
      `insert into app.lancamento (id, lar_id, dono_id, tipo, escopo, categoria_id, valor_total_centavos, num_parcelas)
       select x.id, $1, x.dono, x.tipo, x.escopo, x.cat, x.valor, x.n
         from unnest($2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::uuid[], $7::bigint[], $8::smallint[]) as x(id, dono, tipo, escopo, cat, valor, n)`,
      [larId, L.id, L.dono, L.tipo, L.escopo, L.cat, L.valor, L.n],
    );
    await c.query(
      `insert into app.lancamento_pagamento (lancamento_id, lar_id, dono_id, forma_pagamento_id, conta_id, data_operacao, dia_vencimento_aplicado)
       select x.l, $1, x.dono, x.forma, x.conta, x.data, x.dia
         from unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::uuid[], $6::date[], $7::smallint[]) as x(l, dono, forma, conta, data, dia)`,
      [larId, P.lanc, P.dono, P.forma, P.conta, P.data, P.dia],
    );
    await c.query(
      `insert into app.parcela (lancamento_id, lar_id, escopo, dono_id, numero, valor_centavos, data)
       select x.l, $1, x.escopo, x.dono, x.numero, x.valor, x.data
         from unnest($2::uuid[], $3::text[], $4::uuid[], $5::smallint[], $6::bigint[], $7::date[]) as x(l, escopo, dono, numero, valor, data)`,
      [larId, Q.lanc, Q.escopo, Q.dono, Q.numero, Q.valor, Q.data],
    );
    await c.query(
      `insert into app.ocorrencia_fixa (lar_id, despesa_fixa_id, mes, vencimento, valor_previsto_centavos, lancamento_id)
       select $1, x.fixa, x.mes, x.venc, x.prev, x.l
         from unnest($2::uuid[], $3::date[], $4::date[], $5::bigint[], $6::uuid[]) as x(fixa, mes, venc, prev, l)`,
      [larId, O.fixa, O.mes, O.venc, O.prev, O.lanc],
    );

    const cookies: string[] = [];
    for (const quem of ['ana', 'bruno'] as const) {
      const token = randomBytes(32).toString('base64url');
      await c.query(
        `insert into app.sessao (token_hash, usuario_id, criada_em, ultimo_uso_em, expira_absoluta_em)
         values ($1, $2, now(), now(), now() + interval '12 hours')`,
        [createHash('sha256').update(token).digest(), membros[quem].usuario],
      );
      cookies.push(`${quem}: __Host-sid=${token}`);
    }
    await c.query('commit');
    console.log(
      `Massa gravada no lar ${larId}: ${L.id.length} lançamentos, ${Q.lanc.length} parcelas, ${O.lanc.length} fixas pagas.`,
    );
    console.log('Cookies de sessão (só locais; valem até 15 min sem uso):');
    for (const k of cookies) console.log(`  ${k}`);
  } catch (erro) {
    await c.query('rollback');
    throw erro;
  } finally {
    await c.end();
  }
}

if (import.meta.main) {
  principal().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : 'Erro ao gravar a massa.');
    process.exit(1);
  });
}
