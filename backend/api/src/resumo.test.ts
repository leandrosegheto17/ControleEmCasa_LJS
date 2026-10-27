import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { dataDeCartao } from '@controle/dominio';
import { dataDeCartaoSql } from './consultas/cartao';
import { bancoDisponivel } from './testes-suporte';
import { relogioControlado } from './testes-suporte-acesso';
import { criarConta, criarForma, listar } from './testes-suporte-cadastros';
import { criarFixa, larParaFixas, novoId, ocorrenciaDe, pagarOk, resumo } from './testes-suporte-fixas';
import { lancarDespesa, lancarReceita } from './testes-suporte-lancamentos';
import { appDeLar, criarLarDe, json, linhasComoOwner, pedir, pessoa } from './testes-suporte-lar';

/**
 * `GET /api/resumo` (SDD 6.1 #33; RN-16a a RN-16e, RN-12, RN-13; CA-16.1 a CA-16.9, CA-02.2, CA-11.3, CA-12.4,
 * CA-12.5, CA-13.4; G-12 "mutação invisível", G-51). "Hoje" é 24/10/2026 em São Paulo.
 */

const R = (r: unknown) => saida.ResumoMes.parse(r);

describe.skipIf(!bancoDisponivel)('GET /api/resumo: total do casal e pago por membro (RN-16a)', () => {
  it('CA-16.1: A pagou 100 e B pagou 200 de conjuntas → total 300; pago_por_membro 33% e 67% (o último fecha 100)', async () => {
    const l = await larParaFixas('res.ca161');
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 100,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    await lancarDespesa(l.app, l.membro, {
      valor_centavos: 200,
      categoria_id: l.moradia,
      forma_id: l.bruno.pix,
      data: '2026-10-06',
    });
    for (const quem of [l.titular, l.membro]) {
      const r = R(await resumo(l.app, quem, '2026-10-01'));
      expect(r.conjunto.total_centavos).toBe(300);
      expect(r.conjunto.pago_por_membro.map((p) => [p.nome, p.valor_centavos, p.percentual])).toEqual([
        ['Titular res.ca161', 100, 33],
        ['Membro res.ca161', 200, 67],
      ]);
      // Mercado é variável; Moradia não.
      expect(r.conjunto.total_variaveis_centavos).toBe(100);
      expect(r.conjunto.por_categoria.map((c) => [c.nome, c.total_centavos, c.variavel])).toEqual([
        ['Moradia', 200, false],
        ['Mercado', 100, true],
      ]);
    }
  });

  it('CA-16.2: só A lançou conjuntas → B aparece com 0 e 0%, A com 100%', async () => {
    const l = await larParaFixas('res.ca162');
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 999,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    const r = R(await resumo(l.app, l.membro, '2026-10-01'));
    expect(r.conjunto.pago_por_membro.map((p) => [p.valor_centavos, p.percentual])).toEqual([
      [999, 100],
      [0, 0],
    ]);
  });

  it('CA-16.3: mês sem despesa conjunta → pago_por_membro [] e total 0', async () => {
    const l = await larParaFixas('res.ca163');
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 500,
      categoria_id: l.ana.lazer,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    const r = R(await resumo(l.app, l.titular, '2026-10-01'));
    expect(r.conjunto.total_centavos).toBe(0);
    expect(r.conjunto.pago_por_membro).toEqual([]);
    expect(r.conjunto.por_categoria).toEqual([]);
  });

  it('CA-11.3: lar com 1 membro → pago_por_membro de 1 linha (100%) e os dois blocos completos', async () => {
    const relogio = relogioControlado(new Date('2026-10-24T15:00:00.000Z'));
    const { app } = appDeLar({ relogio: relogio.relogio });
    const so = await pessoa('res.sozinho', 'Sozinha', relogio.agora());
    await criarLarDe(app, so);
    const conta = await criarConta(app, so, { nome: 'Conta' });
    const pix = await criarForma(app, so, { tipo: 'pix', conta_id: conta });
    const cats = await listar<{ id: string; nome: string; escopo: string }>(app, '/api/categorias', so);
    const mercado = cats.find((c) => c.nome === 'Mercado' && c.escopo === 'conjunto')!.id;
    await lancarDespesa(app, so, { valor_centavos: 700, categoria_id: mercado, forma_id: pix, data: '2026-10-05' });
    const r = R(await resumo(app, so, '2026-10-01'));
    expect(r.conjunto.pago_por_membro.map((p) => [p.nome, p.valor_centavos, p.percentual])).toEqual([
      ['Sozinha', 700, 100],
    ]);
    expect(r.individual.minha_parte_conjunto_centavos).toBe(700);
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/resumo: bloco individual e privacidade (RN-16b a RN-16e)', () => {
  it('CA-16.4 e CA-02.2: A com receita 5.000, conjunta 1.000 e individual 500 → meu total 1.500 e resultado 3.500; nada disso aparece para B', async () => {
    const l = await larParaFixas('res.ca164');
    await lancarReceita(l.app, l.titular, {
      valor_centavos: 5_000,
      categoria_id: l.ana.salario,
      conta_id: l.ana.conta,
      data: '2026-10-01',
    });
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 1_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 500,
      categoria_id: l.ana.lazer,
      forma_id: l.ana.credito,
      data: '2026-09-15',
    });
    const a = R(await resumo(l.app, l.titular, '2026-10-01'));
    expect(a.individual).toMatchObject({
      minha_parte_conjunto_centavos: 1_000,
      meu_individual_centavos: 500,
      meu_total_centavos: 1_500,
      receitas_centavos: 5_000,
      resultado: { valor_centavos: 3_500, parcial: true },
    });
    expect(a.individual.por_categoria.map((c) => [c.nome, c.total_centavos])).toEqual([['Lazer pessoal', 500]]);
    expect(a.individual.minha_parte_por_categoria.map((c) => [c.nome, c.total_centavos])).toEqual([['Mercado', 1_000]]);
    // Lazer pessoal e Mercado são variáveis: 500 + 1.000.
    expect(a.individual.total_variaveis_centavos).toBe(1_500);

    const b = R(await resumo(l.app, l.membro, '2026-10-01'));
    expect(b.individual).toMatchObject({
      minha_parte_conjunto_centavos: 0,
      meu_individual_centavos: 0,
      meu_total_centavos: 0,
      receitas_centavos: 0,
      resultado: { valor_centavos: 0, parcial: true },
      por_categoria: [],
      minha_parte_por_categoria: [],
    });
    expect(b.conjunto.total_centavos).toBe(1_000);
    const texto = JSON.stringify(b);
    // Números inteiros, não pedaços de UUID aleatório (ex.: `2bd55000-…` continha '5000' e fazia o teste falhar).
    for (const numero of ['5000', '1500', '3500']) {
      expect(texto, numero).not.toMatch(new RegExp(`(?<![0-9a-fA-F-])${numero}(?![0-9a-fA-F-])`));
    }
    for (const segredo of ['Lazer pessoal', 'Salário', l.ana.conta, l.ana.credito, l.ana.lazer]) {
      expect(texto, segredo).not.toContain(segredo);
    }
    expect(b.individual.contas.map((c) => c.conta_id)).toEqual([l.bruno.conta]);
    expect(b.individual.credito.map((c) => c.forma_id)).toEqual([l.bruno.credito]);
  });

  it('G-12 (mutação invisível): B cria, edita e exclui individual e receita; nenhum número do resumo de A muda', async () => {
    const l = await larParaFixas('res.g12');
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 1_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    await lancarDespesa(l.app, l.membro, {
      valor_centavos: 2_000,
      categoria_id: l.moradia,
      forma_id: l.bruno.pix,
      data: '2026-10-06',
    });
    const antes = await resumo(l.app, l.titular, '2026-10-01');
    const ind = await lancarDespesa(l.app, l.membro, {
      valor_centavos: 3_333,
      categoria_id: l.bruno.lazer,
      forma_id: l.bruno.pix,
      data: '2026-10-07',
    });
    await lancarReceita(l.app, l.membro, {
      valor_centavos: 9_999,
      categoria_id: l.bruno.salario,
      conta_id: l.bruno.conta,
      data: '2026-10-02',
    });
    expect(await resumo(l.app, l.titular, '2026-10-01')).toEqual(antes);
    await pedir(l.app, 'PATCH', `/api/lancamentos/${ind}`, l.membro, { valor_total_centavos: 4_444 });
    expect(await resumo(l.app, l.titular, '2026-10-01')).toEqual(antes);
    await pedir(l.app, 'DELETE', `/api/lancamentos/${ind}`, l.membro);
    expect(await resumo(l.app, l.titular, '2026-10-01')).toEqual(antes);
  });

  it('CA-16.5: compra em 3x com a 2ª parcela em novembro → só essa parcela conta em novembro', async () => {
    const l = await larParaFixas('res.ca165');
    // 15/09 no cartão dia 10: parcelas em 10/10, 10/11 e 10/12, de 3.334, 3.333 e 3.333.
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 10_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.credito,
      parcelas: 3,
      data: '2026-09-15',
    });
    const nov = R(await resumo(l.app, l.titular, '2026-11-01'));
    expect(nov.conjunto.total_centavos).toBe(3_333);
    expect(nov.individual.minha_parte_conjunto_centavos).toBe(3_333);
    expect(R(await resumo(l.app, l.titular, '2026-10-01')).conjunto.total_centavos).toBe(3_334);
    expect(R(await resumo(l.app, l.titular, '2026-09-01')).conjunto.total_centavos).toBe(0);
  });

  it('CA-16.8 e RN-16d: mês corrente e futuro com parcial = true; mês passado fechado; resultado conjunto = 0 − total (sem orçamento)', async () => {
    const l = await larParaFixas('res.ca168');
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 800,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-09-05',
    });
    for (const [mes, fechado] of [
      ['2026-10-01', false],
      ['2027-01-01', false],
      ['2026-09-01', true],
    ] as const) {
      const r = R(await resumo(l.app, l.titular, mes));
      expect(r.mes_fechado, mes).toBe(fechado);
      expect(r.conjunto.resultado.parcial, mes).toBe(!fechado);
      expect(r.individual.resultado.parcial, mes).toBe(!fechado);
    }
    expect(R(await resumo(l.app, l.titular, '2026-09-01')).conjunto.resultado).toEqual({
      valor_centavos: -800,
      parcial: false,
    });
  });

  it('mês ausente é o corrente; qualquer dia é normalizado (CA-T4.2); mês inválido → valor_invalido', async () => {
    const l = await larParaFixas('res.mes');
    expect(R(await resumo(l.app, l.titular)).mes).toBe('2026-10-01');
    expect(R(await resumo(l.app, l.titular, '2026-12-25')).mes).toBe('2026-12-01');
    const r = await pedir(l.app, 'GET', '/api/resumo?mes=2026-02-30', l.titular);
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/resumo: fixas, contas e cartões', () => {
  it('CA-16.9: o resumo garante as ocorrências do mês antes de calcular as fixas pendentes; a paga sai das pendentes e entra no total', async () => {
    const l = await larParaFixas('res.ca169');
    const aluguel = await criarFixa(l.app, l.titular, {
      categoria_id: l.moradia,
      valor_previsto_centavos: 150_000,
      dia_vencimento: 10,
    });
    const luz = await criarFixa(l.app, l.titular, {
      categoria_id: l.moradia,
      descricao: 'Luz',
      valor_previsto_centavos: 20_000,
      dia_vencimento: 28,
    });
    const net = await criarFixa(l.app, l.titular, {
      categoria_id: l.moradia,
      descricao: 'Net',
      valor_previsto_centavos: 10_000,
      dia_vencimento: 15,
    });
    // Nenhuma ocorrência gerada ainda: o resumo é a primeira leitura do mês.
    const r = R(await resumo(l.app, l.membro, '2026-10-01'));
    expect(r.conjunto.fixas_total).toBe(3);
    expect(r.conjunto.fixas_pendentes.map((f) => [f.descricao, f.situacao])).toEqual([
      ['Aluguel', 'atrasada'],
      ['Net', 'atrasada'],
      ['Luz', 'pendente'],
    ]);
    expect(r.conjunto.previsto_a_pagar_centavos).toBe(180_000);
    expect(r.pendentes_previstos_centavos).toBe(180_000);

    const o = await ocorrenciaDe(l.app, l.titular, aluguel, '2026-10-01');
    await pagarOk(l.app, l.titular, o.id, { forma_id: l.ana.pix, valor_centavos: 151_000 });
    const depois = R(await resumo(l.app, l.membro, '2026-10-01'));
    expect(depois.conjunto.fixas_total).toBe(3);
    expect(depois.conjunto.fixas_pendentes.map((f) => f.descricao)).toEqual(['Net', 'Luz']);
    expect(depois.conjunto.previsto_a_pagar_centavos).toBe(30_000);
    expect(depois.conjunto.total_centavos).toBe(151_000);
    expect(depois.conjunto.pago_por_membro[0]).toMatchObject({ valor_centavos: 151_000, percentual: 100 });
    expect(luz && net).toBeTruthy();
  });

  it('CA-12.4: ajuste de saldo e pagamento de cartão não entram em total, nem em resultado', async () => {
    const l = await larParaFixas('res.ca124');
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 1_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    const antes = R(await resumo(l.app, l.titular, '2026-10-01'));
    expect(
      (await pedir(l.app, 'POST', `/api/contas/${l.ana.conta}/ajuste`, l.titular, { saldo_real_centavos: 1 })).status,
    ).toBe(200);
    expect(
      (
        await pedir(l.app, 'POST', `/api/formas/${l.ana.credito}/pagamentos`, l.titular, {
          id: novoId(),
          conta_id: l.ana.conta,
          valor_centavos: 777,
        })
      ).status,
    ).toBe(201);
    const depois = R(await resumo(l.app, l.titular, '2026-10-01'));
    expect({ ...depois.individual, contas: [] }).toEqual({ ...antes.individual, contas: [] });
    expect(depois.conjunto).toEqual(antes.conjunto);
    // O saldo, este sim, reflete o ajuste e o pagamento do cartão (RN-12).
    expect(depois.individual.contas.find((c) => c.conta_id === l.ana.conta)!.saldo_centavos).toBe(1 - 777);
  });

  it('CA-12.5: o resumo mostra o saldo ATUAL de cada conta não arquivada, em qualquer mês navegado', async () => {
    const l = await larParaFixas('res.ca125');
    const velha = await criarConta(l.app, l.titular, { nome: 'Antiga' });
    await pedir(l.app, 'POST', `/api/contas/${velha}/arquivar`, l.titular);
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 5_000,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-10-05',
    });
    // Data futura não afeta o saldo de hoje (CA-12.1).
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 1,
      categoria_id: l.ana.mercado,
      forma_id: l.ana.pix,
      data: '2026-12-05',
    });
    for (const mes of ['2026-01-01', '2026-10-01', '2027-03-01']) {
      const r = R(await resumo(l.app, l.titular, mes));
      expect(r.individual.contas, mes).toEqual([
        { conta_id: l.ana.conta, nome: 'Conta Ana', saldo_centavos: 100_000 - 5_000 },
      ]);
    }
  });

  it('RN-13 e CA-13.4: cartões do membro com gasto e comprometido do mês navegado; o arquivado só aparece com valor', async () => {
    const l = await larParaFixas('res.ca134');
    const vazio = await criarForma(l.app, l.titular, { nome: 'Vazio', tipo: 'credito', dia_vencimento: 20 });
    const comValor = await criarForma(l.app, l.titular, { nome: 'Antigo', tipo: 'credito', dia_vencimento: 10 });
    await lancarDespesa(l.app, l.titular, {
      valor_centavos: 30_000,
      categoria_id: l.ana.lazer,
      forma_id: comValor,
      parcelas: 3,
      data: '2026-10-15',
    });
    for (const f of [vazio, comValor]) await pedir(l.app, 'POST', `/api/formas/${f}/arquivar`, l.titular);
    const out = R(await resumo(l.app, l.titular, '2026-10-01'));
    expect(out.individual.credito.map((c) => [c.nome, c.gasto_mes_centavos, c.comprometido_futuro_centavos])).toEqual([
      ['Antigo', 0, 30_000],
      ['Cartão Ana', 0, 0],
    ]);
    expect(
      R(await resumo(l.app, l.titular, '2026-12-01')).individual.credito.find((c) => c.forma_id === comValor),
    ).toMatchObject({
      gasto_mes_centavos: 10_000,
      comprometido_futuro_centavos: 10_000,
    });
    // Depois da última parcela, o arquivado some.
    expect(R(await resumo(l.app, l.titular, '2027-02-01')).individual.credito.map((c) => c.forma_id)).toEqual([
      l.ana.credito,
    ]);
  });

  it('o bloco de orçamento e as metas ficam vazios até a etapa 10 (orçamento nulo, metas [], guardado 0)', async () => {
    const l = await larParaFixas('res.etapa10');
    const r = R(await resumo(l.app, l.titular, '2026-10-01'));
    expect([r.conjunto.orcamento, r.individual.orcamento, r.conjunto.metas, r.individual.metas]).toEqual([
      null,
      null,
      [],
      [],
    ]);
    expect(r.individual.guardado_no_mes_centavos).toBe(0);
  });
});

