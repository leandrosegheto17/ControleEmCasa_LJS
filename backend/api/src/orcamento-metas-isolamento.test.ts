import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import { bancoDisponivel } from './testes-suporte';
import { assinaturaDaResposta } from './testes-suporte-acesso';
import { criarConta } from './testes-suporte-cadastros';
import { linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';
import {
  criarMeta,
  definirOrcamentoOk,
  larParaOrcamento,
  movimentarOk,
  novoId,
  type App,
} from './testes-suporte-orcamento-metas';

/**
 * Teste negativo de isolamento POR ROTA do orçamento e das metas (PLANO etapa 10; SDD 12.2; G-05, G-10, G-12;
 * CA-T1.1, CA-T1.2, CA-T1.5, CA-02.3, CA-08.5; RN-16e; R3). Atacantes: (1) alguém de OUTRO LAR, contra tudo do lar da
 * vítima; (2) o OUTRO MEMBRO do mesmo lar, contra o individual e a parte privada dela. O erro de recurso alheio é
 * idêntico ao de um id inexistente; nenhuma resposta traz valor, nome, local ou conta privados da vítima. A tabela
 * de casos é conferida contra o registro de rotas do app: rota nova de orçamento ou meta sem caso falha o teste.
 */

const OUT = '2026-10-01';
const NOV = '2026-11-01';

interface Cenario {
  app: App;
  vitima: Pessoa;
  outroMembro: Pessoa;
  deFora: Pessoa;
  categoriaConjunta: string;
  categoriaIndividual: string;
  categoriaDeFora: string;
  contaDaVitima: string;
  contaDeFora: string;
  metaConjunta: string;
  metaIndividual: string;
  /** Outra meta individual da vítima: só serve de referência "escondida pela RLS" nos casos de PUT. */
  metaEscondida: string;
  movimentoConjunto: string;
  /** Nada disso pode aparecer em resposta a quem é de fora. */
  segredosDoLar: string[];
  /** Nada disso pode aparecer em resposta ao outro membro (privado da vítima). */
  segredosDaVitima: string[];
}

async function cenario(): Promise<Cenario> {
  const l = await larParaOrcamento('orcmeta.iso.a');
  const fora = await larParaOrcamento('orcmeta.iso.b');
  await definirOrcamentoOk(l.app, l.titular, OUT, l.moradia, 737_373);
  await definirOrcamentoOk(l.app, l.titular, OUT, l.ana.lazer, 747_474);
  const contaDaVitima = await criarConta(l.app, l.titular, { nome: 'Conta-secreta-da-Ana' });
  const metaConjunta = await criarMeta(l.app, l.titular, { nome: 'Meta-do-lar', alvo_centavos: 818_181 });
  const metaIndividual = await criarMeta(l.app, l.titular, {
    nome: 'Meta-da-Ana',
    alvo_centavos: 929_292,
    escopo: 'individual',
  });
  const metaEscondida = await criarMeta(l.app, l.titular, { nome: 'Outra-da-Ana', escopo: 'individual' });
  const movimentoConjunto = await movimentarOk(l.app, l.titular, metaConjunta, {
    valor_centavos: 111_222,
    local: 'Local-do-lar',
    conta_id: contaDaVitima,
  });
  await movimentarOk(l.app, l.titular, metaIndividual, { valor_centavos: 333_444, local: 'Local-secreto-da-Ana' });
  return {
    app: l.app,
    vitima: l.titular,
    outroMembro: l.membro,
    deFora: fora.titular,
    categoriaConjunta: l.moradia,
    categoriaIndividual: l.ana.lazer,
    categoriaDeFora: fora.moradia,
    contaDaVitima,
    contaDeFora: await criarConta(fora.app, fora.titular, { nome: 'Conta-de-fora' }),
    metaConjunta,
    metaIndividual,
    metaEscondida,
    movimentoConjunto,
    segredosDoLar: [
      metaConjunta,
      metaIndividual,
      movimentoConjunto,
      'Meta-do-lar',
      'Meta-da-Ana',
      'Local-do-lar',
      'Local-secreto-da-Ana',
      '737373',
      '747474',
      '818181',
      '929292',
      '111222',
      '333444',
    ],
    segredosDaVitima: [
      contaDaVitima,
      'Conta-secreta-da-Ana',
      l.ana.lazer,
      metaIndividual,
      'Meta-da-Ana',
      'Local-secreto-da-Ana',
      '747474',
      '929292',
      '333444',
    ],
  };
}

/** Retrato do lar da vítima (orçamento, metas, movimentos e movimentos de conta) como o owner o vê. */
async function retrato(c: Cenario) {
  return linhasComoOwner(
    sql<{ o: unknown; m: unknown; mm: unknown; mc: unknown }>`
      with lar as (select m.lar_id as id from app.membro m where m.usuario_id = ${c.vitima.id} and m.saiu_em is null)
      select (select json_agg(x order by x.id) from (select * from app.orcamento where lar_id = (select id from lar)) x) as o,
             (select json_agg(x order by x.id) from (select * from app.meta where lar_id = (select id from lar)) x) as m,
             (select json_agg(x order by x.id) from (select * from app.movimento_meta where lar_id = (select id from lar)) x) as mm,
             (select json_agg(x order by x.id) from (select * from app.movimento_conta where lar_id = (select id from lar)) x) as mc`,
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

const corpoMeta = { nome: 'Invadida', alvo_centavos: 1, escopo: 'conjunto' };

const CASOS: Record<string, (c: Cenario) => Promise<void>> = {
  'GET /api/orcamento': async (c) => {
    for (const escopo of ['conjunto', 'individual']) {
      await semSegredo(
        await pedir(c.app, 'GET', `/api/orcamento?mes=${OUT}&escopo=${escopo}`, c.deFora),
        c.segredosDoLar,
        'orçamento (de fora)',
      );
    }
    for (const escopo of ['conjunto', 'individual']) {
      await semSegredo(
        await pedir(c.app, 'GET', `/api/orcamento?mes=${OUT}&escopo=${escopo}`, c.outroMembro),
        c.segredosDaVitima,
        'orçamento (outro membro)',
      );
    }
  },
  'PUT /api/orcamento/:mes/:categoria_id': async (c) => {
    await semMudanca(c, async () => {
      const define = (quem: Pessoa, categoria: string, valor: number | null) =>
        pedir(c.app, 'PUT', `/api/orcamento/${OUT}/${categoria}`, quem, { valor_centavos: valor });
      // de fora: a categoria da vítima não existe para ele (definir e remover)
      for (const valor of [1, null]) {
        await mesmaResposta(
          () => define(c.deFora, c.categoriaConjunta, valor),
          () => define(c.deFora, novoId(), valor),
        );
      }
      // o outro membro: a categoria individual da vítima também não existe para ele
      for (const valor of [1, null]) {
        await mesmaResposta(
          () => define(c.outroMembro, c.categoriaIndividual, valor),
          () => define(c.outroMembro, novoId(), valor),
        );
      }
      // e a categoria de outro lar não serve ao lar da vítima
      await mesmaResposta(
        () => define(c.vitima, c.categoriaDeFora, 1),
        () => define(c.vitima, novoId(), 1),
      );
    });
  },
  'POST /api/orcamento/:mes/copiar': async (c) => {
    await semMudanca(c, async () => {
      // de fora: nada do lar da vítima é copiado, e o lar dele não tem orçamento anterior
      for (const escopo of ['conjunto', 'individual']) {
        const r = await pedir(c.app, 'POST', `/api/orcamento/${NOV}/copiar`, c.deFora, { escopo });
        expect(await r.json()).toEqual({ copiadas: 0 });
      }
      // o outro membro não copia o individual da vítima (a origem é só a dele)
      const r = await pedir(c.app, 'POST', `/api/orcamento/${NOV}/copiar`, c.outroMembro, { escopo: 'individual' });
      expect(await r.json()).toEqual({ copiadas: 0 });
    });
    const dele = await pedir(c.app, 'GET', `/api/orcamento?mes=${NOV}&escopo=individual`, c.outroMembro);
    expect(JSON.parse(await dele.text())).toMatchObject({ linhas: [], total: null });
  },
  'GET /api/metas': async (c) => {
    await semSegredo(await pedir(c.app, 'GET', '/api/metas', c.deFora), c.segredosDoLar, 'metas (de fora)');
    await semSegredo(
      await pedir(c.app, 'GET', '/api/metas', c.outroMembro),
      c.segredosDaVitima,
      'metas (outro membro)',
    );
  },
  'GET /api/metas/locais': async (c) => {
    await semSegredo(await pedir(c.app, 'GET', '/api/metas/locais', c.deFora), c.segredosDoLar, 'locais (de fora)');
    await semSegredo(
      await pedir(c.app, 'GET', '/api/metas/locais', c.outroMembro),
      c.segredosDaVitima,
      'locais (outro membro)',
    );
  },
  'GET /api/metas/:id': async (c) => {
    for (const [quem, id] of [
      [c.deFora, c.metaConjunta],
      [c.deFora, c.metaIndividual],
      [c.outroMembro, c.metaIndividual],
    ] as const) {
      await mesmaResposta(
        () => pedir(c.app, 'GET', `/api/metas/${id}`, quem),
        () => pedir(c.app, 'GET', `/api/metas/${novoId()}`, quem),
      );
    }
    // o outro membro vê a conjunta, sem nada privado da vítima
    await semSegredo(
      await pedir(c.app, 'GET', `/api/metas/${c.metaConjunta}`, c.outroMembro),
      c.segredosDaVitima,
      'meta (outro membro)',
    );
  },
  'PUT /api/metas/:id': async (c) => {
    await semMudanca(c, async () => {
      for (const [quem, id] of [
        [c.deFora, c.metaConjunta],
        [c.deFora, c.metaIndividual],
        [c.outroMembro, c.metaIndividual],
      ] as const) {
        await mesmaResposta(
          () => pedir(c.app, 'PUT', `/api/metas/${id}`, quem, corpoMeta),
          // PUT num id livre CRIA (ADR-010), por isso não serve de "inexistente": a referência é outro id que a
          // RLS também esconde do atacante (outra meta individual da vítima). As duas recusas têm de ser idênticas.
          () => pedir(c.app, 'PUT', `/api/metas/${c.metaEscondida}`, quem, corpoMeta),
        );
      }
    });
  },
  'POST /api/metas/:id/movimentos': async (c) => {
    await semMudanca(c, async () => {
      const mov = (quem: Pessoa, meta: string, extra: Record<string, unknown> = {}) =>
        pedir(c.app, 'POST', `/api/metas/${meta}/movimentos`, quem, {
          id: novoId(),
          tipo: 'aporte',
          valor_centavos: 1,
          local: 'Invasor',
          ...extra,
        });
      for (const [quem, meta] of [
        [c.deFora, c.metaConjunta],
        [c.deFora, c.metaIndividual],
        [c.outroMembro, c.metaIndividual],
      ] as const) {
        await mesmaResposta(
          () => mov(quem, meta),
          () => mov(quem, novoId()),
        );
      }
      // a conta da vítima não serve ao outro membro, nem a quem é de fora
      await mesmaResposta(
        () => mov(c.outroMembro, c.metaConjunta, { conta_id: c.contaDaVitima }),
        () => mov(c.outroMembro, c.metaConjunta, { conta_id: novoId() }),
      );
      await mesmaResposta(
        () => mov(c.deFora, novoId(), { conta_id: c.contaDeFora }),
        () => mov(c.deFora, novoId(), { conta_id: novoId() }),
      );
      // RT-03: reusar o id do movimento da vítima
      for (const quem of [c.outroMembro, c.deFora]) {
        await mesmaResposta(
          () => mov(quem, quem === c.deFora ? novoId() : c.metaConjunta, { id: c.movimentoConjunto }),
          () => mov(quem, novoId()),
        );
      }
    });
  },
  'GET /api/metas/:id/movimentos': async (c) => {
    for (const [quem, id] of [
      [c.deFora, c.metaConjunta],
      [c.deFora, c.metaIndividual],
      [c.outroMembro, c.metaIndividual],
    ] as const) {
      await mesmaResposta(
        () => pedir(c.app, 'GET', `/api/metas/${id}/movimentos`, quem),
        () => pedir(c.app, 'GET', `/api/metas/${novoId()}/movimentos`, quem),
      );
    }
    // CA-08.5: o outro membro vê o movimento da conjunta, sem a conta
    await semSegredo(
      await pedir(c.app, 'GET', `/api/metas/${c.metaConjunta}/movimentos`, c.outroMembro),
      c.segredosDaVitima,
      'movimentos (outro membro)',
    );
  },
};

describe('cobertura do isolamento por rota do orçamento e das metas (G-05)', () => {
  it('toda rota de orçamento e meta registrada no app tem caso negativo', () => {
    const app = criarApp();
    const registradas = new Set(
      app.routes
        .filter((r) => r.method !== 'ALL' && /^\/api\/(orcamento|metas)(\/|$)/.test(r.path))
        .map((r) => `${r.method} ${r.path}`),
    );
    expect([...registradas].sort()).toEqual(Object.keys(CASOS).sort());
  });
});

describe.skipIf(!bancoDisponivel)(
  'orçamento e metas da vítima × atacantes, por rota (CA-T1.1, CA-T1.2, CA-T1.5, R3)',
  () => {
    it.each(Object.keys(CASOS))(
      '%s',
      async (rota) => {
        await CASOS[rota]!(await cenario());
      },
      30_000,
    );

    it('a vítima continua vendo, editando e movimentando depois das tentativas', async () => {
      const c = await cenario();
      for (const caso of Object.values(CASOS)) await caso(c);
      expect((await pedir(c.app, 'GET', `/api/metas/${c.metaIndividual}`, c.vitima)).status).toBe(200);
      expect(
        (
          await pedir(c.app, 'POST', `/api/metas/${c.metaConjunta}/movimentos`, c.vitima, {
            id: novoId(),
            tipo: 'retirada',
            valor_centavos: 111_222,
            local: 'Local-do-lar',
          })
        ).status,
      ).toBe(201);
      const o = await pedir(c.app, 'GET', `/api/orcamento?mes=${OUT}&escopo=individual`, c.vitima);
      expect(o.status).toBe(200);
      expect(JSON.parse(await o.text()).linhas).toHaveLength(1);
    }, 60_000);
  },
);
