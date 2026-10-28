import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { relogioControlado } from './testes-suporte-acesso';
import { criarForma } from './testes-suporte-cadastros';
import {
  detalhe,
  lancarDespesa,
  lancarReceita,
  larParaLancar,
  novoId,
  parcelasNoBanco,
  type App,
} from './testes-suporte-lancamentos';
import { json, novaSessao, pedir, type Pessoa } from './testes-suporte-lar';

/**
 * Detalhe e lista do mês (SDD 6.1 #4, #22, #23; RN-01, RN-02, RN-04; CA-01.4, CA-01.5, CA-02.1, CA-04.1 a CA-04.5,
 * CA-P.1, CA-P.2, CA-T4.2; G-11, D-4: a chave privada não existe no JSON do outro membro).
 */

const CHAVES_PRIVADAS = [
  'pagamento',
  'forma',
  'forma_pagamento_id',
  'conta',
  'conta_id',
  'data_operacao',
  'dia_vencimento_aplicado',
];

describe.skipIf(!bancoDisponivel)('GET /api/lancamentos/:id (RN-04)', () => {
  it('CA-04.1: o pagador recebe `pagamento` (forma, conta, data da operação, dia aplicado) e `data_ajustada` em cada parcela', async () => {
    const { app, titular, ana } = await larParaLancar('det.pagador');
    const id = await lancarDespesa(app, titular, {
      valor_centavos: 3_000,
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      parcelas: 3,
      data: '2026-10-15',
      descricao: 'Sofá',
    });
    const d = saida.LancamentoDoPagador.parse(await detalhe(app, titular, id));
    expect(d).toMatchObject({
      tipo: 'despesa',
      escopo: 'conjunto',
      descricao: 'Sofá',
      categoria: { id: ana.mercado, nome: 'Mercado', escopo: 'conjunto' },
      valor_total_centavos: 3_000,
      num_parcelas: 3,
      pagador: { sou_eu: true, nome: titular.nome },
      // CA-04.4: nunca editado
      alterado_por: null,
      alterado_em: null,
      pagamento: {
        forma: { id: ana.credito, nome: 'Cartão Ana', tipo: 'credito' },
        conta: null,
        data_operacao: '2026-10-15',
        dia_vencimento_aplicado: 10,
      },
    });
    expect(d.parcelas.map((p) => [p.numero, p.data_ajustada])).toEqual([
      [1, false],
      [2, false],
      [3, false],
    ]);
  });

  it('CA-04.2, CA-P.1 e G-11: para o outro membro as chaves `pagamento` e `data_ajustada` NÃO EXISTEM (nem nulas)', async () => {
    const { app, titular, membro, ana } = await larParaLancar('det.outro');
    const id = await lancarDespesa(app, titular, {
      valor_centavos: 3_000,
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    const corpo = await detalhe<Record<string, unknown> & { parcelas: Record<string, unknown>[] }>(app, membro, id);
    expect('pagamento' in corpo).toBe(false);
    for (const chave of CHAVES_PRIVADAS) expect(Object.keys(corpo)).not.toContain(chave);
    for (const p of corpo.parcelas) {
      expect('data_ajustada' in p).toBe(false);
      expect(Object.keys(p).sort()).toEqual(['data', 'id', 'numero', 'valor_centavos']);
    }
    expect(saida.LancamentoDoOutroMembro.parse(corpo)).toMatchObject({
      pagador: { sou_eu: false, nome: titular.nome },
      valor_total_centavos: 3_000,
    });
    // nem o nome da forma, nem o da conta, aparecem em lugar nenhum da resposta
    const texto = JSON.stringify(corpo);
    for (const segredo of ['Cartão Ana', 'Conta Ana', ana.credito, ana.conta, '2026-10-15']) {
      expect(texto).not.toContain(segredo);
    }
  });

  it('CA-04.5: na receita, `pagamento.forma` é nulo e a conta vem preenchida', async () => {
    const { app, titular, ana } = await larParaLancar('det.receita');
    const id = await lancarReceita(app, titular, {
      valor_centavos: 100,
      categoria_id: ana.salario,
      conta_id: ana.conta,
      data: '2026-10-05',
    });
    const d = saida.LancamentoDoPagador.parse(await detalhe(app, titular, id));
    expect(d.pagamento).toEqual({
      forma: null,
      conta: { id: ana.conta, nome: 'Conta Ana' },
      data_operacao: '2026-10-05',
      dia_vencimento_aplicado: null,
    });
  });

  it('CA-04.3: parcela_em_foco é a do mês corrente; sem parcela no mês, a 1ª', async () => {
    const relogio = relogioControlado(new Date('2026-12-20T15:00:00.000Z'));
    const { app, titular, ana } = await larParaLancar('det.foco', { relogio: relogio.relogio, agora: relogio.agora() });
    const id = await lancarDespesa(app, titular, {
      valor_centavos: 300,
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    expect(await detalhe(app, titular, id)).toMatchObject({ parcela_em_foco: 2 });
    const antigo = await lancarDespesa(app, titular, {
      valor_centavos: 300,
      categoria_id: ana.mercado,
      forma_id: ana.pix,
      data: '2025-01-15',
    });
    expect(await detalhe(app, titular, antigo)).toMatchObject({ parcela_em_foco: 1 });
  });

  it('individual do outro membro, de outro lar e inexistente dão a mesma resposta registro_invalido (RT-01)', async () => {
    const { app, titular, membro, ana } = await larParaLancar('det.alheio');
    const fora = await larParaLancar('det.alheio.fora');
    const individual = await lancarDespesa(app, titular, {
      valor_centavos: 100,
      categoria_id: ana.lazer,
      forma_id: ana.pix,
    });
    const r1 = await pedir(app, 'GET', `/api/lancamentos/${individual}`, membro);
    const r2 = await pedir(app, 'GET', `/api/lancamentos/${individual}`, fora.membro);
    const r3 = await pedir(app, 'GET', `/api/lancamentos/${novoId()}`, membro);
    const r4 = await pedir(app, 'GET', '/api/lancamentos/nao-e-uuid', membro);
    const corpos = await Promise.all([r1, r2, r3, r4].map((r) => r.text()));
    expect([r1.status, r2.status, r3.status, r4.status]).toEqual([404, 404, 404, 404]);
    expect(new Set(corpos).size).toBe(1);
    expect(JSON.parse(corpos[0]!)).toMatchObject({ code: 'registro_invalido' });
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/lancamentos?mes= (RN-02, CA-02.1, CA-P.2)', () => {
  type Lista = { mes: string; total_filtrado_centavos: number; quantidade: number; itens: Record<string, unknown>[] };

  it('competência pela data da parcela: a compra de 3x aparece com 1 parcela em cada mês (G-51); mês normalizado (CA-T4.2)', async () => {
    const { app, titular, ana } = await larParaLancar('lista.competencia');
    const id = await lancarDespesa(app, titular, {
      valor_centavos: 10_000,
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      parcelas: 3,
      data: '2026-10-15',
      descricao: 'Geladeira',
    });
    const r = await pedir(app, 'GET', '/api/lancamentos?mes=2026-12-17', titular);
    const lista = saida.LancamentosMes.parse(await json(r));
    expect(lista.mes).toBe('2026-12-01');
    expect(lista.itens).toEqual([
      expect.objectContaining({
        lancamento_id: id,
        data: '2026-12-10',
        descricao: 'Geladeira',
        valor_centavos: 3_333,
        parcela_numero: 2,
        total_parcelas: 3,
        pagador: { id: expect.any(String), nome: titular.nome },
      }),
    ]);
    expect(lista.total_filtrado_centavos).toBe(3_333);
    expect((await json<Lista>(await pedir(app, 'GET', '/api/lancamentos?mes=2026-10-01', titular))).quantidade).toBe(0);
  });

  it('CA-02.1: B não vê o individual de A, nem no total nem na quantidade; vê as conjuntas de A sem nada privado', async () => {
    const { app, titular, membro, ana } = await larParaLancar('lista.privado');
    await lancarDespesa(app, titular, {
      valor_centavos: 777,
      categoria_id: ana.lazer,
      forma_id: ana.pix,
      data: '2026-10-03',
    });
    await lancarDespesa(app, titular, {
      valor_centavos: 200,
      categoria_id: ana.mercado,
      forma_id: ana.pix,
      data: '2026-10-04',
    });
    const lista = await json<Lista>(await pedir(app, 'GET', '/api/lancamentos?mes=2026-10-01', membro));
    expect(lista.quantidade).toBe(1);
    expect(lista.total_filtrado_centavos).toBe(200);
    const texto = JSON.stringify(lista);
    // O 777 como valor JSON (não como pedaço de UUID aleatório, que nasceria "777" por acaso).
    expect(texto).not.toMatch(/[:,[]777[,}\]]/);
    for (const item of lista.itens) {
      for (const chave of CHAVES_PRIVADAS) expect(Object.keys(item)).not.toContain(chave);
      expect('data_ajustada' in item).toBe(false);
    }
    // A vê os dois
    const daAna = await json<Lista>(await pedir(app, 'GET', '/api/lancamentos?mes=2026-10-01', titular));
    expect(daAna.quantidade).toBe(2);
    expect(daAna.total_filtrado_centavos).toBe(977);
  });

  it('receitas entram na lista e na quantidade, mas não no total; ordem por data desc', async () => {
    const { app, titular, ana } = await larParaLancar('lista.receita');
    await lancarDespesa(app, titular, {
      valor_centavos: 100,
      categoria_id: ana.mercado,
      forma_id: ana.pix,
      data: '2026-10-02',
    });
    await lancarReceita(app, titular, {
      valor_centavos: 5_000,
      categoria_id: ana.salario,
      conta_id: ana.conta,
      data: '2026-10-05',
    });
    const lista = await json<Lista>(await pedir(app, 'GET', '/api/lancamentos?mes=2026-10-01', titular));
    expect(lista.quantidade).toBe(2);
    expect(lista.total_filtrado_centavos).toBe(100);
    expect(lista.itens.map((i) => i['data'])).toEqual(['2026-10-05', '2026-10-02']);
  });

  it('filtros: escopo, categoria, variável e forma (só as formas do próprio membro; a do outro dá lista vazia, CA-P.2)', async () => {
    const { app, titular, membro, ana, bruno } = await larParaLancar('lista.filtros');
    await lancarDespesa(app, titular, {
      valor_centavos: 100,
      categoria_id: ana.mercado,
      forma_id: ana.pix,
      data: '2026-10-02',
    });
    await lancarDespesa(app, titular, {
      valor_centavos: 200,
      categoria_id: ana.lazer,
      forma_id: ana.credito,
      data: '2026-09-02',
    });
    await lancarDespesa(app, membro, {
      valor_centavos: 300,
      categoria_id: bruno.mercado,
      forma_id: bruno.pix,
      data: '2026-10-03',
    });
    const total = async (quem: typeof titular, q: string) =>
      (await json<Lista>(await pedir(app, 'GET', `/api/lancamentos?mes=2026-10-01${q}`, quem))).total_filtrado_centavos;
    expect(await total(titular, '')).toBe(600);
    expect(await total(titular, '&escopo=conjunto')).toBe(400);
    expect(await total(titular, '&escopo=individual')).toBe(200);
    expect(await total(titular, `&categoria_id=${ana.lazer}`)).toBe(200);
    expect(await total(titular, '&variavel=true')).toBe(600); // Mercado e Lazer pessoal são variáveis
    expect(await total(titular, '&variavel=false')).toBe(0);
    expect(await total(titular, `&forma_id=${ana.pix}`)).toBe(100);
    expect(await total(titular, `&forma_id=${ana.credito}`)).toBe(200);
    // B filtrando pela forma de A: vazio, sem erro (não revela a forma)
    const r = await pedir(app, 'GET', `/api/lancamentos?mes=2026-10-01&forma_id=${ana.pix}`, membro);
    expect(r.status).toBe(200);
    expect(await json(r)).toMatchObject({ quantidade: 0, total_filtrado_centavos: 0, itens: [] });
    // B filtrando pela categoria individual de A: vazio
    expect(await total(membro, `&categoria_id=${ana.lazer}`)).toBe(0);
    // filtros devolvidos como vieram
    expect(
      (
        await json<Lista & { filtros: unknown }>(
          await pedir(app, 'GET', `/api/lancamentos?mes=2026-10-01&escopo=conjunto`, titular),
        )
      ).filtros,
    ).toEqual({
      escopo: 'conjunto',
      categoria_id: null,
      forma_id: null,
      variavel: null,
    });
  });

  it('mês ausente, inválido ou escopo desconhecido → valor_invalido', async () => {
    const { app, titular } = await larParaLancar('lista.invalida');
    for (const q of ['', '?mes=2026-13-01', '?mes=2026-10-01&escopo=casal', '?mes=2026-10-01&variavel=talvez']) {
      const r = await pedir(app, 'GET', `/api/lancamentos${q}`, titular);
      expect(r.status, q).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });
});

describe.skipIf(!bancoDisponivel)('GET /api/lancamentos/dados (RN-01)', () => {
  it('CA-01.4: sem preferida e sem despesa, forma_padrao_id é nulo; depois vale a da despesa mais recente; a preferida vence', async () => {
    const { app, titular, ana } = await larParaLancar('dados.padrao');
    const dados = async () =>
      saida.DadosLancamento.parse(await json(await pedir(app, 'GET', '/api/lancamentos/dados', titular)));
    expect((await dados()).forma_padrao_id).toBeNull();
    expect((await dados()).conta_receita_padrao_id).toBeNull();
    await lancarDespesa(app, titular, { valor_centavos: 1, categoria_id: ana.mercado, forma_id: ana.credito });
    expect((await dados()).forma_padrao_id).toBe(ana.credito);
    await pedir(app, 'PUT', `/api/formas/${ana.pix}/preferida`, titular, { preferida: true });
    expect((await dados()).forma_padrao_id).toBe(ana.pix);
    // CA-01.5: arquivar a preferida tira a preferência e o padrão
    await pedir(app, 'POST', `/api/formas/${ana.pix}/arquivar`, titular);
    const d = await dados();
    expect(d.forma_padrao_id).toBe(ana.credito);
    expect(d.formas.map((f) => f.id)).not.toContain(ana.pix);
    await lancarReceita(app, titular, { valor_centavos: 1, categoria_id: ana.salario, conta_id: ana.conta });
    expect((await dados()).conta_receita_padrao_id).toBe(ana.conta);
  });

  it('categorias ordenadas pelo uso do PRÓPRIO membro: as conjuntas lançadas pelo outro não mudam a ordem dele', async () => {
    const { app, titular, membro, ana, bruno } = await larParaLancar('dados.ordem');
    const primeira = async (quem: typeof titular) =>
      saida.DadosLancamento.parse(await json(await pedir(app, 'GET', '/api/lancamentos/dados', quem)))
        .categorias_despesa[0]!.id;
    const antesDaAna = await primeira(titular);
    for (let i = 0; i < 3; i++) {
      await lancarDespesa(app, membro, { valor_centavos: 1, categoria_id: bruno.mercado, forma_id: bruno.pix });
    }
    expect(await primeira(membro)).toBe(bruno.mercado);
    expect(await primeira(titular)).toBe(antesDaAna);
    await lancarDespesa(app, titular, { valor_centavos: 1, categoria_id: ana.lazer, forma_id: ana.pix });
    expect(await primeira(titular)).toBe(ana.lazer);
    // nem as formas nem as contas do outro aparecem
    const texto = JSON.stringify(await json(await pedir(app, 'GET', '/api/lancamentos/dados', titular)));
    for (const segredo of [bruno.pix, bruno.credito, bruno.conta, bruno.lazer]) expect(texto).not.toContain(segredo);
  });
});

describe.skipIf(!bancoDisponivel)('saldo da conta com lançamentos (RN-12, RN-05, RN-13)', () => {
  type Conta = { id: string; saldo_centavos: number; pode_excluir: boolean };
  const conta = async (app: App, quem: Pessoa, id: string) =>
    (await json<Conta[]>(await pedir(app, 'GET', '/api/contas', quem))).find((c) => c.id === id)!;

  it('CA-05.1: a conjunta no Pix debita a conta do pagador; a receita credita; o Crédito não mexe (CA-05.2); a data futura não conta (CA-12.1)', async () => {
    const relogio = relogioControlado(new Date('2026-10-24T15:00:00.000Z'));
    const { app, titular, membro, ana, bruno } = await larParaLancar('saldo.lanc', {
      relogio: relogio.relogio,
      agora: relogio.agora(),
    });
    const saldoBrunoAntes = (await conta(app, membro, bruno.conta)).saldo_centavos;
    await lancarDespesa(app, titular, {
      valor_centavos: 1_000,
      categoria_id: ana.mercado,
      forma_id: ana.pix,
      data: '2026-10-20',
    });
    await lancarDespesa(app, titular, {
      valor_centavos: 3_000,
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      parcelas: 3,
      data: '2026-10-20',
    });
    await lancarReceita(app, titular, {
      valor_centavos: 5_000,
      categoria_id: ana.salario,
      conta_id: ana.conta,
      data: '2026-10-01',
    });
    await lancarDespesa(app, titular, {
      valor_centavos: 9_999,
      categoria_id: ana.mercado,
      forma_id: ana.pix,
      data: '2026-10-25',
    });
    const debito = await criarForma(app, titular, { nome: 'Débito', tipo: 'debito', conta_id: ana.conta });
    await lancarDespesa(app, titular, {
      valor_centavos: 50,
      categoria_id: ana.lazer,
      forma_id: debito,
      data: '2026-10-24',
    });
    const c = await conta(app, titular, ana.conta);
    expect(c.saldo_centavos).toBe(100_000 - 1_000 + 5_000 - 50);
    expect(c.pode_excluir).toBe(false);
    expect((await conta(app, membro, bruno.conta)).saldo_centavos).toBe(saldoBrunoAntes);
    // no dia seguinte, a despesa de 25/10 passa a contar
    relogio.avancar(24 * 60 * 60 * 1000);
    const amanha = { ...titular, cookie: await novaSessao(titular.id, relogio.agora()) };
    expect((await conta(app, amanha, ana.conta)).saldo_centavos).toBe(100_000 - 1_000 + 5_000 - 50 - 9_999);
  });

  it('CA-03.5: excluir a conta ou a forma usadas num lançamento → em_uso; a categoria → categoria_em_uso', async () => {
    const { app, titular, ana } = await larParaLancar('saldo.em-uso');
    await lancarDespesa(app, titular, { valor_centavos: 1, categoria_id: ana.lazer, forma_id: ana.pix });
    expect(await json(await pedir(app, 'DELETE', `/api/formas/${ana.pix}`, titular))).toMatchObject({ code: 'em_uso' });
    expect(await json(await pedir(app, 'DELETE', `/api/categorias/${ana.lazer}`, titular))).toMatchObject({
      code: 'categoria_em_uso',
    });
    const formas = await json<{ id: string; pode_excluir: boolean }[]>(await pedir(app, 'GET', '/api/formas', titular));
    expect(formas.find((f) => f.id === ana.pix)!.pode_excluir).toBe(false);
    const categorias = await json<{ id: string; pode_excluir: boolean }[]>(
      await pedir(app, 'GET', '/api/categorias', titular),
    );
    expect(categorias.find((c) => c.id === ana.lazer)!.pode_excluir).toBe(false);
    expect(categorias.find((c) => c.id === ana.salario)!.pode_excluir).toBe(true);
  });

  it('CA-03.3: mudar o dia do cartão de 10 para 15 não mexe nas parcelas já lançadas; só as compras novas usam o 15', async () => {
    const { app, titular, ana } = await larParaLancar('saldo.dia');
    const antiga = await lancarDespesa(app, titular, {
      valor_centavos: 200,
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      parcelas: 2,
      data: '2026-10-15',
    });
    await pedir(app, 'PUT', `/api/formas/${ana.credito}`, titular, {
      nome: 'Cartão Ana',
      tipo: 'credito',
      dia_vencimento: 15,
    });
    expect((await parcelasNoBanco(antiga)).map((p) => p.data)).toEqual(['2026-11-10', '2026-12-10']);
    const nova = await lancarDespesa(app, titular, {
      valor_centavos: 200,
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      data: '2026-10-15',
    });
    expect((await parcelasNoBanco(nova)).map((p) => p.data)).toEqual(['2026-11-15']);
  });
});

describe.skipIf(!bancoDisponivel)('id alheio na rota de detalhe e lista (G-03)', () => {
  it('lar_id na query é valor_invalido (o lar vem do vínculo)', async () => {
    const { app, titular } = await larParaLancar('lista.lar');
    const r = await pedir(app, 'GET', `/api/lancamentos?mes=2026-10-01&lar_id=${novoId()}`, titular);
    expect(r.status).toBe(400);
  });
});
