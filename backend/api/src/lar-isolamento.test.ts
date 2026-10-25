import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import type { Sessao } from './env';
import { bancoDisponivel } from './testes-suporte';
import { assinaturaDaResposta } from './testes-suporte-acesso';
import {
  appDeLar,
  comoApp,
  criarLarDe,
  json,
  larComDois,
  linhasComoOwner,
  pedir,
  pessoa,
  tokenDoConvite,
  type Pessoa,
} from './testes-suporte-lar';

/**
 * Teste negativo de isolamento POR ROTA (PLANO etapa 6; SDD 12.2; G-05; CA-T1.1, CA-T1.2, CA-T1.5; R3).
 * Com a sessão do lar B, nenhuma rota lê ou altera o lar A; o erro de recurso alheio é idêntico ao de um id
 * inexistente. A tabela de casos é conferida contra o registro de rotas do app: rota nova de lar ou convite
 * sem caso faz este teste falhar.
 */

type App = ReturnType<typeof appDeLar>['app'];

interface Cenario {
  app: App;
  /** Lar A completo (titular + membro) e lar P (titular sozinho com convite pendente para `x`). */
  a: { titular: Pessoa; membro: Pessoa; larId: string };
  p: { titular: Pessoa; larId: string; conviteId: string; token: string; x: Pessoa };
  /** Lar B completo: quem ataca. */
  b: { titular: Pessoa; membro: Pessoa; larId: string };
}

async function cenario(): Promise<Cenario> {
  const { app, caixa } = appDeLar();
  const a = await larComDois(app, caixa, 'iso.a');
  const b = await larComDois(app, caixa, 'iso.b');
  const pt = await pessoa('iso.p', 'Titular P');
  const larP = await criarLarDe(app, pt);
  const x = await pessoa('iso.x');
  const conv = await json<{ id: string }>(await pedir(app, 'POST', '/api/lar/convites', pt, { email: x.email }));
  return {
    app,
    a,
    b,
    p: { titular: pt, larId: larP, conviteId: conv.id, token: tokenDoConvite(caixa, x.email), x },
  };
}

/** Retrato do lar como o owner o vê (tudo): qualquer escrita de B em A muda o retrato. */
async function retrato(larId: string) {
  return linhasComoOwner(
    sql<{ lar: unknown; membros: unknown; convites: unknown; categorias: unknown }>`
      select (select row_to_json(l) from (select nome from app.lar where id = ${larId}) l) as lar,
             (select json_agg(m order by m.id) from (select id, nome, papel, saiu_em from app.membro where lar_id = ${larId}) m) as membros,
             (select json_agg(c order by c.id) from (select id, situacao, email from app.convite where lar_id = ${larId}) c) as convites,
             (select json_agg(k order by k.id) from (select id, nome, arquivada from app.categoria where lar_id = ${larId}) k) as categorias`,
  );
}

async function semMudancaEm(larIds: string[], acao: () => Promise<void>): Promise<void> {
  const antes = await Promise.all(larIds.map(retrato));
  await acao();
  expect(await Promise.all(larIds.map(retrato))).toEqual(antes);
}

async function idsDosMembros(app: App, quem: Pessoa) {
  const corpo = await json<{ membros: { id: string; papel: string }[] }>(await pedir(app, 'GET', '/api/lar', quem));
  return corpo.membros;
}

const ALEATORIO = () => crypto.randomUUID();

/** Um caso por rota (método + caminho do registro do Hono). */
const CASOS: Record<string, (c: Cenario) => Promise<void>> = {
  'POST /api/lar': async ({ app, a, b }) => {
    await semMudancaEm([a.larId], async () => {
      const r = await pedir(app, 'POST', '/api/lar', b.titular, { nome: 'Tentativa' });
      expect(r.status).toBe(200);
      expect(await json(r)).toMatchObject({ id: b.larId });
    });
  },
  'GET /api/lar': async ({ app, a, b }) => {
    const texto = await (await pedir(app, 'GET', '/api/lar', b.membro)).text();
    expect(texto).toContain(b.larId);
    for (const proibido of [a.larId, a.titular.nome, a.membro.nome, a.titular.email, a.membro.email]) {
      expect(texto).not.toContain(proibido);
    }
  },
  'PATCH /api/lar': async ({ app, a, b }) => {
    await semMudancaEm([a.larId], async () => {
      expect((await pedir(app, 'PATCH', '/api/lar', b.titular, { nome: 'Renomeado por B' })).status).toBe(204);
    });
  },
  'DELETE /api/lar/membros/:id': async ({ app, a, b }) => {
    const alvo = (await idsDosMembros(app, a.titular)).find((m) => m.papel === 'membro')!.id;
    await semMudancaEm([a.larId], async () => {
      const alheio = await assinaturaDaResposta(await pedir(app, 'DELETE', `/api/lar/membros/${alvo}`, b.titular));
      const inexistente = await assinaturaDaResposta(
        await pedir(app, 'DELETE', `/api/lar/membros/${ALEATORIO()}`, b.titular),
      );
      expect(alheio).toEqual(inexistente);
      expect(alheio.status).toBe(404);
    });
  },
  'POST /api/lar/sair': async ({ app, a, b }) => {
    await semMudancaEm([a.larId], async () => {
      expect((await pedir(app, 'POST', '/api/lar/sair', b.membro)).status).toBe(204);
    });
  },
  'POST /api/lar/convites': async ({ app, a, b }) => {
    await semMudancaEm([a.larId], async () => {
      const comLar = await pedir(app, 'POST', '/api/lar/convites', b.titular, {
        email: 'z@exemplo.com',
        lar_id: a.larId,
      });
      expect(comLar.status).toBe(400);
      // o lar B está cheio: o convite é avaliado no lar de B, nunca no de A
      const r = await pedir(app, 'POST', '/api/lar/convites', b.titular, { email: 'z@exemplo.com' });
      expect(await json(r)).toMatchObject({ code: 'lar_cheio' });
    });
  },
  'DELETE /api/lar/convites/:id': async ({ app, p, b }) => {
    await semMudancaEm([p.larId], async () => {
      const alheio = await assinaturaDaResposta(
        await pedir(app, 'DELETE', `/api/lar/convites/${p.conviteId}`, b.titular),
      );
      const inexistente = await assinaturaDaResposta(
        await pedir(app, 'DELETE', `/api/lar/convites/${ALEATORIO()}`, b.titular),
      );
      expect(alheio).toEqual(inexistente);
      expect(alheio.status).toBe(404);
    });
  },
  'GET /api/convites/atual': async ({ app, p, b }) => {
    const alheio = await assinaturaDaResposta(
      await pedir(app, 'GET', `/api/convites/atual?token=${p.token}`, b.titular),
    );
    const errado = await assinaturaDaResposta(
      await pedir(app, 'GET', `/api/convites/atual?token=${'B'.repeat(43)}`, b.titular),
    );
    expect(alheio).toEqual(errado);
    expect(alheio.status).toBe(404);
  },
  'POST /api/convites/aceitar': async ({ app, p, b }) => {
    await semMudancaEm([p.larId, b.larId], async () => {
      const r = await pedir(app, 'POST', '/api/convites/aceitar', b.membro, { token: p.token });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'convite_invalido' });
    });
  },
  'POST /api/convites/recusar': async ({ app, p, b }) => {
    await semMudancaEm([p.larId, b.larId], async () => {
      const r = await pedir(app, 'POST', '/api/convites/recusar', b.titular, { token: p.token });
      expect(r.status).toBe(404);
    });
  },
};

