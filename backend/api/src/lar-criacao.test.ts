import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel, chamar } from './testes-suporte';
import { appDeLar, comoApp, criarLarDe, json, linhasComoOwner, pedir, pessoa } from './testes-suporte-lar';

/**
 * Lar no primeiro acesso (RN-22; CA-22.1, CA-22.3, CA-22.4; RN-17 CA-17.4; SDD 5.2, 5.3, 6.1 #3; G-03).
 * O vínculo (lar, membro e papel) é derivado no banco ao abrir a transação, nunca do chamador.
 */

describe.skipIf(!bancoDisponivel)('POST /api/lar (primeiro acesso)', () => {
  it('CA-22.1: cria 1 lar com o usuário titular, 6 conjuntas, 4 individuais de despesa e 3 de receita', async () => {
    const { app } = appDeLar();
    const ana = await pessoa('ana', 'Ana');
    const r = await pedir(app, 'POST', '/api/lar', ana, {});
    expect(r.status).toBe(201);
    const lar = saida.Lar.parse(await r.json());
    expect(lar.nome).toBe('Lar de Ana');

    const visto = await comoApp(ana, async (trx, vinculo) => ({
      vinculo,
      lares: (await sql<{ id: string }>`select id from app.lar`.execute(trx)).rows,
      membros: (await sql<{ nome: string; papel: string }>`select nome, papel from app.membro`.execute(trx)).rows,
      categorias: (
        await sql<{ tipo: string; escopo: string; nome: string; variavel: boolean | null; dono_id: string | null }>`
          select tipo, escopo, nome, variavel, dono_id from app.categoria order by escopo, tipo, nome`.execute(trx)
      ).rows,
    }));
    expect(visto.vinculo).toMatchObject({ larId: lar.id, papel: 'titular' });
    expect(visto.lares).toEqual([{ id: lar.id }]);
    // CA-22.4: o nome do membro é o nome do cadastro
    expect(visto.membros).toEqual([{ nome: 'Ana', papel: 'titular' }]);
    const conjuntas = visto.categorias.filter((c) => c.escopo === 'conjunto');
    const individuais = visto.categorias.filter((c) => c.escopo === 'individual');
    expect(conjuntas.map((c) => c.nome).sort()).toEqual(
      [
        'Almoço/Alimentação fora',
        'Contas da casa',
        'Delivery/iFood do casal',
        'Mercado',
        'Moradia',
        'Outros da casa',
      ].sort(),
    );
    expect(conjuntas.every((c) => c.tipo === 'despesa' && c.dono_id === null)).toBe(true);
    expect(
      individuais
        .filter((c) => c.tipo === 'despesa')
        .map((c) => c.nome)
        .sort(),
    ).toEqual(['Delivery pessoal', 'Lazer pessoal', 'Outros', 'Transporte'].sort());
    expect(
      individuais
        .filter((c) => c.tipo === 'receita')
        .map((c) => c.nome)
        .sort(),
    ).toEqual(['Extra', 'Outros', 'Salário'].sort());
    expect(individuais.every((c) => c.dono_id === visto.vinculo?.membroId)).toBe(true);
    expect(conjuntas.find((c) => c.nome === 'Mercado')?.variavel).toBe(true);
    expect(conjuntas.find((c) => c.nome === 'Moradia')?.variavel).toBe(false);
    expect(individuais.find((c) => c.nome === 'Salário')?.variavel).toBeNull();
  });

  it('aceita um nome informado (aparado) e recusa nome vazio, longo ou campo extra com valor_invalido', async () => {
    const { app } = appDeLar();
    const bia = await pessoa('bia');
    for (const corpo of [{ nome: '   ' }, { nome: 'x'.repeat(61) }, { lar_id: crypto.randomUUID() }]) {
      const r = await pedir(app, 'POST', '/api/lar', bia, corpo);
      expect(r.status).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
    const ok = await pedir(app, 'POST', '/api/lar', bia, { nome: '  Casa da Bia  ' });
    expect(ok.status).toBe(201);
    expect(await json(ok)).toMatchObject({ nome: 'Casa da Bia' });
  });

  it('é idempotente: quem já tem lar recebe 200 com o lar atual, sem duplicar categorias (CA-17.4)', async () => {
    const { app } = appDeLar();
    const caio = await pessoa('caio');
    const id = await criarLarDe(app, caio);
    const de_novo = await pedir(app, 'POST', '/api/lar', caio, { nome: 'Outro nome' });
    expect(de_novo.status).toBe(200);
    expect(await json(de_novo)).toEqual({ id, nome: 'Lar de Pessoa de teste' });
    const n = await comoApp(caio, async (trx) =>
      Number((await sql<{ n: string }>`select count(*) as n from app.categoria`.execute(trx)).rows[0]?.n),
    );
    expect(n).toBe(13);
  });

  it('CA-22.3: dois primeiros acessos simultâneos criam um único lar', async () => {
    const { app } = appDeLar();
    const davi = await pessoa('davi');
    const respostas = await Promise.all([1, 2, 3].map(() => pedir(app, 'POST', '/api/lar', davi, {})));
    const status = respostas.map((r) => r.status).sort();
    expect(status).toEqual([200, 200, 201]);
    const ids = new Set(await Promise.all(respostas.map(async (r) => (await json<{ id: string }>(r)).id)));
    expect(ids.size).toBe(1);
    const lares = await linhasComoOwner(
      sql<{ n: number }>`select count(*)::int as n from app.lar where criado_por = ${davi.id}`,
    );
    expect(lares).toEqual([{ n: 1 }]);
    const categorias = await linhasComoOwner(
      sql<{ n: number }>`select count(*)::int as n from app.categoria where lar_id = ${[...ids][0]!}`,
    );
    expect(categorias).toEqual([{ n: 13 }]);
  });

  it('sem sessão: 401 sessao_expirada; sem o cabeçalho anti-CSRF: 403 origem_invalida', async () => {
    const { app } = appDeLar();
    const r = await pedir(app, 'POST', '/api/lar', null, {});
    expect(r.status).toBe(401);
    expect(await json(r)).toMatchObject({ code: 'sessao_expirada' });
    const eva = await pessoa('eva');
    const semCsrf = await chamar(app, '/api/lar', {
      method: 'POST',
      headers: { Cookie: eva.cookie, 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(semCsrf.status).toBe(403);
    expect(await json(semCsrf)).toMatchObject({ code: 'origem_invalida' });
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/sessao com o vínculo (SDD 5.2, 5.3)', () => {
  it('sem lar: membro e lar nulos; com lar: o membro (titular) e o lar, no formato do contrato', async () => {
    const { app } = appDeLar();
    const fabi = await pessoa('fabi', 'Fabi');
    const antes = saida.SessaoAtual.parse(await json(await pedir(app, 'GET', '/api/sessao', fabi)));
    expect(antes).toMatchObject({ membro: null, lar: null });
    const larId = await criarLarDe(app, fabi);
    const depois = saida.SessaoAtual.parse(await json(await pedir(app, 'GET', '/api/sessao', fabi)));
    expect(depois.lar).toEqual({ id: larId, nome: 'Lar de Fabi' });
    expect(depois.membro).toMatchObject({ nome: 'Fabi', papel: 'titular' });
  });
});

describe.skipIf(!bancoDisponivel)('rotas que exigem lar: 409 sem_lar para quem ainda não tem (G-03)', () => {
  const ID = '00000000-0000-4000-8000-0000000000ff';
  it.each([
    ['GET', '/api/lar', undefined],
    ['PATCH', '/api/lar', { nome: 'X' }],
    ['DELETE', `/api/lar/membros/${ID}`, undefined],
    ['POST', '/api/lar/sair', undefined],
    ['POST', '/api/lar/convites', { email: 'x@exemplo.com' }],
    ['DELETE', `/api/lar/convites/${ID}`, undefined],
  ] as const)('%s %s', async (metodo, caminho, corpo) => {
    const { app } = appDeLar();
    const gil = await pessoa('gil');
    const r = await pedir(app, metodo, caminho, gil, corpo);
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'sem_lar' });
  });
});
