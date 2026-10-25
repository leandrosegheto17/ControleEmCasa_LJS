import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import { bancoDisponivel } from './testes-suporte';
import { assinaturaDaResposta } from './testes-suporte-acesso';
import { lancarDespesa, larParaLancar, novoId, parcelasNoBanco, type App } from './testes-suporte-lancamentos';
import { linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';

/**
 * Teste negativo de isolamento POR ROTA dos lançamentos (PLANO etapa 8; SDD 12.2 itens 1 a 3; G-05, G-10, G-11;
 * CA-T1.1, CA-T1.2, CA-T1.5; TM-API-04; R3). Atacantes: (1) alguém de OUTRO LAR; (2) o OUTRO MEMBRO do mesmo lar,
 * contra o individual da vítima e contra a parte privada da conjunta dela. Nenhum lê nem altera; o erro de recurso
 * alheio é idêntico ao de um id inexistente; nenhuma resposta traz forma, conta ou valor individual da vítima.
 * A tabela de casos é conferida contra o registro de rotas do app: rota nova de lançamento sem caso falha o teste.
 */

interface Cenario {
  app: App;
  vitima: Pessoa;
  atacantes: { nome: string; quem: Pessoa; deFora: boolean }[];
  ids: {
    individual: string;
    outroIndividual: string;
    conjunta: string;
    parcelaIndividual: string;
    parcelaConjunta: string;
    categoriaIndividual: string;
  };
  /** Nada disso pode aparecer em resposta a um atacante (privado da vítima). */
  segredos: string[];
  /** Isso só o atacante de fora não pode ver (a conjunta é visível ao outro membro). */
  segredosDaConjunta: string[];
}

async function cenario(): Promise<Cenario> {
  const l = await larParaLancar('lanc.iso.a');
  const fora = await larParaLancar('lanc.iso.b');
  const individual = await lancarDespesa(l.app, l.titular, {
    valor_centavos: 424_242,
    categoria_id: l.ana.lazer,
    forma_id: l.ana.credito,
    parcelas: 2,
    data: '2026-10-15',
    descricao: 'Segredo-individual',
  });
  const outroIndividual = await lancarDespesa(l.app, l.titular, {
    valor_centavos: 515_151,
    categoria_id: l.ana.lazer,
    forma_id: l.ana.pix,
    data: '2026-10-16',
  });
  const conjunta = await lancarDespesa(l.app, l.titular, {
    valor_centavos: 636_363,
    categoria_id: l.ana.mercado,
    forma_id: l.ana.credito,
    parcelas: 2,
    data: '2026-10-15',
    descricao: 'Conjunta-da-casa',
  });
  return {
    app: l.app,
    vitima: l.titular,
    atacantes: [
      { nome: 'de outro lar', quem: fora.titular, deFora: true },
      { nome: 'o outro membro do mesmo lar', quem: l.membro, deFora: false },
    ],
    ids: {
      individual,
      outroIndividual,
      conjunta,
      parcelaIndividual: (await parcelasNoBanco(individual))[0]!.id,
      parcelaConjunta: (await parcelasNoBanco(conjunta))[0]!.id,
      categoriaIndividual: l.ana.lazer,
    },
    segredos: [
      individual,
      outroIndividual,
      'Segredo-individual',
      '424242',
      '515151',
      '212121', // parcela do individual
      l.ana.credito,
      l.ana.pix,
      l.ana.conta,
      l.ana.lazer,
    ],
    segredosDaConjunta: [conjunta, 'Conjunta-da-casa', '636363', '318182'],
  };
}

/** Retrato dos lançamentos da vítima como o owner os vê: qualquer escrita do atacante muda o retrato. */
async function retrato(vitima: Pessoa) {
  return linhasComoOwner(
    sql<{ l: unknown; p: unknown; pg: unknown }>`
      with d as (select m.id from app.membro m where m.usuario_id = ${vitima.id} and m.saiu_em is null)
      select (select json_agg(x order by x.id) from (select id, escopo, categoria_id, descricao, valor_total_centavos,
                     num_parcelas, alterado_por from app.lancamento where dono_id = (select id from d)) x) as l,
             (select json_agg(x order by x.id) from (select id, lancamento_id, valor_centavos, data, data_ajustada
                     from app.parcela where dono_id = (select id from d)) x) as p,
             (select json_agg(x order by x.lancamento_id) from (select * from app.lancamento_pagamento
                     where dono_id = (select id from d)) x) as pg`,
  );
}

async function semMudanca(vitima: Pessoa, acao: () => Promise<void>): Promise<void> {
  const antes = await retrato(vitima);
  await acao();
  expect(await retrato(vitima)).toEqual(antes);
}

async function mesmaResposta(alheio: () => Promise<Response>, inexistente: () => Promise<Response>): Promise<void> {
  const a = await assinaturaDaResposta(await alheio());
  const b = await assinaturaDaResposta(await inexistente());
  expect(a).toEqual(b);
  expect(a.status).toBe(404);
  expect(JSON.parse(a.corpo)).toMatchObject({ code: 'registro_invalido' });
}

async function semSegredo(c: Cenario, quem: Cenario['atacantes'][number], r: Response, rota: string) {
  // Os filtros ecoados são o que o próprio atacante enviou: não contam como vazamento.
  const corpo = (await r.json()) as Record<string, unknown>;
  const texto = JSON.stringify({ ...corpo, filtros: null });
  for (const s of c.segredos) expect(texto, `${rota} vaza ${s}`).not.toContain(s);
  if (quem.deFora) for (const s of c.segredosDaConjunta) expect(texto, `${rota} vaza ${s}`).not.toContain(s);
}

/** Ids invisíveis ao atacante: o individual sempre; a conjunta só para quem é de fora. */
const alvos = (c: Cenario, a: Cenario['atacantes'][number]) =>
  a.deFora ? [c.ids.individual, c.ids.conjunta] : [c.ids.individual];

const CASOS: Record<string, (c: Cenario) => Promise<void>> = {
  'GET /api/lancamentos/dados': async (c) => {
    for (const a of c.atacantes)
      await semSegredo(c, a, await pedir(c.app, 'GET', '/api/lancamentos/dados', a.quem), 'dados');
  },
  'GET /api/lancamentos': async (c) => {
    for (const a of c.atacantes) {
      for (const mes of ['2026-10-01', '2026-11-01', '2026-12-01']) {
        for (const filtro of ['', '&escopo=individual', `&categoria_id=${c.ids.categoriaIndividual}`]) {
          await semSegredo(c, a, await pedir(c.app, 'GET', `/api/lancamentos?mes=${mes}${filtro}`, a.quem), 'lista');
        }
      }
    }
  },
  'POST /api/lancamentos/despesas': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const a of c.atacantes) {
        for (const id of alvos(c, a)) {
          // o atacante tenta gravar por cima do id da vítima, com categoria e forma que ele não vê
          await mesmaResposta(
            () =>
              pedir(c.app, 'POST', '/api/lancamentos/despesas', a.quem, {
                id,
                valor_centavos: 1,
                categoria_id: novoId(),
                forma_id: novoId(),
              }),
            () =>
              pedir(c.app, 'POST', '/api/lancamentos/despesas', a.quem, {
                id: c.ids.outroIndividual,
                valor_centavos: 1,
                categoria_id: novoId(),
                forma_id: novoId(),
              }),
          );
        }
      }
    });
  },
  'POST /api/lancamentos/receitas': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const a of c.atacantes) {
        for (const id of alvos(c, a)) {
          await mesmaResposta(
            () =>
              pedir(c.app, 'POST', '/api/lancamentos/receitas', a.quem, {
                id,
                valor_centavos: 1,
                categoria_id: novoId(),
                conta_id: novoId(),
              }),
            () =>
              pedir(c.app, 'POST', '/api/lancamentos/receitas', a.quem, {
                id: c.ids.outroIndividual,
                valor_centavos: 1,
                categoria_id: novoId(),
                conta_id: novoId(),
              }),
          );
        }
      }
    });
  },
  'GET /api/lancamentos/:id': async (c) => {
    for (const a of c.atacantes) {
      for (const id of alvos(c, a)) {
        await mesmaResposta(
          () => pedir(c.app, 'GET', `/api/lancamentos/${id}`, a.quem),
          () => pedir(c.app, 'GET', `/api/lancamentos/${novoId()}`, a.quem),
        );
      }
      if (!a.deFora) {
        // SDD 12.2 item 3: a conjunta vista pelo outro membro não tem as chaves privadas
        const r = await pedir(c.app, 'GET', `/api/lancamentos/${c.ids.conjunta}`, a.quem);
        const corpo = (await r.clone().json()) as Record<string, unknown> & { parcelas: Record<string, unknown>[] };
        expect('pagamento' in corpo).toBe(false);
        for (const p of corpo.parcelas) expect('data_ajustada' in p).toBe(false);
        await semSegredo(c, a, r, 'detalhe da conjunta');
      }
    }
  },
  'PATCH /api/lancamentos/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const a of c.atacantes) {
        for (const id of alvos(c, a)) {
          await mesmaResposta(
            () =>
              pedir(c.app, 'PATCH', `/api/lancamentos/${id}`, a.quem, {
                descricao: 'Invadida',
                valor_total_centavos: 2,
              }),
            () =>
              pedir(c.app, 'PATCH', `/api/lancamentos/${novoId()}`, a.quem, {
                descricao: 'Invadida',
                valor_total_centavos: 2,
              }),
          );
        }
      }
    });
  },
  'DELETE /api/lancamentos/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const a of c.atacantes) {
        for (const id of alvos(c, a)) {
          await mesmaResposta(
            () => pedir(c.app, 'DELETE', `/api/lancamentos/${id}`, a.quem),
            () => pedir(c.app, 'DELETE', `/api/lancamentos/${novoId()}`, a.quem),
          );
        }
      }
    });
  },
  'PATCH /api/parcelas/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const a of c.atacantes) {
        // a parcela da conjunta é VISÍVEL ao outro membro, mas o ajuste é só do pagador
        for (const id of [c.ids.parcelaIndividual, c.ids.parcelaConjunta]) {
          await mesmaResposta(
            () => pedir(c.app, 'PATCH', `/api/parcelas/${id}`, a.quem, { data: '2026-12-31' }),
            () => pedir(c.app, 'PATCH', `/api/parcelas/${novoId()}`, a.quem, { data: '2026-12-31' }),
          );
        }
      }
    });
  },
};