describe('cobertura do isolamento por rota (G-05)', () => {
  it('toda rota de lar e de convite registrada no app tem caso negativo', () => {
    const app = criarApp();
    const registradas = new Set(
      app.routes
        .filter((r) => r.method !== 'ALL' && /^\/api\/(lar|convites)(\/|$)/.test(r.path))
        .map((r) => `${r.method} ${r.path}`),
    );
    expect([...registradas].sort()).toEqual(Object.keys(CASOS).sort());
  });
});

describe.skipIf(!bancoDisponivel)('lar B × lar A, por rota (CA-T1.1, CA-T1.5)', () => {
  it.each(Object.keys(CASOS))('%s', async (rota) => {
    await CASOS[rota]!(await cenario());
  });

  it('GET /api/sessao de B devolve só o lar e o membro de B', async () => {
    const c = await cenario();
    const texto = await (await pedir(c.app, 'GET', '/api/sessao', c.b.titular)).text();
    expect(texto).toContain(c.b.larId);
    expect(texto).not.toContain(c.a.larId);
  });
});

describe.skipIf(!bancoDisponivel)('o lar vem do vínculo no banco, nunca do chamador (G-03, SDD 5.3)', () => {
  it('sessão "enfeitada" com o lar de A e cabeçalho com o lar de A: B continua vendo só o próprio lar', async () => {
    const c = await cenario();
    const forjada = criarApp({
      resolverSessao: async () =>
        ({ usuarioId: c.b.titular.id, email: c.b.titular.email, larId: c.a.larId, lar_id: c.a.larId }) as Sessao,
    });
    const r = await forjada.request(
      '/api/lar',
      { headers: { 'X-Lar-Id': c.a.larId } },
      (await import('cloudflare:workers')).env,
    );
    expect(r.status).toBe(200);
    const texto = await r.text();
    expect(texto).toContain(c.b.larId);
    expect(texto).not.toContain(c.a.larId);
  });
});

describe.skipIf(!bancoDisponivel)('membro × individual do outro membro, pelo caminho de produção (CA-T1.2)', () => {
  it('cada membro vê as 6 conjuntas e só as 7 individuais dele; nenhuma do outro', async () => {
    const c = await cenario();
    const vistoPor = (p: Pessoa) =>
      comoApp(p, async (trx, v) => ({
        v,
        linhas: (
          await sql<{ escopo: string; dono_id: string | null }>`select escopo, dono_id from app.categoria`.execute(trx)
        ).rows,
      }));
    const t = await vistoPor(c.a.titular);
    const m = await vistoPor(c.a.membro);
    for (const visto of [t, m]) {
      expect(visto.linhas.filter((l) => l.escopo === 'conjunto')).toHaveLength(6);
      const individuais = visto.linhas.filter((l) => l.escopo === 'individual');
      expect(individuais).toHaveLength(7);
      expect(individuais.every((l) => l.dono_id === visto.v?.membroId)).toBe(true);
    }
    expect(t.v?.membroId).not.toBe(m.v?.membroId);
  });

  it('sem vínculo (ex-membro), a mesma transação não enxerga categoria nenhuma', async () => {
    const c = await cenario();
    await pedir(c.app, 'POST', '/api/lar/sair', c.a.membro);
    const n = await comoApp(c.a.membro, async (trx, v) => ({
      v,
      n: Number((await sql<{ n: string }>`select count(*) as n from app.categoria`.execute(trx)).rows[0]?.n),
    }));
    expect(n).toEqual({ v: null, n: 0 });
  });
});
