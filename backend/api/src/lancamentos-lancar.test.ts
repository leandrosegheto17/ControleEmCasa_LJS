import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { relogioControlado } from './testes-suporte-acesso';
import { criarCategoria, criarConta, criarForma } from './testes-suporte-cadastros';
import {
  lancamentoNoBanco,
  larParaLancar,
  novoId,
  pagamentoNoBanco,
  parcelasNoBanco,
} from './testes-suporte-lancamentos';
import { json, pedir } from './testes-suporte-lar';

/**
 * Lançar despesa e receita (SDD 6.1 #20 e #21; RN-01, RN-05, RN-14, RN-17, RN-18; RT-02; CA-01.1 a CA-01.3,
 * CA-04.5, CA-14.2, CA-18.1, CA-18.2, CA-T2.1, CA-T2.2, CA-T5.1, CA-T5.2). Testes escritos a partir dos critérios.
 */

const DESPESAS = '/api/lancamentos/despesas';
const RECEITAS = '/api/lancamentos/receitas';

describe.skipIf(!bancoDisponivel)('POST /api/lancamentos/despesas', () => {
  it('CA-01.1 e CA-14.2: conjunta no Pix nasce conjunta, paga por quem lançou, 1 parcela na data; 201 com ja_existia false', async () => {
    const { app, titular, ana } = await larParaLancar('lanc.pix');
    const id = novoId();
    const r = await pedir(app, 'POST', DESPESAS, titular, {
      id,
      valor_centavos: 12_345,
      categoria_id: ana.mercado,
      forma_id: ana.pix,
      data: '2026-10-15',
      descricao: '  Feira  ',
    });
    expect(r.status).toBe(201);
    expect(saida.LancarDespesa.parse(await json(r))).toEqual({
      id,
      escopo: 'conjunto',
      categoria: 'Mercado',
      valor_total_centavos: 12_345,
      num_parcelas: 1,
      primeira_parcela_data: '2026-10-15',
      ja_existia: false,
    });
    expect(await lancamentoNoBanco(id)).toMatchObject({ escopo: 'conjunto', descricao: 'Feira', alterado_por: null });
    expect(await parcelasNoBanco(id)).toMatchObject([{ numero: 1, valor_centavos: 12_345, data: '2026-10-15' }]);
    expect(await pagamentoNoBanco(id)).toEqual({
      forma_pagamento_id: ana.pix,
      conta_id: ana.conta,
      data_operacao: '2026-10-15',
      dia: null,
    });
  });

  it('RN-14 caso 4 e CA-T5.2: Crédito 3x de 100,00 em 15/10 com dia 10 → 3.334, 3.333, 3.333 de nov a jan; sem conta; dia congelado gravado', async () => {
    const { app, titular, ana } = await larParaLancar('lanc.credito');
    const id = novoId();
    const r = await pedir(app, 'POST', DESPESAS, titular, {
      id,
      valor_centavos: 10_000,
      categoria_id: ana.lazer,
      forma_id: ana.credito,
      parcelas: 3,
      data: '2026-10-15',
    });
    expect(r.status).toBe(201);
    expect(await json(r)).toMatchObject({ escopo: 'individual', num_parcelas: 3, primeira_parcela_data: '2026-11-10' });
    const parcelas = await parcelasNoBanco(id);
    expect(parcelas.map((p) => [p.numero, p.valor_centavos, p.data])).toEqual([
      [1, 3_334, '2026-11-10'],
      [2, 3_333, '2026-12-10'],
      [3, 3_333, '2027-01-10'],
    ]);
    expect(parcelas.reduce((s, p) => s + p.valor_centavos, 0)).toBe(10_000);
    expect(await pagamentoNoBanco(id)).toMatchObject({ conta_id: null, dia: 10 });
  });

  it('padrões: sem data vale hoje em São Paulo (RT-04) e sem parcelas vale 1; descrição só com espaços vira nula (CA-18.2)', async () => {
    // 01:30 UTC de 25/10 = 22:30 de 24/10 em São Paulo
    const relogio = relogioControlado(new Date('2026-10-25T01:30:00.000Z'));
    const { app, titular, ana } = await larParaLancar('lanc.padroes', {
      relogio: relogio.relogio,
      agora: relogio.agora(),
    });
    const id = novoId();
    const r = await pedir(app, 'POST', DESPESAS, titular, {
      id,
      valor_centavos: 500,
      categoria_id: ana.mercado,
      forma_id: ana.pix,
      descricao: '   ',
    });
    expect(r.status).toBe(201);
    expect(await json(r)).toMatchObject({ primeira_parcela_data: '2026-10-24', num_parcelas: 1 });
    expect(await lancamentoNoBanco(id)).toMatchObject({ descricao: null });
  });

  it('CA-18.1 e CA-T5.1: valor 0, negativo ou acima de 10^11 é valor_invalido; 1 e 10^11 passam', async () => {
    const { app, titular, ana } = await larParaLancar('lanc.valor');
    for (const valor of [0, -1, 100_000_000_001]) {
      const r = await pedir(app, 'POST', DESPESAS, titular, {
        id: novoId(),
        valor_centavos: valor,
        categoria_id: ana.mercado,
        forma_id: ana.pix,
      });
      expect(r.status, String(valor)).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
    for (const valor of [1, 100_000_000_000]) {
      const r = await pedir(app, 'POST', DESPESAS, titular, {
        id: novoId(),
        valor_centavos: valor,
        categoria_id: ana.mercado,
        forma_id: ana.pix,
      });
      expect(r.status, String(valor)).toBe(201);
    }
  });

  it('RN-14: Pix com 2 parcelas, Crédito com 0 ou 25, Crédito com total menor que N e descrição acima de 120 → valor_invalido', async () => {
    const { app, titular, ana } = await larParaLancar('lanc.parcelas');
    const casos = [
      { forma_id: ana.pix, parcelas: 2, valor_centavos: 10_000 },
      { forma_id: ana.credito, parcelas: 0, valor_centavos: 10_000 },
      { forma_id: ana.credito, parcelas: 25, valor_centavos: 10_000 },
      { forma_id: ana.credito, parcelas: 3, valor_centavos: 2 },
      { forma_id: ana.pix, valor_centavos: 100, descricao: 'a'.repeat(121) },
    ];
    for (const caso of casos) {
      const r = await pedir(app, 'POST', DESPESAS, titular, { id: novoId(), categoria_id: ana.mercado, ...caso });
      expect(await json(r), JSON.stringify(caso)).toMatchObject({ code: 'valor_invalido' });
    }
    const ok = await pedir(app, 'POST', DESPESAS, titular, {
      id: novoId(),
      categoria_id: ana.mercado,
      forma_id: ana.credito,
      parcelas: 24,
      valor_centavos: 24,
      descricao: 'a'.repeat(120),
    });
    expect(ok.status).toBe(201);
  });

  it('CA-01.3: categoria de receita, inexistente, de outro lar ou individual do outro membro → registro_invalido; forma do outro também', async () => {
    const { app, titular, ana, bruno } = await larParaLancar('lanc.cat');
    const fora = await larParaLancar('lanc.cat.fora');
    for (const categoria_id of [ana.salario, novoId(), fora.ana.mercado, bruno.lazer]) {
      const r = await pedir(app, 'POST', DESPESAS, titular, {
        id: novoId(),
        valor_centavos: 100,
        categoria_id,
        forma_id: ana.pix,
      });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
    for (const forma_id of [bruno.pix, novoId(), fora.ana.pix]) {
      const r = await pedir(app, 'POST', DESPESAS, titular, {
        id: novoId(),
        valor_centavos: 100,
        categoria_id: ana.mercado,
        forma_id,
      });
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
  });

  it('CA-01.2: um campo de escopo (ou de dono) no corpo é recusado pelo contrato', async () => {
    const { app, titular, ana } = await larParaLancar('lanc.escopo');
    for (const extra of [{ escopo: 'individual' }, { dono_id: novoId() }, { lar_id: novoId() }]) {
      const r = await pedir(app, 'POST', DESPESAS, titular, {
        id: novoId(),
        valor_centavos: 100,
        categoria_id: ana.mercado,
        forma_id: ana.pix,
        ...extra,
      });
      expect(r.status).toBe(400);
    }
  });
});

describe.skipIf(!bancoDisponivel)('ordem das recusas ao lançar (RT-02)', () => {
  it('CA-T2.1: categoria de outro membro E arquivada → registro_invalido, nunca categoria_arquivada', async () => {
    const { app, titular, membro } = await larParaLancar('ordem.cat-alheia');
    const cat = await criarCategoria(app, membro, { nome: 'Só do Bruno', tipo: 'despesa', escopo: 'individual' });
    await pedir(app, 'POST', `/api/categorias/${cat}/arquivar`, membro);
    const forma = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 5 });
    const r = await pedir(app, 'POST', DESPESAS, titular, {
      id: novoId(),
      valor_centavos: 100,
      categoria_id: cat,
      forma_id: forma,
    });
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
  });

  it('CA-T2.2: categoria e forma arquivadas → categoria_arquivada (a categoria antes da forma); só a forma → forma_arquivada', async () => {
    const { app, titular } = await larParaLancar('ordem.arquivadas');
    const cat = await criarCategoria(app, titular, { nome: 'Velha', tipo: 'despesa', escopo: 'conjunto' });
    const forma = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 5 });
    const ativa = await criarCategoria(app, titular, { nome: 'Nova', tipo: 'despesa', escopo: 'conjunto' });
    await pedir(app, 'POST', `/api/categorias/${cat}/arquivar`, titular);
    await pedir(app, 'POST', `/api/formas/${forma}/arquivar`, titular);
    const lancar = (categoria_id: string) =>
      pedir(app, 'POST', DESPESAS, titular, { id: novoId(), valor_centavos: 100, categoria_id, forma_id: forma });
    const r1 = await lancar(cat);
    expect(r1.status).toBe(422);
    expect(await json(r1)).toMatchObject({ code: 'categoria_arquivada' });
    expect(await json(await lancar(ativa))).toMatchObject({ code: 'forma_arquivada' });
  });

  it('valor inválido vem antes da categoria inexistente; parcelas inválidas vêm antes da categoria arquivada', async () => {
    const { app, titular, ana } = await larParaLancar('ordem.valor');
    const r1 = await pedir(app, 'POST', DESPESAS, titular, {
      id: novoId(),
      valor_centavos: 0,
      categoria_id: novoId(),
      forma_id: novoId(),
    });
    expect(await json(r1)).toMatchObject({ code: 'valor_invalido' });
    const cat = await criarCategoria(app, titular, { nome: 'Arquivada', tipo: 'despesa', escopo: 'conjunto' });
    await pedir(app, 'POST', `/api/categorias/${cat}/arquivar`, titular);
    const r2 = await pedir(app, 'POST', DESPESAS, titular, {
      id: novoId(),
      valor_centavos: 100,
      categoria_id: cat,
      forma_id: ana.pix,
      parcelas: 2,
    });
    expect(await json(r2)).toMatchObject({ code: 'valor_invalido' });
  });
});

