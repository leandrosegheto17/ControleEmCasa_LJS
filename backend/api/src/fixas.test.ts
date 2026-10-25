import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { criarCategoria, criarForma, listar } from './testes-suporte-cadastros';
import {
  criarFixa,
  fixaNoBanco,
  larParaFixas,
  novoId,
  ocorrenciaComoOwner,
  ocorrenciaDe,
  ocorrencias,
  ocorrenciasNoBanco,
  pagar,
  pagarOk,
} from './testes-suporte-fixas';
import { lancamentoNoBanco, parcelasNoBanco, saldoDe } from './testes-suporte-lancamentos';
import {
  appDeLar,
  criarLarDe,
  json,
  linhasComoOwner,
  novaSessao,
  pedir,
  pessoa,
  tokenDoConvite,
} from './testes-suporte-lar';

/**
 * Despesas fixas e ocorrências pela API (SDD 6.1 #27 a #32; RN-15; CA-15.1 a CA-15.9, CA-T3.5, CA-T4.2). "Hoje" é
 * 24/10/2026 em São Paulo (relógio parado), o mesmo do exemplo do CA-15.2.
 */

const muda = (inicio: string, fixa: string) =>
  linhasComoOwner(sql`update app.despesa_fixa set inicio = ${inicio}::date where id = ${fixa} returning id`);

