import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import { bancoDisponivel } from './testes-suporte';
import { assinaturaDaResposta } from './testes-suporte-acesso';
import { criarCategoria, criarConta, criarForma, larParaCadastros, novoId, type App } from './testes-suporte-cadastros';
import {
  appDeLar,
  criarLarDe,
  json,
  larComDois,
  linhasComoOwner,
  pedir,
  pessoa,
  type Pessoa,
} from './testes-suporte-lar';

/**
 * Teste negativo de isolamento POR ROTA dos cadastros (PLANO etapa 7; SDD 12.2; G-05; CA-T1.1 a CA-T1.5; R3).
 * Dois atacantes contra os dados INDIVIDUAIS da vítima: (1) alguém de OUTRO LAR; (2) o OUTRO MEMBRO do mesmo lar.
 * Nenhum lê nem altera; o erro de recurso alheio é idêntico ao de um id inexistente, nem em_uso nem
 * categoria_em_uso vazam; nenhuma lista, resposta ou erro traz o nome ou o id da vítima.
 * A tabela de casos é conferida contra o registro de rotas do app: rota nova de cadastro sem caso falha o teste.
 */

interface Cenario {
  app: App;
  vitima: Pessoa;
  /** Atacantes: outro lar (`de_fora`) e o outro membro do mesmo lar (`do_lar`). */
  atacantes: { nome: string; quem: Pessoa }[];
  ids: { conta: string; forma: string; categoria: string; contaComVinculo: string };
  segredos: string[];
}

async function cenario(): Promise<Cenario> {
  const { app, caixa } = appDeLar();
  const lar = await larComDois(app, caixa, 'cad.iso.a');
  const fora = await pessoa('cad.iso.b', 'Estranho');
  await criarLarDe(app, fora);
  const sufixo = Math.random().toString(36).slice(2, 8);
  const nomes = {
    conta: `Conta-Secreta-${sufixo}`,
    forma: `Forma-Secreta-${sufixo}`,
    categoria: `Cat-Secreta-${sufixo}`,
  };
  const conta = await criarConta(app, lar.titular, { nome: nomes.conta, saldo_inicial_centavos: 424242 });
  const contaComVinculo = await criarConta(app, lar.titular, { nome: `Vinculada-${sufixo}` });
  await criarForma(app, lar.titular, { nome: `Vinculo-${sufixo}`, tipo: 'pix', conta_id: contaComVinculo });
  const forma = await criarForma(app, lar.titular, { nome: nomes.forma, tipo: 'credito', dia_vencimento: 7 });
  const categoria = await criarCategoria(app, lar.titular, {
    nome: nomes.categoria,
    tipo: 'despesa',
    escopo: 'individual',
  });
  return {
    app,
    vitima: lar.titular,
    atacantes: [
      { nome: 'de outro lar', quem: fora },
      { nome: 'o outro membro do mesmo lar', quem: lar.membro },
    ],
    ids: { conta, forma, categoria, contaComVinculo },
    segredos: [conta, forma, categoria, nomes.conta, nomes.forma, nomes.categoria, '424242', lar.titular.nome],
  };
}

/** Retrato dos dados da vítima como o owner os vê (tudo): qualquer escrita do atacante muda o retrato. */
async function retrato(vitima: Pessoa) {
  return linhasComoOwner(
    sql<{ contas: unknown; formas: unknown; categorias: unknown; movimentos: unknown }>`
      with d as (select m.id from app.membro m where m.usuario_id = ${vitima.id})
      select (select json_agg(c order by c.id) from (select id, nome, saldo_inicial_centavos, arquivada from app.conta where dono_id = (select id from d)) c) as contas,
             (select json_agg(f order by f.id) from (select id, nome, tipo, conta_id, dia_vencimento, preferida, arquivada from app.forma_pagamento where dono_id = (select id from d)) f) as formas,
             (select json_agg(k order by k.id) from (select id, nome, arquivada from app.categoria where dono_id = (select id from d)) k) as categorias,
             (select json_agg(v order by v.id) from (select id, conta_id, tipo, sentido, valor_centavos from app.movimento_conta where dono_id = (select id from d)) v) as movimentos`,
  );
}

async function semMudanca(vitima: Pessoa, acao: () => Promise<void>): Promise<void> {
  const antes = await retrato(vitima);
  await acao();
  expect(await retrato(vitima)).toEqual(antes);
}

const ALEATORIO = novoId;

