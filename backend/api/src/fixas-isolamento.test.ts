import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import { bancoDisponivel } from './testes-suporte';
import { assinaturaDaResposta } from './testes-suporte-acesso';
import { criarFixa, larParaFixas, novoId, ocorrenciaDe, pagarOk, type App } from './testes-suporte-fixas';
import { lancarDespesa, lancarReceita } from './testes-suporte-lancamentos';
import { linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';

/**
 * Teste negativo de isolamento POR ROTA das fixas, ocorrências e resumo (PLANO etapa 9; SDD 12.2; G-05, G-10, G-12;
 * CA-T1.1, CA-T1.2, CA-T1.5, CA-15.7, CA-28.7; RN-16e; R3). Atacantes: (1) alguém de OUTRO LAR, contra tudo do lar
 * da vítima; (2) o OUTRO MEMBRO do mesmo lar, contra o pagamento que a vítima fez (desfazer) e contra o individual e a
 * parte privada dela nos totais. O erro de recurso alheio é idêntico ao de um id inexistente; nenhuma resposta traz
 * valor, conta ou forma privados da vítima. A tabela de casos é conferida contra o registro de rotas do app: rota
 * nova de fixa, ocorrência ou resumo sem caso falha o teste.
 */

interface Cenario {
  app: App;
  vitima: Pessoa;
  outroMembro: Pessoa;
  deFora: Pessoa;
  categoriaDeFora: string;
  formaDoOutroMembro: string;
  formaDeFora: string;
  ids: { fixa: string; ocorrenciaPaga: string; ocorrenciaPendente: string; pagamento: string };
  /** Nada disso pode aparecer em resposta a quem é de fora. */
  segredosDoLar: string[];
  /** Nada disso pode aparecer em resposta ao outro membro (privado da vítima). */
  segredosDaVitima: string[];
}

async function cenario(): Promise<Cenario> {
  const l = await larParaFixas('fixa.iso.a');
  const fora = await larParaFixas('fixa.iso.b');
  const fixa = await criarFixa(l.app, l.titular, {
    categoria_id: l.moradia,
    descricao: 'Aluguel-do-lar',
    valor_previsto_centavos: 717_171,
  });
  const pendenteFixa = await criarFixa(l.app, l.titular, {
    categoria_id: l.moradia,
    descricao: 'Luz-do-lar',
    valor_previsto_centavos: 828_282,
  });
  const paga = await ocorrenciaDe(l.app, l.titular, fixa, '2026-10-01');
  const pendente = await ocorrenciaDe(l.app, l.titular, pendenteFixa, '2026-10-01');
  const pagamento = await pagarOk(l.app, l.titular, paga.id, { forma_id: l.ana.credito, data: '2026-10-08' });
  await lancarDespesa(l.app, l.titular, {
    valor_centavos: 424_242,
    categoria_id: l.ana.lazer,
    forma_id: l.ana.pix,
    data: '2026-10-09',
  });
  await lancarReceita(l.app, l.titular, {
    valor_centavos: 535_353,
    categoria_id: l.ana.salario,
    conta_id: l.ana.conta,
    data: '2026-10-01',
  });
  return {
    app: l.app,
    vitima: l.titular,
    outroMembro: l.membro,
    deFora: fora.titular,
    categoriaDeFora: fora.moradia,
    formaDoOutroMembro: l.bruno.pix,
    formaDeFora: fora.ana.pix,
    ids: { fixa, ocorrenciaPaga: paga.id, ocorrenciaPendente: pendente.id, pagamento },
    segredosDoLar: [
      fixa,
      pendenteFixa,
      paga.id,
      pendente.id,
      pagamento,
      'Aluguel-do-lar',
      'Luz-do-lar',
      '717171',
      '828282',
    ],
    segredosDaVitima: [
      l.ana.pix,
      l.ana.credito,
      l.ana.conta,
      l.ana.lazer,
      l.ana.salario,
      '424242',
      '535353',
      '2026-10-08',
    ],
  };
}

/** Retrato do lar da vítima (fixas, ocorrências e o pagamento) como o owner o vê: escrita alheia muda o retrato. */
async function retrato(c: Cenario) {
  return linhasComoOwner(
    sql<{ f: unknown; o: unknown; l: unknown; p: unknown }>`
      with lar as (select m.lar_id as id from app.membro m where m.usuario_id = ${c.vitima.id} and m.saiu_em is null)
      select (select json_agg(x order by x.id) from (select * from app.despesa_fixa where lar_id = (select id from lar)) x) as f,
             (select json_agg(x order by x.id) from (select * from app.ocorrencia_fixa where lar_id = (select id from lar)) x) as o,
             (select json_agg(x order by x.id) from (select * from app.lancamento where lar_id = (select id from lar)) x) as l,
             (select json_agg(x order by x.lancamento_id) from (select * from app.lancamento_pagamento
                     where lar_id = (select id from lar)) x) as p`,
  );
}

async function semMudanca(c: Cenario, acao: () => Promise<void>): Promise<void> {
  const antes = await retrato(c);
  await acao();
  expect(await retrato(c)).toEqual(antes);
}

async function mesmaResposta(alheio: () => Promise<Response>, inexistente: () => Promise<Response>): Promise<void> {
  const a = await assinaturaDaResposta(await alheio());
  const b = await assinaturaDaResposta(await inexistente());
  expect(a).toEqual(b);
  expect(a.status).toBe(404);
  expect(JSON.parse(a.corpo)).toMatchObject({ code: 'registro_invalido' });
}

async function semSegredo(r: Response, segredos: string[], rota: string) {
  expect(r.status, rota).toBe(200);
  const texto = await r.text();
  for (const s of segredos) expect(texto, `${rota} vaza ${s}`).not.toContain(s);
}

const CASOS: Record<string, (c: Cenario) => Promise<void>> = {
  'GET /api/fixas': async (c) => {
    await semSegredo(await pedir(c.app, 'GET', '/api/fixas', c.deFora), c.segredosDoLar, 'fixas (de fora)');
  },
  'GET /api/fixas/ocorrencias': async (c) => {
    for (const mes of ['2026-10-01', '2026-11-01']) {
      await semSegredo(
        await pedir(c.app, 'GET', `/api/fixas/ocorrencias?mes=${mes}`, c.deFora),
        c.segredosDoLar,
        'ocorrências (de fora)',
      );
      // §2.1: forma, conta e data do pagamento nunca saem, nem para o outro membro.
      await semSegredo(
        await pedir(c.app, 'GET', `/api/fixas/ocorrencias?mes=${mes}`, c.outroMembro),
        c.segredosDaVitima,
        'ocorrências (outro membro)',
      );
    }
  },
  'PUT /api/fixas/:id': async (c) => {
    await semMudanca(c, async () => {
      const corpo = {
        descricao: 'Invadida',
        categoria_id: c.categoriaDeFora,
        valor_previsto_centavos: 1,
        dia_vencimento: 1,
      };
      await mesmaResposta(
        () => pedir(c.app, 'PUT', `/api/fixas/${c.ids.fixa}`, c.deFora, corpo),
        // PUT num id livre CRIA (ADR-010): a recusa de referência é a de uma categoria inexistente.
        () => pedir(c.app, 'PUT', `/api/fixas/${novoId()}`, c.deFora, { ...corpo, categoria_id: novoId() }),
      );
    });
  },
  'POST /api/fixas/:id/encerrar': async (c) => {
    await semMudanca(c, async () => {
      await mesmaResposta(
        () => pedir(c.app, 'POST', `/api/fixas/${c.ids.fixa}/encerrar`, c.deFora),
        () => pedir(c.app, 'POST', `/api/fixas/${novoId()}/encerrar`, c.deFora),
      );
    });
  },
  'POST /api/ocorrencias/:id/pagamento': async (c) => {
    await semMudanca(c, async () => {
      for (const id of [c.ids.ocorrenciaPaga, c.ids.ocorrenciaPendente]) {
        await mesmaResposta(
          () =>
            pedir(c.app, 'POST', `/api/ocorrencias/${id}/pagamento`, c.deFora, {
              id: novoId(),
              forma_id: c.formaDeFora,
            }),
          () =>
            pedir(c.app, 'POST', `/api/ocorrencias/${novoId()}/pagamento`, c.deFora, {
              id: novoId(),
              forma_id: c.formaDeFora,
            }),
        );
      }
      // RT-03: reusar o id do lançamento do pagamento da vítima (o outro membro e quem é de fora).
      for (const quem of [c.outroMembro, c.deFora]) {
        await mesmaResposta(
          () =>
            pedir(c.app, 'POST', `/api/ocorrencias/${c.ids.ocorrenciaPendente}/pagamento`, quem, {
              id: c.ids.pagamento,
              forma_id: quem === c.outroMembro ? c.formaDoOutroMembro : c.formaDeFora,
            }),
          () =>
            pedir(c.app, 'POST', `/api/ocorrencias/${novoId()}/pagamento`, quem, {
              id: novoId(),
              forma_id: quem === c.outroMembro ? c.formaDoOutroMembro : c.formaDeFora,
            }),
        );
      }
    });
  },
  'DELETE /api/ocorrencias/:id/pagamento': async (c) => {
    await semMudanca(c, async () => {
      for (const quem of [c.outroMembro, c.deFora]) {
        await mesmaResposta(
          () => pedir(c.app, 'DELETE', `/api/ocorrencias/${c.ids.ocorrenciaPaga}/pagamento`, quem),
          () => pedir(c.app, 'DELETE', `/api/ocorrencias/${novoId()}/pagamento`, quem),
        );
      }
    });
  },
  'GET /api/resumo': async (c) => {
    for (const mes of ['2026-10-01', '2026-11-01']) {
      await semSegredo(
        await pedir(c.app, 'GET', `/api/resumo?mes=${mes}`, c.deFora),
        [...c.segredosDoLar, ...c.segredosDaVitima],
        'resumo (de fora)',
      );
      await semSegredo(
        await pedir(c.app, 'GET', `/api/resumo?mes=${mes}`, c.outroMembro),
        c.segredosDaVitima,
        'resumo (outro membro)',
      );
    }
  },
};

describe('cobertura do isolamento por rota das fixas e do resumo (G-05)', () => {
  it('toda rota de fixa, ocorrência e resumo registrada no app tem caso negativo', () => {
    const app = criarApp();
    const registradas = new Set(
      app.routes
        .filter((r) => r.method !== 'ALL' && /^\/api\/(fixas|ocorrencias|resumo)(\/|$)/.test(r.path))
        .map((r) => `${r.method} ${r.path}`),
    );
    expect([...registradas].sort()).toEqual(Object.keys(CASOS).sort());
  });
});

describe.skipIf(!bancoDisponivel)('fixas da vítima × atacantes, por rota (CA-T1.1, CA-T1.2, CA-T1.5, R3)', () => {
  it.each(Object.keys(CASOS))(
    '%s',
    async (rota) => {
      await CASOS[rota]!(await cenario());
    },
    30_000,
  );

  it('a vítima continua vendo, pagando e desfazendo depois das tentativas', async () => {
    const c = await cenario();
    for (const caso of Object.values(CASOS)) await caso(c);
    expect((await pedir(c.app, 'DELETE', `/api/ocorrencias/${c.ids.ocorrenciaPaga}/pagamento`, c.vitima)).status).toBe(
      204,
    );
    const r = await pedir(c.app, 'GET', '/api/fixas/ocorrencias?mes=2026-10-01', c.vitima);
    expect(r.status).toBe(200);
  }, 60_000);
});
