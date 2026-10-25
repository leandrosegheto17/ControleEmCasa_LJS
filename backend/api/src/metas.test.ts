import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { criarConta, listar } from './testes-suporte-cadastros';
import { saldoDe } from './testes-suporte-lancamentos';
import { json, pedir } from './testes-suporte-lar';
import {
  contagemDeMovimentos,
  criarMeta,
  detalheDaMeta,
  larParaOrcamento,
  metaNoBanco,
  movimentar,
  movimentarOk,
  movimentosDaMeta,
  novoId,
} from './testes-suporte-orcamento-metas';

/**
 * Metas pela API (SDD 6.1 #37 a #41; RN-08, RN-09, RN-18; CA-08.1 a CA-08.6, CA-09.1 a CA-09.5, CA-T3.3, CA-T3.4).
 * "Hoje" é 24/10/2026 em São Paulo (relógio parado). Meta e movimento ficam abertos nesta etapa (o bloqueio Pro é
 * da etapa 13).
 */

const HOJE = '2026-10-24';
const M = (r: unknown) => saida.LinhaMetas.parse(r);

describe.skipIf(!bancoDisponivel)('PUT /api/metas/:id (RN-08; CA-08.1, CA-08.2)', () => {
  it('cria com 201 e { id }; nasce com guardado 0 e sem movimento; o reenvio do mesmo id edita com 200', async () => {
    const l = await larParaOrcamento('meta.criar');
    const id = novoId();
    const corpo = { nome: '  Viagem ', alvo_centavos: 100_000, prazo: '2027-03-17', escopo: 'conjunto' };
    const r = await pedir(l.app, 'PUT', `/api/metas/${id}`, l.titular, corpo);
    expect(r.status).toBe(201);
    expect(saida.IdSalvo.parse(await json(r))).toEqual({ id });
    const m = M(await detalheDaMeta(l.app, l.titular, id));
    expect(m).toMatchObject({
      nome: 'Viagem',
      escopo: 'conjunto',
      alvo_centavos: 100_000,
      guardado_centavos: 0,
      falta_centavos: 100_000,
      percentual: 0,
      prazo: '2027-03',
      atingida: false,
      por_local: [],
    });
    expect(await metaNoBanco(id)).toMatchObject({ prazo: '2027-03-01', atingida_em: null });
    expect(await movimentosDaMeta(l.app, l.titular, id)).toEqual([]);

    const r2 = await pedir(l.app, 'PUT', `/api/metas/${id}`, l.titular, {
      ...corpo,
      nome: 'Viagem 2',
      escopo: undefined,
    });
    expect(r2.status).toBe(200);
    expect(await detalheDaMeta(l.app, l.titular, id)).toMatchObject({ nome: 'Viagem 2' });
  });

  it('a conjunta é vista e editada pelos dois; a individual só pelo dono', async () => {
    const l = await larParaOrcamento('meta.visibilidade');
    const conjunta = await criarMeta(l.app, l.titular, { nome: 'Casa', escopo: 'conjunto' });
    const individual = await criarMeta(l.app, l.titular, { nome: 'Reserva de Ana', escopo: 'individual' });
    const nomes = async (quem: typeof l.titular) =>
      (await listar<{ nome: string }>(l.app, '/api/metas', quem)).map((x) => x.nome);
    expect(await nomes(l.titular)).toEqual(['Casa', 'Reserva de Ana']);
    expect(await nomes(l.membro)).toEqual(['Casa']);
    expect(
      (await pedir(l.app, 'PUT', `/api/metas/${conjunta}`, l.membro, { nome: 'Casa nova', alvo_centavos: 5 })).status,
    ).toBe(200);
    const alheia = await pedir(l.app, 'GET', `/api/metas/${individual}`, l.membro);
    const inexistente = await pedir(l.app, 'GET', `/api/metas/${novoId()}`, l.membro);
    expect([alheia.status, await alheia.text()]).toEqual([inexistente.status, await inexistente.text()]);
    expect(alheia.status).toBe(404);
  });

  it('CA-08.2: escopo diferente do gravado → valor_invalido; escopo igual ou ausente é aceito', async () => {
    const l = await larParaOrcamento('meta.escopo');
    const id = await criarMeta(l.app, l.titular, { escopo: 'individual' });
    const r = await pedir(l.app, 'PUT', `/api/metas/${id}`, l.titular, {
      nome: 'x',
      alvo_centavos: 1,
      escopo: 'conjunto',
    });
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    expect((await metaNoBanco(id))!.escopo).toBe('individual');
    expect(
      (await pedir(l.app, 'PUT', `/api/metas/${id}`, l.titular, { nome: 'x', alvo_centavos: 1, escopo: 'individual' }))
        .status,
    ).toBe(200);
    expect((await pedir(l.app, 'PUT', `/api/metas/${id}`, l.titular, { nome: 'y', alvo_centavos: 1 })).status).toBe(
      200,
    );
  });

  it('criar sem escopo → valor_invalido, sem gravar', async () => {
    const l = await larParaOrcamento('meta.semescopo');
    const id = novoId();
    const r = await pedir(l.app, 'PUT', `/api/metas/${id}`, l.titular, { nome: 'x', alvo_centavos: 1 });
    expect(r.status).toBe(400);
    expect(await metaNoBanco(id)).toBeNull();
  });

  it('valor_invalido: nome vazio ou longo, alvo ≤ 0, fracionado ou acima de 10^11, prazo inexistente, chaves proibidas', async () => {
    const l = await larParaOrcamento('meta.invalida');
    const base = { nome: 'x', alvo_centavos: 100, escopo: 'conjunto' };
    const ruins: Record<string, unknown>[] = [
      { nome: '   ' },
      { nome: 'a'.repeat(121) },
      { alvo_centavos: 0 },
      { alvo_centavos: -1 },
      { alvo_centavos: 1.5 },
      { alvo_centavos: 100_000_000_001 },
      { prazo: '2027-02-30' },
      { dono_id: novoId() },
      { atingida_em: HOJE },
    ];
    for (const ruim of ruins) {
      const id = novoId();
      const r = await pedir(l.app, 'PUT', `/api/metas/${id}`, l.titular, { ...base, ...ruim });
      expect(r.status, JSON.stringify(ruim)).toBe(400);
      expect(await metaNoBanco(id)).toBeNull();
    }
    expect(
      (await pedir(l.app, 'PUT', `/api/metas/${novoId()}`, l.titular, { ...base, alvo_centavos: 100_000_000_000 }))
        .status,
    ).toBe(201);
  });

  it('RT-03: o id de uma meta individual de A reusado por B, ou de outro lar, é registro_invalido e nada muda', async () => {
    const l = await larParaOrcamento('meta.id.alheio');
    const fora = await larParaOrcamento('meta.id.alheio.fora');
    const individual = await criarMeta(l.app, l.titular, { nome: 'Da Ana', escopo: 'individual' });
    const conjuntaFora = await criarMeta(fora.app, fora.titular, { nome: 'Do outro lar' });
    for (const [quem, id] of [
      [l.membro, individual],
      [l.membro, conjuntaFora],
      [l.titular, conjuntaFora],
    ] as const) {
      const r = await pedir(l.app, 'PUT', `/api/metas/${id}`, quem, {
        nome: 'Invadida',
        alvo_centavos: 1,
        escopo: 'conjunto',
      });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
    expect(await metaNoBanco(individual)).toMatchObject({ nome: 'Da Ana' });
    expect(await metaNoBanco(conjuntaFora)).toMatchObject({ nome: 'Do outro lar' });
  });

  it('id de rota malformado vale como inexistente; sem sessão 401', async () => {
    const l = await larParaOrcamento('meta.rota');
    expect((await pedir(l.app, 'GET', '/api/metas/x', l.titular)).status).toBe(404);
    expect(
      (await pedir(l.app, 'PUT', '/api/metas/x', l.titular, { nome: 'a', alvo_centavos: 1, escopo: 'conjunto' }))
        .status,
    ).toBe(404);
    expect((await pedir(l.app, 'GET', '/api/metas', null)).status).toBe(401);
  });
});

describe.skipIf(!bancoDisponivel)('progresso da meta (RN-08)', () => {
  it('99.600 de 100.000 com prazo em nov/2026: 99% (não 100), falta 400, mensal 400', async () => {
    const l = await larParaOrcamento('meta.progresso');
    const id = await criarMeta(l.app, l.titular, { alvo_centavos: 100_000, prazo: '2026-11-01' });
    await movimentarOk(l.app, l.titular, id, { valor_centavos: 99_600 });
    expect(M(await detalheDaMeta(l.app, l.membro, id))).toMatchObject({
      guardado_centavos: 99_600,
      percentual: 99,
      falta_centavos: 400,
      mensal_necessario_centavos: 400,
      atingida: false,
    });
  });

  it('prazo em jan/2027 sem guardado: 3 meses → 33.334 por mês; prazo vencido pede a falta inteira; sem prazo, nulo', async () => {
    const l = await larParaOrcamento('meta.mensal');
    const futuro = await criarMeta(l.app, l.titular, { prazo: '2027-01-01' });
    const vencido = await criarMeta(l.app, l.titular, { prazo: '2026-09-01' });
    const sem = await criarMeta(l.app, l.titular, { prazo: null });
    expect((await detalheDaMeta(l.app, l.titular, futuro)).mensal_necessario_centavos).toBe(33_334);
    expect((await detalheDaMeta(l.app, l.titular, vencido)).mensal_necessario_centavos).toBe(100_000);
    expect((await detalheDaMeta(l.app, l.titular, sem)).mensal_necessario_centavos).toBeNull();
  });

  it('a lista põe as não atingidas primeiro, depois por nome; o detalhe traz o guardado por local (saldo > 0, maior primeiro)', async () => {
    const l = await larParaOrcamento('meta.lista');
    const a = await criarMeta(l.app, l.titular, { nome: 'Alfa', alvo_centavos: 1_000 });
    const b = await criarMeta(l.app, l.titular, { nome: 'Beta', alvo_centavos: 100_000 });
    await movimentarOk(l.app, l.titular, a, { valor_centavos: 1_000 });
    await movimentarOk(l.app, l.titular, b, { valor_centavos: 3_000, local: 'Cofre' });
    await movimentarOk(l.app, l.titular, b, { valor_centavos: 9_000, local: 'Nubank' });
    await movimentarOk(l.app, l.titular, b, { valor_centavos: 3_000, local: 'Mercado Pago' });
    await movimentarOk(l.app, l.titular, b, { tipo: 'retirada', valor_centavos: 3_000, local: 'Mercado Pago' });
    const lista = (await listar<{ nome: string; atingida: boolean }>(l.app, '/api/metas', l.titular)).map((x) => [
      x.nome,
      x.atingida,
    ]);
    expect(lista).toEqual([
      ['Beta', false],
      ['Alfa', true],
    ]);
    expect((await detalheDaMeta(l.app, l.titular, b)).por_local).toEqual([
      { local: 'Nubank', guardado_centavos: 9_000 },
      { local: 'Cofre', guardado_centavos: 3_000 },
    ]);
  });
});

describe.skipIf(!bancoDisponivel)('atingida_em marca e desmarca (CA-08.3, CA-08.4)', () => {
  it('o aporte que leva ao alvo marca hoje; mais um aporte mantém a data; a retirada que faz cair abaixo desmarca', async () => {
    const l = await larParaOrcamento('meta.atingida');
    const id = await criarMeta(l.app, l.titular, { alvo_centavos: 10_000 });
    await movimentarOk(l.app, l.titular, id, { valor_centavos: 9_999 });
    expect((await metaNoBanco(id))!.atingida_em).toBeNull();
    await movimentarOk(l.app, l.titular, id, { valor_centavos: 1, data: '2026-10-20' });
    expect((await metaNoBanco(id))!.atingida_em).toBe(HOJE);
    expect(await detalheDaMeta(l.app, l.membro, id)).toMatchObject({
      atingida: true,
      percentual: 100,
      falta_centavos: 0,
    });

    // outro dia: a data original fica (o relógio é o mesmo; basta provar que um aporte extra não a refaz)
    await movimentarOk(l.app, l.membro, id, { valor_centavos: 5_000, local: 'Cofre' });
    expect((await metaNoBanco(id))!.atingida_em).toBe(HOJE);
    expect((await detalheDaMeta(l.app, l.titular, id)).percentual).toBe(100);

    await movimentarOk(l.app, l.titular, id, { tipo: 'retirada', valor_centavos: 5_001, local: 'Nubank' });
    expect((await metaNoBanco(id))!.atingida_em).toBeNull();
    expect(await detalheDaMeta(l.app, l.titular, id)).toMatchObject({ atingida: false, guardado_centavos: 9_999 });
  });

  it('CA-08.4: reduzir o alvo para abaixo do guardado atinge a meta; aumentar acima desatinge', async () => {
    const l = await larParaOrcamento('meta.alvo');
    const id = await criarMeta(l.app, l.titular, { alvo_centavos: 100_000 });
    await movimentarOk(l.app, l.titular, id, { valor_centavos: 30_000 });
    const edita = (alvo: number) =>
      pedir(l.app, 'PUT', `/api/metas/${id}`, l.membro, { nome: 'Viagem', alvo_centavos: alvo });
    expect((await edita(20_000)).status).toBe(200);
    expect((await metaNoBanco(id))!.atingida_em).toBe(HOJE);
    expect(await detalheDaMeta(l.app, l.titular, id)).toMatchObject({ atingida: true, falta_centavos: 0 });
    expect((await edita(40_000)).status).toBe(200);
    expect((await metaNoBanco(id))!.atingida_em).toBeNull();
    expect(await detalheDaMeta(l.app, l.titular, id)).toMatchObject({ atingida: false, falta_centavos: 10_000 });
  });
});

describe.skipIf(!bancoDisponivel)(
  'POST /api/metas/:id/movimentos: retirada limitada ao local (RN-09; CA-09.1, CA-09.2)',
  () => {
    it('CA-09.1: retirada maior que o guardado no local → 422, mesmo com saldo em outros locais; nada é gravado', async () => {
      const l = await larParaOrcamento('mov.limite');
      const id = await criarMeta(l.app, l.titular);
      await movimentarOk(l.app, l.titular, id, { valor_centavos: 10_000, local: 'Nubank' });
      await movimentarOk(l.app, l.titular, id, { valor_centavos: 50_000, local: 'Cofre' });
      const antes = await contagemDeMovimentos(id);

      for (const [local, valor] of [
        ['Nubank', 10_001],
        ['Nubank', 60_000],
        ['Poupança', 1],
      ] as const) {
        const r = await movimentar(l.app, l.titular, id, { tipo: 'retirada', valor_centavos: valor, local });
        expect(r.status, `${local} ${valor}`).toBe(422);
        expect(await json(r)).toMatchObject({ code: 'retirada_maior_que_guardado' });
      }
      expect(await contagemDeMovimentos(id)).toEqual(antes);
      expect(await detalheDaMeta(l.app, l.titular, id)).toMatchObject({ guardado_centavos: 60_000 });

      // exatamente o guardado no local passa; depois dele o local zera e a próxima retirada é recusada
      await movimentarOk(l.app, l.titular, id, { tipo: 'retirada', valor_centavos: 10_000, local: 'Nubank' });
      const de_novo = await movimentar(l.app, l.titular, id, { tipo: 'retirada', valor_centavos: 1, local: 'Nubank' });
      expect(de_novo.status).toBe(422);
      expect((await detalheDaMeta(l.app, l.titular, id)).por_local).toEqual([
        { local: 'Cofre', guardado_centavos: 50_000 },
      ]);
    });

    it('o local é comparado depois de aparado; a retirada de outro membro também respeita o local', async () => {
      const l = await larParaOrcamento('mov.local');
      const id = await criarMeta(l.app, l.titular);
      await movimentarOk(l.app, l.titular, id, { valor_centavos: 5_000, local: '  Nubank  ' });
      expect((await movimentosDaMeta(l.app, l.titular, id))[0]!.local).toBe('Nubank');
      const r = await movimentar(l.app, l.membro, id, { tipo: 'retirada', valor_centavos: 5_001, local: 'Nubank' });
      expect(r.status).toBe(422);
      await movimentarOk(l.app, l.membro, id, { tipo: 'retirada', valor_centavos: 5_000, local: ' Nubank' });
      expect((await detalheDaMeta(l.app, l.titular, id)).guardado_centavos).toBe(0);
    });

    it('CA-09.2: duas retiradas simultâneas que somadas passam do guardado → só uma é aceita', async () => {
      const l = await larParaOrcamento('mov.corrida');
      const id = await criarMeta(l.app, l.titular);
      await movimentarOk(l.app, l.titular, id, { valor_centavos: 10_000, local: 'Nubank' });
      const respostas = await Promise.all([
        movimentar(l.app, l.titular, id, { tipo: 'retirada', valor_centavos: 6_000, local: 'Nubank' }),
        movimentar(l.app, l.membro, id, { tipo: 'retirada', valor_centavos: 6_000, local: 'Nubank' }),
        movimentar(l.app, l.titular, id, { tipo: 'retirada', valor_centavos: 6_000, local: 'Nubank' }),
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([201, 422, 422]);
      expect((await detalheDaMeta(l.app, l.titular, id)).guardado_centavos).toBe(4_000);
    }, 30_000);

    it('CA-T3.3: duas requisições com o MESMO id ao mesmo tempo gravam uma só vez', async () => {
      const l = await larParaOrcamento('mov.mesmoid');
      const meta = await criarMeta(l.app, l.titular);
      const conta = await criarConta(l.app, l.titular, { nome: 'Itaú', saldo_inicial_centavos: 100_000 });
      const mov = novoId();
      const rs = await Promise.all([
        movimentar(l.app, l.titular, meta, { id: mov, valor_centavos: 2_000, conta_id: conta }),
        movimentar(l.app, l.titular, meta, { id: mov, valor_centavos: 2_000, conta_id: conta }),
      ]);
      expect(rs.map((r) => r.status).sort()).toEqual([200, 201]);
      expect(await contagemDeMovimentos(meta)).toEqual({ metas: 1, contas: 1 });
      expect(await saldoDe(l.app, l.titular, conta)).toBe(98_000);
    }, 30_000);

    it('valor_invalido: valor ≤ 0, fracionado, acima de 10^11, local vazio ou com 61 caracteres, tipo desconhecido, data inexistente', async () => {
      const l = await larParaOrcamento('mov.invalido');
      const id = await criarMeta(l.app, l.titular);
      const ruins: Record<string, unknown>[] = [
        { valor_centavos: 0 },
        { valor_centavos: -1 },
        { valor_centavos: 1.5 },
        { valor_centavos: 100_000_000_001 },
        { local: '   ' },
        { local: 'x'.repeat(61) },
        { tipo: 'ajuste' },
        { data: '2026-02-30' },
        { autor_id: novoId() },
      ];
      for (const ruim of ruins) {
        const r = await pedir(l.app, 'POST', `/api/metas/${id}/movimentos`, l.titular, {
          id: novoId(),
          tipo: 'aporte',
          valor_centavos: 100,
          local: 'Nubank',
          ...ruim,
        });
        expect(r.status, JSON.stringify(ruim)).toBe(400);
        expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
      }
      expect(await contagemDeMovimentos(id)).toEqual({ metas: 0, contas: 0 });
      const ok = await movimentar(l.app, l.titular, id, { local: 'x'.repeat(60), valor_centavos: 100_000_000_000 });
      expect(ok.status).toBe(201);
    });

    it('a data padrão é hoje; uma data informada vale', async () => {
      const l = await larParaOrcamento('mov.data');
      const id = await criarMeta(l.app, l.titular);
      await movimentarOk(l.app, l.titular, id, { valor_centavos: 100 });
      await movimentarOk(l.app, l.titular, id, { valor_centavos: 200, data: '2026-09-15' });
      expect((await movimentosDaMeta(l.app, l.titular, id)).map((m) => [m.valor_centavos, m.data])).toEqual([
        [100, HOJE],
        [200, '2026-09-15'],
      ]);
    });
  },
);

describe.skipIf(!bancoDisponivel)('idempotência do movimento (RT-03, CA-T3.4)', () => {
  it('o reenvio pelo mesmo autor devolve 200 { id } sem gravar de novo, mesmo com o corpo diferente', async () => {
    const l = await larParaOrcamento('mov.idem');
    const meta = await criarMeta(l.app, l.titular);
    const conta = await criarConta(l.app, l.titular, { nome: 'Itaú', saldo_inicial_centavos: 100_000 });
    const mov = novoId();
    const r1 = await movimentar(l.app, l.titular, meta, { id: mov, valor_centavos: 2_000, conta_id: conta });
    expect(r1.status).toBe(201);
    expect(saida.IdSalvo.parse(await json(r1))).toEqual({ id: mov });
    const r2 = await movimentar(l.app, l.titular, meta, {
      id: mov,
      valor_centavos: 9_999,
      local: 'Outro',
      tipo: 'retirada',
    });
    expect(r2.status).toBe(200);
    expect(await json(r2)).toEqual({ id: mov });
    expect(await contagemDeMovimentos(meta)).toEqual({ metas: 1, contas: 1 });
    expect(await saldoDe(l.app, l.titular, conta)).toBe(98_000);
    expect(await detalheDaMeta(l.app, l.titular, meta)).toMatchObject({ guardado_centavos: 2_000 });
  });

  it('o id de um movimento de outro membro, ou de uma meta que ele não vê, é registro_invalido', async () => {
    const l = await larParaOrcamento('mov.idalheio');
    const conjunta = await criarMeta(l.app, l.titular);
    const individual = await criarMeta(l.app, l.titular, { nome: 'Da Ana', escopo: 'individual' });
    const doAna = await movimentarOk(l.app, l.titular, conjunta);
    const doAnaInd = await movimentarOk(l.app, l.titular, individual);
    const outra = await criarMeta(l.app, l.membro, { nome: 'Do Bruno' });
    for (const id of [doAna, doAnaInd]) {
      const r = await movimentar(l.app, l.membro, outra, { id });
      expect(r.status, id).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
    expect(await contagemDeMovimentos(outra)).toEqual({ metas: 0, contas: 0 });
    expect(await contagemDeMovimentos(conjunta)).toEqual({ metas: 1, contas: 0 });
  });
});

describe.skipIf(!bancoDisponivel)('conta do movimento (RN-09; CA-09.3, CA-08.5)', () => {
  it('o aporte com conta debita a conta do autor e a retirada credita; a resposta é só o id', async () => {
    const l = await larParaOrcamento('mov.conta');
    const meta = await criarMeta(l.app, l.titular);
    const conta = await criarConta(l.app, l.titular, { nome: 'Itaú', saldo_inicial_centavos: 100_000 });
    const r = await movimentar(l.app, l.titular, meta, { valor_centavos: 30_000, conta_id: conta });
    expect(r.status).toBe(201);
    expect(Object.keys(await json(r))).toEqual(['id']);
    expect(await saldoDe(l.app, l.titular, conta)).toBe(70_000);
    await movimentarOk(l.app, l.titular, meta, { tipo: 'retirada', valor_centavos: 10_000, conta_id: conta });
    expect(await saldoDe(l.app, l.titular, conta)).toBe(80_000);
    // o movimento sem conta não mexe em nenhuma conta
    await movimentarOk(l.app, l.titular, meta, { valor_centavos: 500 });
    expect(await saldoDe(l.app, l.titular, conta)).toBe(80_000);
  });

  it('CA-09.3: conta de outro membro, arquivada, inexistente ou de outro lar → registro_invalido, sem gravar', async () => {
    const l = await larParaOrcamento('mov.conta.ruim');
    const fora = await larParaOrcamento('mov.conta.fora');
    const meta = await criarMeta(l.app, l.titular);
    const doBruno = await criarConta(l.app, l.membro, { nome: 'Do Bruno' });
    const arquivada = await criarConta(l.app, l.titular, { nome: 'Velha' });
    expect((await pedir(l.app, 'POST', `/api/contas/${arquivada}/arquivar`, l.titular)).status).toBe(204);
    const deFora = await criarConta(fora.app, fora.titular, { nome: 'De fora' });
    for (const conta of [doBruno, arquivada, novoId(), deFora]) {
      const r = await movimentar(l.app, l.titular, meta, { conta_id: conta });
      expect(r.status, conta).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
    expect(await contagemDeMovimentos(meta)).toEqual({ metas: 0, contas: 0 });
  });

  it('CA-08.5: B vê o aporte de A com valor, data, local e autor, mas sem a conta; A vê a própria conta', async () => {
    const l = await larParaOrcamento('mov.conta.privada');
    const meta = await criarMeta(l.app, l.titular);
    const conta = await criarConta(l.app, l.titular, { nome: 'Conta-secreta-da-Ana' });
    const mov = await movimentarOk(l.app, l.titular, meta, {
      valor_centavos: 12_345,
      local: 'Nubank',
      conta_id: conta,
      data: '2026-10-05',
    });
    const doBruno = await movimentarOk(l.app, l.membro, meta, { valor_centavos: 100, local: 'Cofre' });

    const deAna = await movimentosDaMeta(l.app, l.titular, meta);
    const paraBruno = await movimentosDaMeta(l.app, l.membro, meta);
    for (const lista of [deAna, paraBruno]) lista.forEach((m) => saida.MovimentoMeta.parse(m));
    expect(deAna.find((m) => m.id === mov)).toEqual({
      id: mov,
      tipo: 'aporte',
      valor_centavos: 12_345,
      data: '2026-10-05',
      local: 'Nubank',
      autor: { nome: 'Titular mov.conta.privada', sou_eu: true },
      conta: { nome: 'Conta-secreta-da-Ana' },
    });
    const visto = paraBruno.find((m) => m.id === mov)!;
    expect(visto).toEqual({
      id: mov,
      tipo: 'aporte',
      valor_centavos: 12_345,
      data: '2026-10-05',
      local: 'Nubank',
      autor: { nome: 'Titular mov.conta.privada', sou_eu: false },
    });
    expect('conta' in visto).toBe(false);
    expect(JSON.stringify(paraBruno)).not.toContain('Conta-secreta-da-Ana');
    expect(JSON.stringify(paraBruno)).not.toContain(conta);
    expect(paraBruno.find((m) => m.id === doBruno)!.autor.sou_eu).toBe(true);
    // a lista vai do mais recente ao mais antigo
    expect(deAna.map((m) => m.data)).toEqual([HOJE, '2026-10-05']);
  });

  it('o autor que saiu do lar fica como "Ex-membro", sem a conta, para quem ficou', async () => {
    const l = await larParaOrcamento('mov.exmembro');
    const meta = await criarMeta(l.app, l.titular);
    const conta = await criarConta(l.app, l.membro, { nome: 'Conta-do-Bruno' });
    const mov = await movimentarOk(l.app, l.membro, meta, { valor_centavos: 700, conta_id: conta });
    expect((await pedir(l.app, 'POST', '/api/lar/sair', l.membro)).status).toBe(204);
    const lista = await movimentosDaMeta(l.app, l.titular, meta);
    const m = lista.find((x) => x.id === mov)!;
    expect(m.autor).toEqual({ nome: 'Ex-membro', sou_eu: false });
    expect('conta' in m).toBe(false);
    expect(JSON.stringify(lista)).not.toContain('Conta-do-Bruno');
    expect(await detalheDaMeta(l.app, l.titular, meta)).toMatchObject({ guardado_centavos: 700 });
  });
});

describe.skipIf(!bancoDisponivel)('movimentos e locais (RN-09; CA-09.5, CA-02.3)', () => {
  it('meta visível sem movimentos devolve lista vazia; meta alheia ou inexistente, a mesma resposta de registro_invalido', async () => {
    const l = await larParaOrcamento('mov.lista');
    const conjunta = await criarMeta(l.app, l.titular);
    const individual = await criarMeta(l.app, l.titular, { escopo: 'individual' });
    expect(await movimentosDaMeta(l.app, l.membro, conjunta)).toEqual([]);
    const alheia = await pedir(l.app, 'GET', `/api/metas/${individual}/movimentos`, l.membro);
    const inexistente = await pedir(l.app, 'GET', `/api/metas/${novoId()}/movimentos`, l.membro);
    expect([alheia.status, await alheia.text()]).toEqual([inexistente.status, await inexistente.text()]);
    expect(alheia.status).toBe(404);
  });

  it('B não movimenta a meta individual de A, com a mesma resposta de meta inexistente', async () => {
    const l = await larParaOrcamento('mov.alheia');
    const individual = await criarMeta(l.app, l.titular, { escopo: 'individual' });
    const alheia = await movimentar(l.app, l.membro, individual, { id: 'a0a0a0a0-0000-4000-8000-000000000001' });
    const inexistente = await movimentar(l.app, l.membro, novoId(), { id: 'a0a0a0a0-0000-4000-8000-000000000001' });
    expect([alheia.status, await alheia.text()]).toEqual([inexistente.status, await inexistente.text()]);
    expect(alheia.status).toBe(404);
    expect(await contagemDeMovimentos(individual)).toEqual({ metas: 0, contas: 0 });
  });

  it('locais: do uso mais recente ao mais antigo, zerados inclusive; o local de uma individual de A nunca aparece para B', async () => {
    const l = await larParaOrcamento('mov.locais');
    const conjunta = await criarMeta(l.app, l.titular);
    const individualAna = await criarMeta(l.app, l.titular, { nome: 'Da Ana', escopo: 'individual' });
    const individualBruno = await criarMeta(l.app, l.membro, { nome: 'Do Bruno', escopo: 'individual' });
    await movimentarOk(l.app, l.titular, conjunta, { local: 'Cofre', data: '2026-10-01' });
    await movimentarOk(l.app, l.titular, conjunta, { local: 'Nubank', data: '2026-10-10' });
    await movimentarOk(l.app, l.titular, conjunta, {
      tipo: 'retirada',
      local: 'Nubank',
      data: '2026-10-11',
      valor_centavos: 1_000,
    });
    await movimentarOk(l.app, l.titular, individualAna, { local: 'Cofre-da-Ana', data: '2026-10-20' });
    await movimentarOk(l.app, l.membro, individualBruno, { local: 'Poupança', data: '2026-10-05' });

    const locais = (quem: typeof l.titular) => listar<string>(l.app, '/api/metas/locais', quem);
    expect(await locais(l.titular)).toEqual(['Cofre-da-Ana', 'Nubank', 'Cofre']);
    const deBruno = await locais(l.membro);
    expect(deBruno).toEqual(['Nubank', 'Poupança', 'Cofre']);
    expect(deBruno).not.toContain('Cofre-da-Ana');
    expect(saida.LocaisGuardados.parse(deBruno)).toEqual(deBruno);
  });
});