/** Alvo alheio e alvo inexistente têm que dar exatamente a mesma resposta (RT-01, CA-T1.1). */
async function mesmaRespostaQueInexistente(
  alheio: () => Promise<Response>,
  inexistente: () => Promise<Response>,
): Promise<void> {
  const a = await assinaturaDaResposta(await alheio());
  const b = await assinaturaDaResposta(await inexistente());
  expect(a).toEqual(b);
  expect(a.status).toBe(404);
  expect(JSON.parse(a.corpo)).toMatchObject({ code: 'registro_invalido' });
}

/** Lista: o atacante não vê nada da vítima, em nenhuma parte da resposta. */
async function listaSemVitima(c: Cenario, rota: string): Promise<void> {
  for (const { quem } of c.atacantes) {
    const texto = await (await pedir(c.app, 'GET', rota, quem)).text();
    for (const segredo of c.segredos) expect(texto, `${rota} vaza ${segredo}`).not.toContain(segredo);
  }
}

/** Um caso por rota (método + caminho do registro do Hono). */
const CASOS: Record<string, (c: Cenario) => Promise<void>> = {
  'GET /api/contas': (c) => listaSemVitima(c, '/api/contas'),
  'GET /api/formas': (c) => listaSemVitima(c, '/api/formas'),
  'GET /api/categorias': (c) => listaSemVitima(c, '/api/categorias'),

  'PUT /api/contas/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () =>
            pedir(c.app, 'PUT', `/api/contas/${c.ids.conta}`, quem, { nome: 'Invadida', saldo_inicial_centavos: 1 }),
          // criar com id livre dá 201: o "inexistente" comparável é o id que existe em outro lugar. Usa o da
          // vítima de um lar diferente: outra conta que o atacante também não vê.
          () =>
            pedir(c.app, 'PUT', `/api/contas/${c.ids.contaComVinculo}`, quem, {
              nome: 'Invadida',
              saldo_inicial_centavos: 1,
            }),
        );
      }
    });
  },
  'POST /api/contas/:id/ajuste': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        for (const simular of [false, true]) {
          await mesmaRespostaQueInexistente(
            () => pedir(c.app, 'POST', `/api/contas/${c.ids.conta}/ajuste`, quem, { saldo_real_centavos: 1, simular }),
            () => pedir(c.app, 'POST', `/api/contas/${ALEATORIO()}/ajuste`, quem, { saldo_real_centavos: 1, simular }),
          );
        }
      }
    });
  },
  'POST /api/contas/:id/arquivar': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () => pedir(c.app, 'POST', `/api/contas/${c.ids.conta}/arquivar`, quem),
          () => pedir(c.app, 'POST', `/api/contas/${ALEATORIO()}/arquivar`, quem),
        );
      }
    });
  },
  'DELETE /api/contas/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        // a conta com forma ligada falharia por "em_uso": o atacante recebe registro_invalido antes (CA-T1.3)
        await mesmaRespostaQueInexistente(
          () => pedir(c.app, 'DELETE', `/api/contas/${c.ids.contaComVinculo}`, quem),
          () => pedir(c.app, 'DELETE', `/api/contas/${ALEATORIO()}`, quem),
        );
        await mesmaRespostaQueInexistente(
          () => pedir(c.app, 'DELETE', `/api/contas/${c.ids.conta}`, quem),
          () => pedir(c.app, 'DELETE', `/api/contas/${ALEATORIO()}`, quem),
        );
      }
    });
  },

  'PUT /api/formas/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () =>
            pedir(c.app, 'PUT', `/api/formas/${c.ids.forma}`, quem, {
              nome: 'Invadida',
              tipo: 'credito',
              dia_vencimento: 1,
            }),
          // conta que não é dele: também registro_invalido
          () =>
            pedir(c.app, 'PUT', `/api/formas/${ALEATORIO()}`, quem, { nome: 'X', tipo: 'pix', conta_id: c.ids.conta }),
        );
      }
    });
  },
  'PUT /api/formas/:id/preferida': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () => pedir(c.app, 'PUT', `/api/formas/${c.ids.forma}/preferida`, quem, { preferida: true }),
          () => pedir(c.app, 'PUT', `/api/formas/${ALEATORIO()}/preferida`, quem, { preferida: true }),
        );
      }
    });
  },
  'POST /api/formas/:id/arquivar': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () => pedir(c.app, 'POST', `/api/formas/${c.ids.forma}/arquivar`, quem),
          () => pedir(c.app, 'POST', `/api/formas/${ALEATORIO()}/arquivar`, quem),
        );
      }
    });
  },
  // Etapa 8: o pagamento de cartão é uma rota de formas (SDD #15); a conta de origem é a da vítima ou inexistente.
  'POST /api/formas/:id/pagamentos': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () =>
            pedir(c.app, 'POST', `/api/formas/${c.ids.forma}/pagamentos`, quem, {
              id: ALEATORIO(),
              conta_id: c.ids.conta,
              valor_centavos: 100,
            }),
          () =>
            pedir(c.app, 'POST', `/api/formas/${ALEATORIO()}/pagamentos`, quem, {
              id: ALEATORIO(),
              conta_id: c.ids.conta,
              valor_centavos: 100,
            }),
        );
      }
    });
  },
  'DELETE /api/formas/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () => pedir(c.app, 'DELETE', `/api/formas/${c.ids.forma}`, quem),
          () => pedir(c.app, 'DELETE', `/api/formas/${ALEATORIO()}`, quem),
        );
      }
    });
  },

  'PUT /api/categorias/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () =>
            pedir(c.app, 'PUT', `/api/categorias/${c.ids.categoria}`, quem, {
              nome: 'Invadida',
              tipo: 'despesa',
              escopo: 'individual',
            }),
          // o mesmo id da vítima com outro corpo: a resposta não depende do corpo
          () =>
            pedir(c.app, 'PUT', `/api/categorias/${c.ids.categoria}`, quem, {
              nome: 'Outro nome',
              tipo: 'despesa',
              escopo: 'individual',
              variavel: true,
            }),
        );
      }
    });
  },
  'POST /api/categorias/:id/arquivar': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () => pedir(c.app, 'POST', `/api/categorias/${c.ids.categoria}/arquivar`, quem),
          () => pedir(c.app, 'POST', `/api/categorias/${ALEATORIO()}/arquivar`, quem),
        );
      }
    });
  },
  'DELETE /api/categorias/:id': async (c) => {
    await semMudanca(c.vitima, async () => {
      for (const { quem } of c.atacantes) {
        await mesmaRespostaQueInexistente(
          () => pedir(c.app, 'DELETE', `/api/categorias/${c.ids.categoria}`, quem),
          () => pedir(c.app, 'DELETE', `/api/categorias/${ALEATORIO()}`, quem),
        );
      }
    });
  },
};