describe.skipIf(!bancoDisponivel)('POST /api/lancamentos/receitas', () => {
  it('receita individual na conta do membro, 1 parcela na data, sem forma (CA-04.5 vem no detalhe)', async () => {
    const { app, titular, ana } = await larParaLancar('rec.basica');
    const id = novoId();
    const r = await pedir(app, 'POST', RECEITAS, titular, {
      id,
      valor_centavos: 500_000,
      categoria_id: ana.salario,
      conta_id: ana.conta,
      data: '2026-10-05',
    });
    expect(r.status).toBe(201);
    expect(saida.LancarReceita.parse(await json(r))).toMatchObject({
      escopo: 'individual',
      categoria: 'Salário',
      num_parcelas: 1,
      primeira_parcela_data: '2026-10-05',
      ja_existia: false,
    });
    expect(await pagamentoNoBanco(id)).toEqual({
      forma_pagamento_id: null,
      conta_id: ana.conta,
      data_operacao: '2026-10-05',
      dia: null,
    });
  });

  it('categoria de despesa ou de receita do outro membro, conta do outro ou inexistente → registro_invalido', async () => {
    const { app, titular, ana, bruno } = await larParaLancar('rec.alheia');
    const casos = [
      { categoria_id: ana.mercado, conta_id: ana.conta },
      { categoria_id: ana.lazer, conta_id: ana.conta },
      { categoria_id: bruno.salario, conta_id: ana.conta },
      { categoria_id: ana.salario, conta_id: bruno.conta },
      { categoria_id: ana.salario, conta_id: novoId() },
    ];
    for (const caso of casos) {
      const r = await pedir(app, 'POST', RECEITAS, titular, { id: novoId(), valor_centavos: 100, ...caso });
      expect(await json(r), JSON.stringify(caso)).toMatchObject({ code: 'registro_invalido' });
    }
  });

  it('conta arquivada → conta_arquivada; categoria arquivada vem antes (categoria_arquivada)', async () => {
    const { app, titular, ana } = await larParaLancar('rec.arquivada');
    const conta = await criarConta(app, titular, { nome: 'Antiga' });
    await pedir(app, 'POST', `/api/contas/${conta}/arquivar`, titular);
    const r1 = await pedir(app, 'POST', RECEITAS, titular, {
      id: novoId(),
      valor_centavos: 100,
      categoria_id: ana.salario,
      conta_id: conta,
    });
    expect(r1.status).toBe(422);
    expect(await json(r1)).toMatchObject({ code: 'conta_arquivada' });
    const cat = await criarCategoria(app, titular, { nome: 'Bico', tipo: 'receita', escopo: 'individual' });
    await pedir(app, 'POST', `/api/categorias/${cat}/arquivar`, titular);
    const r2 = await pedir(app, 'POST', RECEITAS, titular, {
      id: novoId(),
      valor_centavos: 100,
      categoria_id: cat,
      conta_id: conta,
    });
    expect(await json(r2)).toMatchObject({ code: 'categoria_arquivada' });
  });
});