describe('cobertura do isolamento por rota dos lançamentos (G-05)', () => {
  it('toda rota de lançamento e de parcela registrada no app tem caso negativo', () => {
    const app = criarApp();
    const registradas = new Set(
      app.routes
        .filter((r) => r.method !== 'ALL' && /^\/api\/(lancamentos|parcelas)(\/|$)/.test(r.path))
        .map((r) => `${r.method} ${r.path}`),
    );
    expect([...registradas].sort()).toEqual(Object.keys(CASOS).sort());
  });
});

describe.skipIf(!bancoDisponivel)('lançamentos da vítima × atacantes, por rota (CA-T1.1, CA-T1.2, CA-T1.5, R3)', () => {
  // Cada caso monta dois lares completos (cadastros e lançamentos) e faz dezenas de requisições: 30 s de teto.
  it.each(Object.keys(CASOS))(
    '%s',
    async (rota) => {
      await CASOS[rota]!(await cenario());
    },
    30_000,
  );

  it('a vítima continua vendo e editando tudo depois das tentativas', async () => {
    const c = await cenario();
    for (const caso of Object.values(CASOS)) await caso(c);
    expect((await pedir(c.app, 'GET', `/api/lancamentos/${c.ids.individual}`, c.vitima)).status).toBe(200);
    expect(
      (await pedir(c.app, 'PATCH', `/api/lancamentos/${c.ids.individual}`, c.vitima, { descricao: 'Minha' })).status,
    ).toBe(200);
  }, 60_000);
});