describe('cobertura do isolamento por rota dos cadastros (G-05)', () => {
  it('toda rota de contas, formas e categorias registrada no app tem caso negativo', () => {
    const app = criarApp();
    const registradas = new Set(
      app.routes
        .filter((r) => r.method !== 'ALL' && /^\/api\/(contas|formas|categorias)(\/|$)/.test(r.path))
        .map((r) => `${r.method} ${r.path}`),
    );
    expect([...registradas].sort()).toEqual(Object.keys(CASOS).sort());
  });
});

describe.skipIf(!bancoDisponivel)('privados da vítima × atacantes, por rota (CA-T1.1, CA-T1.2, CA-T1.5, R3)', () => {
  it.each(Object.keys(CASOS))('%s', async (rota) => {
    await CASOS[rota]!(await cenario());
  });

  it('CA-T1.3: excluir a conta e a categoria alheias que estariam em uso dá registro_invalido, nunca em_uso', async () => {
    const c = await cenario();
    for (const { quem } of c.atacantes) {
      const r = await pedir(c.app, 'DELETE', `/api/contas/${c.ids.contaComVinculo}`, quem);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
  });

  it('a vítima continua vendo e podendo editar tudo depois das tentativas (nada foi alterado)', async () => {
    const c = await cenario();
    for (const caso of Object.values(CASOS)) await caso(c);
    expect(
      (await pedir(c.app, 'PUT', `/api/contas/${c.ids.conta}`, c.vitima, { nome: 'Minha', saldo_inicial_centavos: 5 }))
        .status,
    ).toBe(200);
    expect(
      (await pedir(c.app, 'PUT', `/api/formas/${c.ids.forma}/preferida`, c.vitima, { preferida: true })).status,
    ).toBe(204);
  });
});

describe.skipIf(!bancoDisponivel)('o lar vem do vínculo, nunca do corpo nem de cabeçalho (G-03)', () => {
  it('lar_id e dono_id no corpo são recusados e um cabeçalho com o lar alheio não muda o lar usado', async () => {
    const { app, titular } = await larParaCadastros('cad.g03');
    const outro = await pessoa('cad.g03.fora');
    const larFora = await criarLarDe(app, outro);
    for (const campo of ['lar_id', 'dono_id']) {
      const r = await pedir(app, 'PUT', `/api/contas/${novoId()}`, titular, { nome: 'x', [campo]: larFora });
      expect(r.status).toBe(400);
    }
    const id = await criarConta(app, titular, { nome: 'Minha' });
    const lar = await linhasComoOwner(sql<{ lar_id: string }>`select lar_id from app.conta where id = ${id}`);
    expect(lar[0]!.lar_id).not.toBe(larFora);
  });
});