describe.skipIf(!bancoDisponivel)('ex-membro no pago por membro (CA-23.12)', () => {
  it('as conjuntas pagas por quem saiu continuam no total, com o pagador "Ex-membro"; quem saiu sem pagar não aparece', async () => {
    const l = await larParaFixas('res.exmembro');
    await lancarDespesa(l.app, l.membro, {
      valor_centavos: 400,
      categoria_id: l.moradia,
      forma_id: l.bruno.pix,
      data: '2026-10-06',
    });
    expect((await pedir(l.app, 'POST', '/api/lar/sair', l.membro)).status).toBe(204);
    const out = R(await resumo(l.app, l.titular, '2026-10-01'));
    expect(out.conjunto.total_centavos).toBe(400);
    expect(out.conjunto.pago_por_membro.map((p) => [p.nome, p.valor_centavos, p.percentual])).toEqual([
      [l.titular.nome, 0, 0],
      ['Ex-membro', 400, 100],
    ]);
    expect(R(await resumo(l.app, l.titular, '2026-11-01')).conjunto.pago_por_membro).toEqual([]);
  });
});

describe.skipIf(!bancoDisponivel)('data de cartão em SQL = domínio (RN-13, CA-13.3)', () => {
  it('a expressão SQL do gasto do cartão devolve a mesma data que dataDeCartao, inclusive nos fins de mês e na virada do ano', async () => {
    const casos: [string, number][] = [];
    for (const data of [
      '2026-01-31',
      '2026-01-28',
      '2027-01-30',
      '2028-01-29',
      '2026-12-31',
      '2026-12-01',
      '2026-10-08',
      '2026-02-28',
    ]) {
      for (const dia of [1, 5, 10, 28, 29, 30, 31]) casos.push([data, dia]);
    }
    const datas = casos.map((c) => c[0]);
    const dias = casos.map((c) => c[1]);
    const r = await linhasComoOwner(
      sql<{ d: string }>`
        select (${dataDeCartaoSql(sql`x.data`, sql`x.dia`)})::text as d
          from unnest(${datas}::date[], ${dias}::smallint[]) with ordinality as x(data, dia, n) order by n`,
    );
    expect(r.map((x) => x.d)).toEqual(
      casos.map(([data, dia]) => {
        const esperado = dataDeCartao(data, dia);
        if (!esperado.ok) throw new Error('caso inválido');
        return esperado.valor;
      }),
    );
  });
});