describe.skipIf(!bancoDisponivel)('PUT /api/fixas/:id (RN-15)', () => {
  it('cria com 201, início no mês de hoje; o reenvio do mesmo id edita com 200; o outro membro também edita', async () => {
    const { app, titular, membro, moradia } = await larParaFixas('fixa.criar');
    const id = novoId();
    const corpo = {
      descricao: '  Aluguel ',
      categoria_id: moradia,
      valor_previsto_centavos: 150_000,
      dia_vencimento: 10,
    };
    const r = await pedir(app, 'PUT', `/api/fixas/${id}`, titular, corpo);
    expect(r.status).toBe(201);
    expect(saida.IdSalvo.parse(await json(r))).toEqual({ id });
    expect(await fixaNoBanco(id)).toEqual({
      descricao: 'Aluguel',
      previsto: '150000',
      dia: 10,
      inicio: '2026-10-01',
      encerrada_em: null,
    });
    const r2 = await pedir(app, 'PUT', `/api/fixas/${id}`, membro, { ...corpo, valor_previsto_centavos: 160_000 });
    expect(r2.status).toBe(200);
    expect(await fixaNoBanco(id)).toMatchObject({ previsto: '160000', inicio: '2026-10-01' });
  });

  it('CA-15.9: categoria individual (minha ou do outro), de receita, inexistente ou de outro lar → registro_invalido, sem gravar', async () => {
    const { app, titular, ana, bruno } = await larParaFixas('fixa.cat');
    const fora = await larParaFixas('fixa.cat.fora');
    for (const categoria_id of [ana.lazer, bruno.lazer, ana.salario, novoId(), fora.moradia]) {
      const id = novoId();
      const r = await pedir(app, 'PUT', `/api/fixas/${id}`, titular, {
        descricao: 'Luz',
        categoria_id,
        valor_previsto_centavos: 100,
        dia_vencimento: 5,
      });
      expect(r.status, categoria_id).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
      expect(await fixaNoBanco(id)).toBeNull();
    }
  });

  it('valor_invalido: descrição vazia, previsto 0 ou acima de 10^11, dia 0 ou 32; vem antes do registro_invalido da categoria', async () => {
    const { app, titular, moradia } = await larParaFixas('fixa.valor');
    const base = { descricao: 'Luz', categoria_id: moradia, valor_previsto_centavos: 100, dia_vencimento: 5 };
    for (const mudanca of [
      { descricao: '   ' },
      { valor_previsto_centavos: 0 },
      { valor_previsto_centavos: 100_000_000_001 },
      { dia_vencimento: 0 },
      { dia_vencimento: 32 },
      { descricao: '', categoria_id: novoId() },
    ]) {
      const r = await pedir(app, 'PUT', `/api/fixas/${novoId()}`, titular, { ...base, ...mudanca });
      expect(r.status, JSON.stringify(mudanca)).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });

  it('fixa encerrada não é editada (valor_invalido)', async () => {
    const { app, titular, moradia } = await larParaFixas('fixa.encerrada');
    const id = await criarFixa(app, titular, { categoria_id: moradia });
    expect((await pedir(app, 'POST', `/api/fixas/${id}/encerrar`, titular)).status).toBe(204);
    const r = await pedir(app, 'PUT', `/api/fixas/${id}`, titular, {
      descricao: 'Outra',
      categoria_id: moradia,
      valor_previsto_centavos: 1,
      dia_vencimento: 1,
    });
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    expect(await fixaNoBanco(id)).toMatchObject({ descricao: 'Aluguel', previsto: '150000' });
  });

  it('RT-03: o id de uma fixa de outro lar → registro_invalido, e a fixa de lá fica intacta', async () => {
    const a = await larParaFixas('fixa.idfora.a');
    const b = await larParaFixas('fixa.idfora.b');
    const id = await criarFixa(a.app, a.titular, { categoria_id: a.moradia });
    const r = await pedir(b.app, 'PUT', `/api/fixas/${id}`, b.titular, {
      descricao: 'Invadida',
      categoria_id: b.moradia,
      valor_previsto_centavos: 1,
      dia_vencimento: 1,
    });
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    expect(await fixaNoBanco(id)).toMatchObject({ descricao: 'Aluguel', previsto: '150000' });
  });

  it('editar previsto e dia atualiza as PENDENTES do mês corrente em diante; paga e mês passado ficam intactos', async () => {
    const { app, titular, ana, moradia } = await larParaFixas('fixa.editar');
    const id = await criarFixa(app, titular, { categoria_id: moradia, dia_vencimento: 10 });
    await muda('2026-08-01', id);
    for (const mes of ['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01']) await ocorrencias(app, titular, mes);
    const novembro = await ocorrenciaDe(app, titular, id, '2026-11-01');
    await pagarOk(app, titular, novembro.id, { forma_id: ana.pix });

    const r = await pedir(app, 'PUT', `/api/fixas/${id}`, titular, {
      descricao: 'Aluguel',
      categoria_id: moradia,
      valor_previsto_centavos: 160_000,
      dia_vencimento: 31,
    });
    expect(r.status).toBe(200);
    const gravadas = (await ocorrenciasNoBanco(id)).map((o) => [o.mes, o.vencimento, o.previsto]);
    expect(gravadas).toEqual([
      ['2026-09-01', '2026-09-10', '150000'],
      ['2026-10-01', '2026-10-31', '160000'],
      ['2026-11-01', '2026-11-10', '150000'],
      ['2026-12-01', '2026-12-31', '160000'],
    ]);
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/fixas (RN-15)', () => {
  it('os dois membros veem os modelos do lar, ativas primeiro; a encerrada traz encerrada_em; nada de outro lar', async () => {
    const { app, titular, membro, moradia } = await larParaFixas('fixa.lista');
    const fora = await larParaFixas('fixa.lista.fora');
    await criarFixa(fora.app, fora.titular, { categoria_id: fora.moradia, descricao: 'De fora' });
    const luz = await criarFixa(app, membro, {
      categoria_id: moradia,
      descricao: 'Luz',
      valor_previsto_centavos: 20_000,
    });
    const agua = await criarFixa(app, titular, { categoria_id: moradia, descricao: 'Água', dia_vencimento: 5 });
    await pedir(app, 'POST', `/api/fixas/${agua}/encerrar`, membro);
    const lista = await listar<Record<string, unknown>>(app, '/api/fixas', titular);
    for (const l of lista) saida.LinhaDespesasFixas.parse(l);
    expect(lista.map((l) => [l['id'], l['encerrada_em']])).toEqual([
      [luz, null],
      [agua, '2026-10-24'],
    ]);
    expect(lista[0]).toEqual({
      id: luz,
      descricao: 'Luz',
      categoria_id: moradia,
      categoria: 'Moradia',
      valor_previsto_centavos: 20_000,
      dia_vencimento: 10,
      encerrada_em: null,
    });
    expect(await listar(app, '/api/fixas', membro)).toEqual(lista);
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/fixas/ocorrencias (RN-15)', () => {
  it('CA-15.1: duas (ou mais) consultas simultâneas geram exatamente 1 ocorrência por fixa ativa', async () => {
    const { app, titular, membro, moradia } = await larParaFixas('ocor.concorrente');
    const a = await criarFixa(app, titular, { categoria_id: moradia });
    const b = await criarFixa(app, titular, { categoria_id: moradia, descricao: 'Luz' });
    const respostas = await Promise.all(
      [titular, membro, titular, membro, titular].map((q) =>
        pedir(app, 'GET', '/api/fixas/ocorrencias?mes=2026-11-01', q),
      ),
    );
    expect(respostas.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect((await ocorrenciasNoBanco(a)).length).toBe(1);
    expect((await ocorrenciasNoBanco(b)).length).toBe(1);
  });

  it('CA-15.2: hoje 24/10/2026, novembro/2027 vem vazio e nada é gravado; outubro/2027 e outubro/2025 geram', async () => {
    const { app, titular, moradia } = await larParaFixas('ocor.janela');
    const id = await criarFixa(app, titular, { categoria_id: moradia });
    await muda('2025-01-01', id);
    const fora = await ocorrencias(app, titular, '2027-11-01');
    expect(fora).toEqual({ mes: '2027-11-01', pagas: 0, total: 0, previsto_a_pagar_centavos: 0, ocorrencias: [] });
    expect(await ocorrenciasNoBanco(id)).toEqual([]);
    expect((await ocorrencias(app, titular, '2027-10-01')).total).toBe(1);
    expect((await ocorrencias(app, titular, '2025-10-01')).total).toBe(1);
    expect((await ocorrencias(app, titular, '2025-09-01')).total).toBe(0);
    expect((await ocorrenciasNoBanco(id)).map((o) => o.mes)).toEqual(['2025-10-01', '2027-10-01']);
  });

  it('CA-15.3: fixa de dia 31 em fevereiro/2027 vence em 28/02/2027; CA-T4.2: o mês é normalizado', async () => {
    const { app, titular, moradia } = await larParaFixas('ocor.dia31');
    const id = await criarFixa(app, titular, { categoria_id: moradia, dia_vencimento: 31 });
    const r = await ocorrencias(app, titular, '2027-02-17');
    expect(r.mes).toBe('2027-02-01');
    expect(r.ocorrencias.map((o) => [o.despesa_fixa_id, o.vencimento])).toEqual([[id, '2027-02-28']]);
  });

  it('antes do mês de início a fixa não gera', async () => {
    const { app, titular, moradia } = await larParaFixas('ocor.inicio');
    await criarFixa(app, titular, { categoria_id: moradia });
    expect((await ocorrencias(app, titular, '2026-09-01')).total).toBe(0);
  });

  it('situação (paga, atrasada, pendente), ordem, contagem e previsto a pagar; forma, conta e data do pagamento nunca saem', async () => {
    const { app, titular, membro, ana, moradia } = await larParaFixas('ocor.situacao');
    const atrasada = await criarFixa(app, titular, {
      categoria_id: moradia,
      descricao: 'Luz',
      dia_vencimento: 5,
      valor_previsto_centavos: 1_000,
    });
    const pendente = await criarFixa(app, titular, {
      categoria_id: moradia,
      descricao: 'Água',
      dia_vencimento: 30,
      valor_previsto_centavos: 2_000,
    });
    const hoje = await criarFixa(app, titular, {
      categoria_id: moradia,
      descricao: 'Gás',
      dia_vencimento: 24,
      valor_previsto_centavos: 3_000,
    });
    const paga = await criarFixa(app, titular, {
      categoria_id: moradia,
      descricao: 'Net',
      dia_vencimento: 1,
      valor_previsto_centavos: 4_000,
    });
    const oPaga = await ocorrenciaDe(app, titular, paga, '2026-10-01');
    await pagarOk(app, titular, oPaga.id, { forma_id: ana.pix, valor_centavos: 4_100 });

    for (const quem of [titular, membro]) {
      const r = await pedir(app, 'GET', '/api/fixas/ocorrencias?mes=2026-10-01', quem);
      const corpo = saida.OcorrenciasMes.parse(await json(r));
      expect(corpo.ocorrencias.map((o) => [o.despesa_fixa_id, o.situacao])).toEqual([
        [atrasada, 'atrasada'],
        [hoje, 'pendente'],
        [pendente, 'pendente'],
        [paga, 'paga'],
      ]);
      expect(corpo.pagas).toBe(1);
      expect(corpo.total).toBe(4);
      expect(corpo.previsto_a_pagar_centavos).toBe(6_000);
      const p = corpo.ocorrencias[3]!;
      expect(p.valor_pago_centavos).toBe(4_100);
      expect(p.pagador).toEqual({ nome: 'Titular ocor.situacao', sou_eu: quem === titular });
      expect(corpo.ocorrencias[0]!.pagador).toBeNull();
      expect(corpo.ocorrencias[0]!.valor_pago_centavos).toBeNull();
      const texto = JSON.stringify(corpo);
      for (const s of [ana.pix, ana.conta, 'data_operacao', 'forma', 'conta']) expect(texto).not.toContain(s);
    }
  });

  it('mês ausente ou inválido → valor_invalido', async () => {
    const { app, titular } = await larParaFixas('ocor.mes');
    for (const q of ['', '?mes=2026-13-01', '?mes=x']) {
      const r = await pedir(app, 'GET', `/api/fixas/ocorrencias${q}`, titular);
      expect(r.status).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });
});

describe.skipIf(!bancoDisponivel)('POST /api/fixas/:id/encerrar (RN-15)', () => {
  it('CA-15.4: o mês do encerramento continua; a pendente de novembro já gerada é apagada; a paga de novembro fica', async () => {
    const { app, titular, membro, bruno, moradia, larId } = await larParaFixas('enc.ca154');
    const pendente = await criarFixa(app, titular, { categoria_id: moradia, descricao: 'Luz' });
    const paga = await criarFixa(app, titular, { categoria_id: moradia, descricao: 'Net' });
    await ocorrencias(app, titular, '2026-10-01');
    await ocorrencias(app, titular, '2026-11-01');
    await ocorrencias(app, titular, '2026-12-01');
    const novembroPaga = await ocorrenciaDe(app, titular, paga, '2026-11-01');
    await pagarOk(app, membro, novembroPaga.id, { forma_id: bruno.pix });

    for (const id of [pendente, paga])
      expect((await pedir(app, 'POST', `/api/fixas/${id}/encerrar`, membro)).status).toBe(204);
    expect(await fixaNoBanco(pendente)).toMatchObject({ encerrada_em: '2026-10-24' });
    expect((await ocorrenciasNoBanco(pendente)).map((o) => o.mes)).toEqual(['2026-10-01']);
    expect((await ocorrenciasNoBanco(paga)).map((o) => o.mes)).toEqual(['2026-10-01', '2026-11-01']);
    // Outubro continua gerando; novembro e dezembro não geram de novo.
    expect((await ocorrencias(app, titular, '2026-10-01')).total).toBe(2);
    expect((await ocorrencias(app, titular, '2026-11-01')).ocorrencias.map((o) => o.despesa_fixa_id)).toEqual([paga]);
    expect((await ocorrencias(app, titular, '2026-12-01')).total).toBe(0);
    expect(larId).toBeTruthy();
  });

  it('CA-T3.5: encerrar de novo (em outro dia) não move a data do primeiro encerramento', async () => {
    const { app, titular, relogio, moradia } = await larParaFixas('enc.repetido');
    const id = await criarFixa(app, titular, { categoria_id: moradia });
    expect((await pedir(app, 'POST', `/api/fixas/${id}/encerrar`, titular)).status).toBe(204);
    relogio.avancar(3 * 24 * 60 * 60 * 1000);
    const depois = { ...titular, cookie: await novaSessao(titular.id, relogio.agora()) };
    expect((await pedir(app, 'POST', `/api/fixas/${id}/encerrar`, depois)).status).toBe(204);
    expect(await fixaNoBanco(id)).toMatchObject({ encerrada_em: '2026-10-24' });
  });

  it('inexistente ou de outro lar → registro_invalido', async () => {
    const a = await larParaFixas('enc.fora.a');
    const b = await larParaFixas('enc.fora.b');
    const id = await criarFixa(a.app, a.titular, { categoria_id: a.moradia });
    for (const alvo of [id, novoId()]) {
      const r = await pedir(b.app, 'POST', `/api/fixas/${alvo}/encerrar`, b.titular);
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
    expect(await fixaNoBanco(id)).toMatchObject({ encerrada_em: null });
  });
});

describe.skipIf(!bancoDisponivel)('POST /api/ocorrencias/:id/pagamento (RN-15)', () => {
  it('CA-15.8 e I-20: pago no Crédito, cria um lançamento conjunto do pagador com 1 parcela NO VENCIMENTO (10/10), contando em outubro', async () => {
    const { app, titular, membro, ana, moradia } = await larParaFixas('pagar.credito');
    const fixa = await criarFixa(app, titular, { categoria_id: moradia });
    const o = await ocorrenciaDe(app, titular, fixa, '2026-10-01');
    const id = novoId();
    const r = await pagar(app, titular, o.id, { id, forma_id: ana.credito, data: '2026-10-08' });
    expect(r.status).toBe(201);
    const corpo = saida.PagamentoOcorrencia.parse(await json(r));
    expect(corpo).toEqual({
      ocorrencia_id: o.id,
      lancamento_id: id,
      situacao: 'paga',
      valor_pago_centavos: 150_000,
      vencimento: '2026-10-10',
      ja_existia: false,
    });
    expect(await lancamentoNoBanco(id)).toMatchObject({
      escopo: 'conjunto',
      categoria_id: moradia,
      descricao: 'Aluguel',
      valor: '150000',
      num_parcelas: 1,
    });
    expect((await parcelasNoBanco(id)).map((p) => [p.numero, p.valor_centavos, p.data])).toEqual([
      [1, 150_000, '2026-10-10'],
    ]);
    // O outro membro vê o pagamento conjunto na lista de outubro (data = vencimento).
    const lista = await json<{ itens: { lancamento_id: string; data: string }[] }>(
      await pedir(app, 'GET', '/api/lancamentos?mes=2026-10-01', membro),
    );
    expect(lista.itens.filter((i) => i.lancamento_id === id).map((i) => i.data)).toEqual(['2026-10-10']);
  });

  it('Pix: o valor e a data informados; a conta do pagador cai na data da operação (RN-12)', async () => {
    const { app, titular, ana, moradia } = await larParaFixas('pagar.pix');
    const fixa = await criarFixa(app, titular, { categoria_id: moradia });
    const o = await ocorrenciaDe(app, titular, fixa, '2026-11-01');
    const antes = await saldoDe(app, titular, ana.conta);
    const id = await pagarOk(app, titular, o.id, { forma_id: ana.pix, valor_centavos: 12_345, data: '2026-10-20' });
    expect(await saldoDe(app, titular, ana.conta)).toBe(antes - 12_345);
    expect((await parcelasNoBanco(id)).map((p) => p.data)).toEqual(['2026-11-10']);
  });

  it('CA-15.5: paga, pagar de novo com outro id → ocorrencia_paga; mesmo id do mesmo membro → o gravado (200, ja_existia); mesmo id pelo outro membro → registro_invalido', async () => {
    const { app, titular, membro, ana, bruno, moradia } = await larParaFixas('pagar.repetir');
    const fixa = await criarFixa(app, titular, { categoria_id: moradia });
    const o = await ocorrenciaDe(app, titular, fixa, '2026-10-01');
    const id = await pagarOk(app, titular, o.id, { forma_id: ana.pix });

    const outro = await pagar(app, membro, o.id, { forma_id: bruno.pix });
    expect(outro.status).toBe(409);
    expect(await json(outro)).toMatchObject({ code: 'ocorrencia_paga' });

    // RT-03: sem comparar o corpo do reenvio (valor e forma diferentes).
    const reenvio = await pagar(app, titular, o.id, { id, forma_id: ana.credito, valor_centavos: 1 });
    expect(reenvio.status).toBe(200);
    expect(await json(reenvio)).toEqual({
      ocorrencia_id: o.id,
      lancamento_id: id,
      situacao: 'paga',
      valor_pago_centavos: 150_000,
      vencimento: '2026-10-10',
      ja_existia: true,
    });
    const deB = await pagar(app, membro, o.id, { id, forma_id: bruno.pix });
    expect(deB.status).toBe(404);
    expect(await json(deB)).toMatchObject({ code: 'registro_invalido' });
    expect((await parcelasNoBanco(id)).length).toBe(1);
  });

  it('CA-15.5 (corrida): dois membros pagam a mesma ocorrência ao mesmo tempo → um 201 e um ocorrencia_paga', async () => {
    const { app, titular, membro, ana, bruno, moradia } = await larParaFixas('pagar.corrida');
    const fixa = await criarFixa(app, titular, { categoria_id: moradia });
    const o = await ocorrenciaDe(app, titular, fixa, '2026-10-01');
    const rs = await Promise.all([
      pagar(app, titular, o.id, { forma_id: ana.pix }),
      pagar(app, membro, o.id, { forma_id: bruno.pix }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('CA-15.6: data antes de 01/01/2000 ou depois de hoje + 30 → valor_invalido; os limites passam', async () => {
    const { app, titular, ana, moradia } = await larParaFixas('pagar.data');
    const fixas = [];
    for (const d of ['A', 'B', 'C', 'D'])
      fixas.push(await criarFixa(app, titular, { categoria_id: moradia, descricao: d }));
    const os = await Promise.all(fixas.map((f) => ocorrenciaDe(app, titular, f, '2026-10-01')));
    for (const [i, data] of [
      [0, '1999-12-31'],
      [1, '2026-11-24'],
    ] as const) {
      const r = await pagar(app, titular, os[i]!.id, { forma_id: ana.pix, data });
      expect(r.status, data).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
    expect((await pagar(app, titular, os[2]!.id, { forma_id: ana.pix, data: '2000-01-01' })).status).toBe(201);
    expect((await pagar(app, titular, os[3]!.id, { forma_id: ana.pix, data: '2026-11-23' })).status).toBe(201);
  });

  it('valor 0 ou acima de 10^11 → valor_invalido', async () => {
    const { app, titular, ana, moradia } = await larParaFixas('pagar.valor');
    const o = await ocorrenciaDe(app, titular, await criarFixa(app, titular, { categoria_id: moradia }), '2026-10-01');
    for (const valor_centavos of [0, -1, 100_000_000_001]) {
      const r = await pagar(app, titular, o.id, { forma_id: ana.pix, valor_centavos });
      expect(r.status).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });

  it('ordem das recusas (RT-02): ocorrência e forma (registro_invalido) → valor → forma_arquivada → ocorrencia_paga', async () => {
    const { app, titular, membro, ana, bruno, moradia } = await larParaFixas('pagar.ordem');
    const o = await ocorrenciaDe(app, titular, await criarFixa(app, titular, { categoria_id: moradia }), '2026-10-01');
    const arquivada = await criarForma(app, titular, { nome: 'Velha', tipo: 'pix', conta_id: ana.conta });
    await pedir(app, 'POST', `/api/formas/${arquivada}/arquivar`, titular);
    const casos: [unknown, number, string][] = [
      [{ forma_id: bruno.pix, valor_centavos: 0 }, 404, 'registro_invalido'],
      [{ forma_id: novoId() }, 404, 'registro_invalido'],
      [{ forma_id: arquivada, valor_centavos: 0 }, 400, 'valor_invalido'],
      [{ forma_id: arquivada }, 422, 'forma_arquivada'],
    ];
    for (const [corpo, status, code] of casos) {
      const r = await pedir(app, 'POST', `/api/ocorrencias/${o.id}/pagamento`, titular, {
        id: novoId(),
        ...(corpo as object),
      });
      expect(r.status, JSON.stringify(corpo)).toBe(status);
      expect(await json(r)).toMatchObject({ code });
    }
    await pagarOk(app, membro, o.id, { forma_id: bruno.pix });
    const r = await pagar(app, titular, o.id, { forma_id: arquivada });
    expect(await json(r)).toMatchObject({ code: 'forma_arquivada' });
    const inexistente = await pagar(app, titular, novoId(), { forma_id: ana.pix });
    expect(inexistente.status).toBe(404);
    expect(await json(inexistente)).toMatchObject({ code: 'registro_invalido' });
  });
});

describe.skipIf(!bancoDisponivel)('DELETE /api/ocorrencias/:id/pagamento e exclusão do pagamento (RN-15)', () => {
  it('o pagador desfaz: o lançamento some (parcela e parte privada), o saldo volta e a ocorrência volta a pendente', async () => {
    const { app, titular, ana, moradia } = await larParaFixas('desfazer.ok');
    const fixa = await criarFixa(app, titular, { categoria_id: moradia });
    const o = await ocorrenciaDe(app, titular, fixa, '2026-11-01');
    const antes = await saldoDe(app, titular, ana.conta);
    const id = await pagarOk(app, titular, o.id, { forma_id: ana.pix });
    expect((await pedir(app, 'DELETE', `/api/ocorrencias/${o.id}/pagamento`, titular)).status).toBe(204);
    expect(await lancamentoNoBanco(id)).toBeNull();
    expect(await saldoDe(app, titular, ana.conta)).toBe(antes);
    expect(await ocorrenciaDe(app, titular, fixa, '2026-11-01')).toMatchObject({
      situacao: 'pendente',
      pagador: null,
      valor_pago_centavos: null,
    });
    // CA-T3.5: já pendente → sucesso sem efeito.
    expect((await pedir(app, 'DELETE', `/api/ocorrencias/${o.id}/pagamento`, titular)).status).toBe(204);
    // Pode pagar de novo depois de desfazer.
    expect((await pagar(app, titular, o.id, { forma_id: ana.pix })).status).toBe(201);
  });

  it('CA-15.7 e CA-28.7: o outro membro não desfaz nem exclui o pagamento feito por A (registro_invalido); continua paga', async () => {
    const { app, titular, membro, ana, moradia } = await larParaFixas('desfazer.outro');
    const fixa = await criarFixa(app, titular, { categoria_id: moradia });
    const o = await ocorrenciaDe(app, titular, fixa, '2026-10-01');
    const id = await pagarOk(app, titular, o.id, { forma_id: ana.pix });
    for (const [metodo, rota] of [
      ['DELETE', `/api/ocorrencias/${o.id}/pagamento`],
      ['DELETE', `/api/lancamentos/${id}`],
    ] as const) {
      const r = await pedir(app, metodo, rota, membro);
      expect(r.status, rota).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
    expect((await ocorrenciaDe(app, titular, fixa, '2026-10-01')).situacao).toBe('paga');
    expect(await lancamentoNoBanco(id)).not.toBeNull();
  });

  it('excluir o lançamento de pagamento (pelo pagador) volta a ocorrência a pendente (SDD #26)', async () => {
    const { app, titular, ana, moradia } = await larParaFixas('desfazer.excluir');
    const fixa = await criarFixa(app, titular, { categoria_id: moradia });
    const o = await ocorrenciaDe(app, titular, fixa, '2026-10-01');
    const id = await pagarOk(app, titular, o.id, { forma_id: ana.pix });
    expect((await pedir(app, 'DELETE', `/api/lancamentos/${id}`, titular)).status).toBe(204);
    expect(await ocorrenciaDe(app, titular, fixa, '2026-10-01')).toMatchObject({ situacao: 'atrasada', pagador: null });
    expect((await ocorrenciasNoBanco(fixa))[0]!.lancamento_id).toBeNull();
  });

  it('inexistente ou de outro lar → registro_invalido', async () => {
    const a = await larParaFixas('desfazer.fora.a');
    const b = await larParaFixas('desfazer.fora.b');
    const o = await ocorrenciaDe(
      a.app,
      a.titular,
      await criarFixa(a.app, a.titular, { categoria_id: a.moradia }),
      '2026-10-01',
    );
    const id = await pagarOk(a.app, a.titular, o.id, { forma_id: a.ana.pix });
    for (const alvo of [o.id, novoId()]) {
      const r = await pedir(b.app, 'DELETE', `/api/ocorrencias/${alvo}/pagamento`, b.titular);
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
    expect(await lancamentoNoBanco(id)).not.toBeNull();
  });
});

/**
 * Defeito do legado (ANALISE §2.3; RN-28, decisão P7; SDD 12.2 "Correção da fixa"): no MyMoney, editar o valor do
 * pagamento de uma fixa recalculava as parcelas pela regra comum, tirando a parcela do vencimento (no Crédito ela ia
 * para o vencimento do cartão do mês seguinte; no Pix, para a data da operação), e deixava trocar para categoria
 * individual. Estes testes reproduzem o cenário e falhariam com o comportamento do legado.
 */
describe.skipIf(!bancoDisponivel)(
  'RN-28: o pagamento de fixa fica sempre com 1 parcela no vencimento, conjunta',
  () => {
    async function pagoNoCredito(prefixo: string) {
      const l = await larParaFixas(prefixo);
      const cartao5 = await criarForma(l.app, l.titular, { nome: 'Cartão 5', tipo: 'credito', dia_vencimento: 5 });
      const fixa = await criarFixa(l.app, l.titular, { categoria_id: l.moradia });
      const o = await ocorrenciaDe(l.app, l.titular, fixa, '2026-10-01');
      const id = await pagarOk(l.app, l.titular, o.id, { forma_id: cartao5, data: '2026-10-08' });
      return { ...l, cartao5, fixa, o, id };
    }

    const cartaoNoResumo = async (l: Awaited<ReturnType<typeof pagoNoCredito>>, mes: string) => {
      const resposta = await pedir(l.app, 'GET', `/api/resumo?mes=${mes}`, l.titular);
      expect(resposta.status, await resposta.clone().text()).toBe(200);
      const r = await json<{
        individual: {
          credito: { forma_id: string; gasto_mes_centavos: number; comprometido_futuro_centavos: number }[];
        };
      }>(resposta);
      return r.individual.credito.find((c) => c.forma_id === l.cartao5);
    };

    it('CA-13.3: vencimento 10/10, pago no Crédito (dia 5) em 08/10 → o cartão mostra o valor em 05/11 e a casa conta em outubro', async () => {
      const l = await pagoNoCredito('rn28.ca133');
      expect(await cartaoNoResumo(l, '2026-10-01')).toMatchObject({
        gasto_mes_centavos: 0,
        comprometido_futuro_centavos: 150_000,
      });
      expect(await cartaoNoResumo(l, '2026-11-01')).toMatchObject({
        gasto_mes_centavos: 150_000,
        comprometido_futuro_centavos: 0,
      });
      const outubro = await json<{ conjunto: { total_centavos: number } }>(
        await pedir(l.app, 'GET', '/api/resumo?mes=2026-10-01', l.membro),
      );
      expect(outubro.conjunto.total_centavos).toBe(150_000);
    });

    it('CA-28.1: o pagador edita o valor do pagamento no Crédito → a parcela única fica em 10/10 com o novo valor, e o cartão reflete o valor na data de cartão', async () => {
      const l = await pagoNoCredito('rn28.ca281');
      const r = await pedir(l.app, 'PATCH', `/api/lancamentos/${l.id}`, l.titular, { valor_total_centavos: 170_000 });
      expect(r.status).toBe(200);
      expect((await parcelasNoBanco(l.id)).map((p) => [p.numero, p.valor_centavos, p.data, p.data_ajustada])).toEqual([
        [1, 170_000, '2026-10-10', false],
      ]);
      expect(await cartaoNoResumo(l, '2026-11-01')).toMatchObject({ gasto_mes_centavos: 170_000 });
      expect((await ocorrenciaDe(l.app, l.titular, l.fixa, '2026-10-01')).valor_pago_centavos).toBe(170_000);
    });

    it('CA-28.2: pago no Pix em 12/10 (vencimento 10/10), editar o valor mantém a parcela em 10/10', async () => {
      const l = await larParaFixas('rn28.ca282');
      const fixa = await criarFixa(l.app, l.titular, { categoria_id: l.moradia });
      const o = await ocorrenciaDe(l.app, l.titular, fixa, '2026-10-01');
      const id = await pagarOk(l.app, l.titular, o.id, { forma_id: l.ana.pix, data: '2026-10-12' });
      expect(
        (await pedir(l.app, 'PATCH', `/api/lancamentos/${id}`, l.titular, { valor_total_centavos: 99_999 })).status,
      ).toBe(200);
      expect((await parcelasNoBanco(id)).map((p) => [p.valor_centavos, p.data])).toEqual([[99_999, '2026-10-10']]);
    });

    it('a data da operação muda (dentro da faixa) e a parcela fica no vencimento; fora da faixa → valor_invalido', async () => {
      const l = await pagoNoCredito('rn28.data');
      expect((await pedir(l.app, 'PATCH', `/api/lancamentos/${l.id}`, l.titular, { data: '2026-10-20' })).status).toBe(
        200,
      );
      expect((await parcelasNoBanco(l.id)).map((p) => p.data)).toEqual(['2026-10-10']);
      // Data de cartão nova: 20/10 com dia 5 → 05/11.
      expect(await cartaoNoResumo(l, '2026-11-01')).toMatchObject({ gasto_mes_centavos: 150_000 });
      for (const data of ['2026-11-24', '1999-12-31']) {
        const r = await pedir(l.app, 'PATCH', `/api/lancamentos/${l.id}`, l.titular, { data });
        expect(r.status, data).toBe(400);
        expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
      }
    });

    it('CA-28.3: trocar para uma categoria individual do pagador → sem_permissao, sem gravar; outra conjunta de despesa é aceita', async () => {
      const l = await pagoNoCredito('rn28.ca283');
      const r = await pedir(l.app, 'PATCH', `/api/lancamentos/${l.id}`, l.titular, {
        categoria_id: l.ana.lazer,
        valor_total_centavos: 1_000,
      });
      expect(r.status).toBe(403);
      expect(await json(r)).toMatchObject({ code: 'sem_permissao' });
      expect(await lancamentoNoBanco(l.id)).toMatchObject({
        escopo: 'conjunto',
        categoria_id: l.moradia,
        valor: '150000',
      });
      const contas = await criarCategoria(l.app, l.titular, {
        nome: 'Condomínio',
        tipo: 'despesa',
        escopo: 'conjunto',
      });
      expect(
        (await pedir(l.app, 'PATCH', `/api/lancamentos/${l.id}`, l.titular, { categoria_id: contas })).status,
      ).toBe(200);
      expect(await lancamentoNoBanco(l.id)).toMatchObject({ escopo: 'conjunto', categoria_id: contas });
      expect((await parcelasNoBanco(l.id)).map((p) => p.data)).toEqual(['2026-10-10']);
    });

    it('CA-28.4: mudar o nº de parcelas para 2 → valor_invalido', async () => {
      const l = await pagoNoCredito('rn28.ca284');
      const r = await pedir(l.app, 'PATCH', `/api/lancamentos/${l.id}`, l.titular, { num_parcelas: 2 });
      expect(r.status).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
      expect((await parcelasNoBanco(l.id)).length).toBe(1);
    });

    it('CA-28.5: alterar a data da parcela do pagamento de fixa no Crédito → registro_invalido', async () => {
      const l = await pagoNoCredito('rn28.ca285');
      const parcela = (await parcelasNoBanco(l.id))[0]!;
      const r = await pedir(l.app, 'PATCH', `/api/parcelas/${parcela.id}`, l.titular, { data: '2026-10-25' });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
      expect((await parcelasNoBanco(l.id))[0]).toMatchObject({ data: '2026-10-10', data_ajustada: false });
    });

    it('CA-28.6: trocar a forma de Pix para Crédito → a conta deixa de ser debitada, a parcela fica no vencimento e o cartão passa a mostrar', async () => {
      const l = await larParaFixas('rn28.ca286');
      const fixa = await criarFixa(l.app, l.titular, { categoria_id: l.moradia });
      const o = await ocorrenciaDe(l.app, l.titular, fixa, '2026-10-01');
      const antes = await saldoDe(l.app, l.titular, l.ana.conta);
      const id = await pagarOk(l.app, l.titular, o.id, { forma_id: l.ana.pix, data: '2026-10-08' });
      expect(await saldoDe(l.app, l.titular, l.ana.conta)).toBe(antes - 150_000);
      expect(
        (await pedir(l.app, 'PATCH', `/api/lancamentos/${id}`, l.titular, { forma_id: l.ana.credito })).status,
      ).toBe(200);
      expect(await saldoDe(l.app, l.titular, l.ana.conta)).toBe(antes);
      expect((await parcelasNoBanco(id)).map((p) => [p.numero, p.data])).toEqual([[1, '2026-10-10']]);
      const formas = await listar<{
        id: string;
        gasto_mes_centavos: number | null;
        comprometido_futuro_centavos: number | null;
      }>(l.app, '/api/formas', l.titular);
      // Data de cartão: 08/10 com o dia 10 do cartão → 10/11 (comprometido em relação a outubro).
      expect(formas.find((f) => f.id === l.ana.credito)).toMatchObject({
        gasto_mes_centavos: 0,
        comprometido_futuro_centavos: 150_000,
      });
    });

    it('CA-28.7: o outro membro não edita o pagamento (sem_permissao)', async () => {
      const l = await pagoNoCredito('rn28.ca287');
      for (const corpo of [
        { descricao: 'Mudei' },
        { valor_total_centavos: 1 },
        { categoria_id: l.moradia, descricao: 'x' },
      ]) {
        const r = await pedir(l.app, 'PATCH', `/api/lancamentos/${l.id}`, l.membro, corpo);
        expect(r.status, JSON.stringify(corpo)).toBe(403);
        expect(await json(r)).toMatchObject({ code: 'sem_permissao' });
      }
      expect(await lancamentoNoBanco(l.id)).toMatchObject({ descricao: 'Aluguel', valor: '150000' });
    });

    it('um lançamento comum (sem ocorrência) continua com o recálculo normal: Crédito vai para o vencimento do mês seguinte', async () => {
      const l = await larParaFixas('rn28.comum');
      const r = await pedir(l.app, 'POST', '/api/lancamentos/despesas', l.titular, {
        id: novoId(),
        valor_centavos: 1_000,
        categoria_id: l.moradia,
        forma_id: l.ana.credito,
        data: '2026-10-08',
      });
      const { id } = await json<{ id: string }>(r);
      await pedir(l.app, 'PATCH', `/api/lancamentos/${id}`, l.titular, { valor_total_centavos: 2_000 });
      expect((await parcelasNoBanco(id)).map((p) => p.data)).toEqual(['2026-11-10']);
    });
  },
);

describe.skipIf(!bancoDisponivel)('GET /api/formas: gasto e comprometido do Crédito (RN-13)', () => {
  it('CA-13.1: R$ 300 em 3x com a 1ª parcela no mês → gasto 100 e comprometido 200; Pix leva nulo; pagamento de cartão não abate', async () => {
    const l = await larParaFixas('formas.gasto');
    await pedir(l.app, 'POST', '/api/lancamentos/despesas', l.titular, {
      id: novoId(),
      valor_centavos: 30_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-09-15',
    });
    await pedir(l.app, 'POST', `/api/formas/${l.ana.credito}/pagamentos`, l.titular, {
      id: novoId(),
      conta_id: l.ana.conta,
      valor_centavos: 5_000,
    });
    const formas = await listar<{
      id: string;
      gasto_mes_centavos: number | null;
      comprometido_futuro_centavos: number | null;
    }>(l.app, '/api/formas', l.titular);
    expect(formas.find((f) => f.id === l.ana.credito)).toMatchObject({
      gasto_mes_centavos: 10_000,
      comprometido_futuro_centavos: 20_000,
    });
    expect(formas.find((f) => f.id === l.ana.pix)).toMatchObject({
      gasto_mes_centavos: null,
      comprometido_futuro_centavos: null,
    });
    // O outro membro não vê o cartão de Ana nem o gasto dele.
    const deB = await listar<{ id: string; gasto_mes_centavos: number | null }>(l.app, '/api/formas', l.membro);
    expect(deB.map((f) => f.id)).not.toContain(l.ana.credito);
    expect(deB.find((f) => f.id === l.bruno.credito)).toMatchObject({ gasto_mes_centavos: 0 });
  });
});

describe.skipIf(!bancoDisponivel)('vínculos das fixas com os cadastros e o lar', () => {
  it('categoria usada numa fixa: pode_excluir falso e excluir → categoria_em_uso (RN-17)', async () => {
    const l = await larParaFixas('fixa.categoria.uso');
    const agua = await criarCategoria(l.app, l.titular, { nome: 'Água', tipo: 'despesa', escopo: 'conjunto' });
    await criarFixa(l.app, l.titular, { categoria_id: agua });
    const cats = await listar<{ id: string; pode_excluir: boolean }>(l.app, '/api/categorias', l.membro);
    expect(cats.find((c) => c.id === agua)).toMatchObject({ pode_excluir: false });
    const r = await pedir(l.app, 'DELETE', `/api/categorias/${agua}`, l.membro);
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'categoria_em_uso' });
  });

  it('CA-23.9 e CA-23.10: lar próprio só com as iniciais e UMA fixa não é descartável: o aceite dá ja_tem_lar', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('fixa.convite.ana');
    await criarLarDe(app, ana);
    const bruno = await pessoa('fixa.convite.bruno');
    await criarLarDe(app, bruno);
    const cats = await listar<{ id: string; nome: string; escopo: string }>(app, '/api/categorias', bruno);
    const moradia = cats.find((c) => c.nome === 'Moradia' && c.escopo === 'conjunto')!.id;
    await criarFixa(app, bruno, { categoria_id: moradia });
    expect((await pedir(app, 'POST', '/api/lar/convites', ana, { email: bruno.email })).status).toBe(201);
    const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token: tokenDoConvite(caixa, bruno.email) });
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'ja_tem_lar' });
  });
});

describe.skipIf(!bancoDisponivel)('ocorrência de mês passado gravada antes', () => {
  it('a geração não corrige ocorrência já gerada (RN-15)', async () => {
    const { app, titular, moradia, larId } = await larParaFixas('ocor.naocorrige');
    const fixa = await criarFixa(app, titular, { categoria_id: moradia });
    await ocorrenciaComoOwner({ larId, fixa, mes: '2026-12-01', vencimento: '2026-12-03', previsto: 7 });
    const o = await ocorrenciaDe(app, titular, fixa, '2026-12-01');
    expect([o.vencimento, o.valor_previsto_centavos]).toEqual(['2026-12-03', 7]);
  });
});
