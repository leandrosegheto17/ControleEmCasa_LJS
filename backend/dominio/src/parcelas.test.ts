import { describe, expect, it } from 'vitest';
import { diaNoMes, inicioMes, mesesEntre, somarMeses } from './datas';
import {
  calcularParcelas,
  dataDeCartao,
  diaParaRecalculo,
  diaVencimentoAplicado,
  gerarParcelas,
  parcelasDoPagamentoDeFixa,
  type Parcela,
} from './parcelas';

const invalido = { ok: false, erro: 'valor_invalido' };
const p = (numero: number, valorCentavos: number, data: string): Parcela => ({ numero, valorCentavos, data });

function credito(dataCompra: string, diaVencimento: number | null, numParcelas: number, totalCentavos: number) {
  return gerarParcelas({ dataCompra, diaVencimento, numParcelas, totalCentavos });
}

// CA-14.1: os 12 casos da tabela da RN-14 (PRD-TECNICO §3).
describe('RN-14: tabela de casos do PRD-TECNICO', () => {
  it('#1 compra 15/10/2026, dia 10, 3x de 60.000', () => {
    expect(credito('2026-10-15', 10, 3, 60000)).toEqual({
      ok: true,
      valor: [p(1, 20000, '2026-11-10'), p(2, 20000, '2026-12-10'), p(3, 20000, '2027-01-10')],
    });
  });
  it('#2 à vista no crédito: 1 parcela no vencimento do mês seguinte', () => {
    expect(credito('2026-10-15', 10, 1, 60000)).toEqual({ ok: true, valor: [p(1, 60000, '2026-11-10')] });
  });
  it('#3 compra no próprio dia do vencimento cai no mês seguinte', () => {
    expect(credito('2026-10-10', 10, 1, 5000)).toEqual({ ok: true, valor: [p(1, 5000, '2026-11-10')] });
  });
  it('#4 R$ 100 em 3x: o resto fica na 1ª (3.334 + 3.333 + 3.333)', () => {
    expect(credito('2026-10-15', 10, 3, 10000)).toEqual({
      ok: true,
      valor: [p(1, 3334, '2026-11-10'), p(2, 3333, '2026-12-10'), p(3, 3333, '2027-01-10')],
    });
  });
  it('#5 compra 31/01/2027, dia 31: 28/02, 31/03 e 30/04', () => {
    expect(credito('2027-01-31', 31, 3, 10000)).toEqual({
      ok: true,
      valor: [p(1, 3334, '2027-02-28'), p(2, 3333, '2027-03-31'), p(3, 3333, '2027-04-30')],
    });
  });
  it('#6 ano bissexto: compra 15/01/2028, dia 30, 2x de 101 → 51 em 29/02 e 50 em 30/03', () => {
    expect(credito('2028-01-15', 30, 2, 101)).toEqual({
      ok: true,
      valor: [p(1, 51, '2028-02-29'), p(2, 50, '2028-03-30')],
    });
  });
  it('#7 virada de ano: compra 20/12/2026, dia 5, 2x de 100', () => {
    expect(credito('2026-12-20', 5, 2, 100)).toEqual({
      ok: true,
      valor: [p(1, 50, '2027-01-05'), p(2, 50, '2027-02-05')],
    });
  });
  it('#8 24x de 100.000: 4.182 na 1ª e 23 × 4.166, de 15/11/2026 a 15/10/2028', () => {
    const r = credito('2026-10-01', 15, 24, 100000);
    if (!r.ok) throw new Error('esperava sucesso');
    expect(r.valor).toHaveLength(24);
    expect(r.valor[0]).toEqual(p(1, 4182, '2026-11-15'));
    expect(r.valor[1]).toEqual(p(2, 4166, '2026-12-15'));
    expect(r.valor[23]).toEqual(p(24, 4166, '2028-10-15'));
    expect(r.valor.slice(1).every((x) => x.valorCentavos === 4166)).toBe(true);
  });
  it('#9 total menor que N (2 centavos em 3x) → valor_invalido', () => {
    expect(credito('2026-10-15', 10, 3, 2)).toEqual(invalido);
  });
  it.each([25, 0])('#10 %i parcelas → valor_invalido', (n) => {
    expect(credito('2026-10-15', 10, n, 10000)).toEqual(invalido);
  });
  it('#11 Pix em 15/10/2026: 1 parcela do total na data da operação', () => {
    expect(
      calcularParcelas({ tipo: 'pix', data: '2026-10-15', diaVencimento: null, numParcelas: 1, totalCentavos: 10000 }),
    ).toEqual({ ok: true, valor: [p(1, 10000, '2026-10-15')] });
  });
  it('#12 Pix em 2x → valor_invalido', () => {
    expect(
      calcularParcelas({ tipo: 'pix', data: '2026-10-15', diaVencimento: null, numParcelas: 2, totalCentavos: 10000 }),
    ).toEqual(invalido);
  });
});

// Casos portados de MyMoney/backend/supabase/tests/parcelas/gerar_parcelas.sql.
describe('gerarParcelas: casos do pgTAP', () => {
  it('dia 31: fevereiro vira 28 e abril vira 30 (compra 20/01/2027)', () => {
    const r = credito('2027-01-20', 31, 3, 300);
    expect(r.ok && r.valor.map((x) => x.data)).toEqual(['2027-02-28', '2027-03-31', '2027-04-30']);
  });
  it('dia 31 atravessando o ano, com fevereiro bissexto (compra 05/12/2027)', () => {
    const r = credito('2027-12-05', 31, 3, 300);
    expect(r.ok && r.valor.map((x) => x.data)).toEqual(['2028-01-31', '2028-02-29', '2028-03-31']);
  });
  it('24x de 05/11/2026 a 05/10/2028, soma = total e parcela 1 = 100000 − 4166 × 23', () => {
    const r = credito('2026-10-15', 5, 24, 100000);
    if (!r.ok) throw new Error('esperava sucesso');
    expect(r.valor).toHaveLength(24);
    expect(r.valor[0]?.data).toBe('2026-11-05');
    expect(r.valor[23]?.data).toBe('2028-10-05');
    expect(r.valor.reduce((s, x) => s + x.valorCentavos, 0)).toBe(100000);
    expect(r.valor[0]?.valorCentavos).toBe(4182);
  });
  it('compra depois do vencimento também cai no mês seguinte', () => {
    expect(credito('2026-10-25', 10, 1, 5000)).toEqual({ ok: true, valor: [p(1, 5000, '2026-11-10')] });
  });
  it('compra em dezembro vira o ano', () => {
    expect(credito('2026-12-31', 10, 1, 5000)).toEqual({ ok: true, valor: [p(1, 5000, '2027-01-10')] });
  });
  it.each([
    ['0 parcelas', '2026-10-15', 10, 0, 60000],
    ['25 parcelas', '2026-10-15', 10, 25, 60000],
    ['parcelas nulas', '2026-10-15', 10, null, 60000],
    ['parcelas fracionárias', '2026-10-15', 10, 2.5, 60000],
    ['total 0', '2026-10-15', 10, 3, 0],
    ['total negativo', '2026-10-15', 10, 3, -1],
    ['total nulo', '2026-10-15', 10, 3, null],
    ['total fracionário', '2026-10-15', 10, 3, 100.5],
    ['total menor que o número de parcelas', '2026-10-15', 10, 3, 2],
    ['data da compra nula', null, 10, 3, 60000],
    ['data da compra inexistente', '2026-02-30', 10, 3, 60000],
    ['CA-14.4: dia de vencimento 0', '2026-10-15', 0, 3, 60000],
    ['CA-14.4: dia de vencimento 32', '2026-10-15', 32, 3, 60000],
    ['CA-14.4: dia de vencimento nulo', '2026-10-15', null, 3, 60000],
  ])('%s → valor_invalido', (_nome, data, dia, n, total) => {
    expect(
      gerarParcelas({
        dataCompra: data as string,
        diaVencimento: dia as number,
        numParcelas: n as number,
        totalCentavos: total as number,
      }),
    ).toEqual(invalido);
  });
  it('parcela que cairia depois de 9999-12-31 → valor_invalido', () => {
    expect(credito('9999-11-15', 10, 3, 300)).toEqual(invalido);
    expect(credito('9999-11-15', 10, 1, 300)).toEqual({ ok: true, valor: [p(1, 300, '9999-12-10')] });
  });
});

describe('gerarParcelas: propriedades (CA-14.3, CA-T5.2)', () => {
  function conferir(dataCompra: string, dia: number, n: number, total: number) {
    const r = credito(dataCompra, dia, n, total);
    if (!r.ok) throw new Error(`recusou N=${n} total=${total}`);
    const base = Math.floor(total / n);
    const soma = r.valor.reduce((s, x) => s + x.valorCentavos, 0);
    const primeira = r.valor[0]!.valorCentavos;
    const falhas: string[] = [];
    if (r.valor.length !== n) falhas.push('quantidade');
    if (soma !== total) falhas.push('soma');
    if (!(Math.abs(primeira - base) < n)) falhas.push('|p1 − base| < N');
    if (r.valor.some((x, i) => i > 0 && x.valorCentavos !== base)) falhas.push('demais = base');
    if (r.valor.some((x) => x.valorCentavos <= 0)) falhas.push('parcela positiva');
    r.valor.forEach((x, i) => {
      if (x.numero !== i + 1) falhas.push('numeração');
      // Mês da parcela k = mês da compra + k, no dia de vencimento (ou último dia do mês).
      const esperado = diaNoMes(somarMeses(inicioMes(dataCompra), i + 1), dia);
      if (!esperado.ok || x.data !== esperado.valor) falhas.push(`data da parcela ${i + 1}`);
      if (mesesEntre(dataCompra, x.data) !== i + 1) falhas.push(`competência da parcela ${i + 1}`);
    });
    if (falhas.length) throw new Error(`N=${n} total=${total} dia=${dia} compra=${dataCompra}: ${falhas.join(', ')}`);
  }

  it('para N de 1 a 24 e totais de N a N+7 (tabela do pgTAP): soma = total e a 1ª leva o resto', () => {
    for (let n = 1; n <= 24; n++) for (let t = n; t <= n + 7; t++) conferir('2026-10-15', 10, n, t);
  });

  it('para N de 1 a 24 e totais de N a 10^11 (amostra determinística), com dias 1..31', () => {
    let semente = 20261024;
    const proximo = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente / 2147483648;
    };
    const compras = ['2026-10-15', '2027-01-31', '2028-01-29', '2026-12-31', '2099-02-28'];
    for (let n = 1; n <= 24; n++) {
      conferir('2026-10-15', 10, n, 100_000_000_000);
      conferir('2026-10-15', 10, n, 100_000_000_000 - 1);
      for (let i = 0; i < 200; i++) {
        // Distribuição log-uniforme entre N e 10^11, para cobrir valores pequenos e grandes.
        const total = Math.max(n, Math.floor(Math.exp(proximo() * Math.log(100_000_000_000))));
        const dia = 1 + Math.floor(proximo() * 31);
        conferir(compras[i % compras.length]!, dia, n, total);
      }
    }
  });
});

describe('calcularParcelas (F calcular_parcelas.sql)', () => {
  it('Débito: 1 parcela do total na data da operação', () => {
    expect(
      calcularParcelas({ tipo: 'debito', data: '2026-10-31', diaVencimento: null, numParcelas: 1, totalCentavos: 1 }),
    ).toEqual({ ok: true, valor: [p(1, 1, '2026-10-31')] });
  });
  it('Receita: 1 parcela na data da operação', () => {
    expect(
      calcularParcelas({
        tipo: 'receita',
        data: '2026-10-05',
        diaVencimento: null,
        numParcelas: 1,
        totalCentavos: 500000,
      }),
    ).toEqual({ ok: true, valor: [p(1, 500000, '2026-10-05')] });
  });
  it('Pix ignora o dia de vencimento (fica na data da operação)', () => {
    expect(
      calcularParcelas({ tipo: 'pix', data: '2026-10-15', diaVencimento: 10, numParcelas: 1, totalCentavos: 100 }),
    ).toEqual({ ok: true, valor: [p(1, 100, '2026-10-15')] });
  });
  it('Crédito segue gerarParcelas', () => {
    expect(
      calcularParcelas({
        tipo: 'credito',
        data: '2026-10-15',
        diaVencimento: 10,
        numParcelas: 3,
        totalCentavos: 10000,
      }),
    ).toEqual(credito('2026-10-15', 10, 3, 10000));
  });
  it.each([
    ['pix', '2026-10-15', 0, 'parcelas 0'],
    ['debito', '2026-10-15', 3, 'débito em 3x'],
    ['receita', '2026-10-15', 2, 'receita em 2x'],
  ] as const)('%s com %s e N=%i → valor_invalido (%s)', (...[tipo, data, n]) => {
    expect(calcularParcelas({ tipo, data, diaVencimento: null, numParcelas: n, totalCentavos: 100 })).toEqual(invalido);
  });
  it.each([0, -1, null, 1.5])('Pix com total %s → valor_invalido', (total) => {
    expect(
      calcularParcelas({
        tipo: 'pix',
        data: '2026-10-15',
        diaVencimento: null,
        numParcelas: 1,
        totalCentavos: total as number,
      }),
    ).toEqual(invalido);
  });
  it('Pix sem data → valor_invalido', () => {
    expect(
      calcularParcelas({
        tipo: 'pix',
        data: null as unknown as string,
        diaVencimento: null,
        numParcelas: 1,
        totalCentavos: 1,
      }),
    ).toEqual(invalido);
  });
  it('Crédito com valor editado abaixo do nº de parcelas → valor_invalido (RN-06, casos limite)', () => {
    expect(
      calcularParcelas({ tipo: 'credito', data: '2026-10-15', diaVencimento: 10, numParcelas: 6, totalCentavos: 5 }),
    ).toEqual(invalido);
  });
});

// Dia congelado (RN-06, CA-03.3, CA-06.6). Legado: A editar_lancamento.sql:125-145;
// tests/lancamentos/editar_recalculo.sql:57-104; tests/cadastros/salvar_forma.sql:109-110.
describe('dia de vencimento aplicado e congelado', () => {
  it('ao lançar no Crédito, grava o dia da forma; no Pix/Débito, nulo', () => {
    expect(diaVencimentoAplicado({ tipo: 'credito', diaVencimento: 10 })).toBe(10);
    expect(diaVencimentoAplicado({ tipo: 'pix', diaVencimento: null })).toBeNull();
    expect(diaVencimentoAplicado({ tipo: 'debito', diaVencimento: 7 })).toBeNull();
  });
  it('CA-06.6: o cartão mudou de 10 para 20 e a forma não muda → o recálculo usa o 10 congelado', () => {
    const dia = diaParaRecalculo({ diaAplicadoGravado: 10, formaNova: null });
    expect(dia).toBe(10);
    const r = calcularParcelas({
      tipo: 'credito',
      data: '2031-03-06',
      diaVencimento: dia,
      numParcelas: 3,
      totalCentavos: 60000,
    });
    expect(r.ok && r.valor.map((x) => x.data)).toEqual(['2031-04-10', '2031-05-10', '2031-06-10']);
  });
  it('CA-06.6: trocar para outro cartão usa o dia da forma nova (25)', () => {
    expect(diaParaRecalculo({ diaAplicadoGravado: 10, formaNova: { tipo: 'credito', diaVencimento: 25 } })).toBe(25);
  });
  it('trocar o crédito por Pix zera o dia aplicado', () => {
    expect(diaParaRecalculo({ diaAplicadoGravado: 10, formaNova: { tipo: 'pix', diaVencimento: null } })).toBeNull();
  });
  it('trocar o Pix por crédito passa a usar o dia do cartão', () => {
    expect(diaParaRecalculo({ diaAplicadoGravado: null, formaNova: { tipo: 'credito', diaVencimento: 5 } })).toBe(5);
  });
});

// RN-13 (I-20) e RN-28: pagamento de fixa.
describe('pagamento de fixa (RN-13, RN-28)', () => {
  it('CA-13.3: fixa de vencimento 10/10 paga no Crédito (dia 5) em 08/10 → data de cartão 05/11', () => {
    expect(dataDeCartao('2026-10-08', 5)).toEqual({ ok: true, valor: '2026-11-05' });
  });
  it('data de cartão segue a regra da compra à vista: no próprio dia do vencimento vai ao mês seguinte', () => {
    expect(dataDeCartao('2026-10-05', 5)).toEqual({ ok: true, valor: '2026-11-05' });
    expect(dataDeCartao('2027-01-30', 31)).toEqual({ ok: true, valor: '2027-02-28' });
  });
  it('data de cartão sem dia aplicado → valor_invalido', () => {
    expect(dataDeCartao('2026-10-08', null)).toEqual(invalido);
  });
  it('CA-15.8 / CA-28.1: a parcela única fica no vencimento da ocorrência, com o valor pago', () => {
    expect(parcelasDoPagamentoDeFixa({ vencimento: '2026-10-10', valorCentavos: 23000, numParcelas: 1 })).toEqual({
      ok: true,
      valor: [p(1, 23000, '2026-10-10')],
    });
  });
  it('CA-28.4: nº de parcelas ≠ 1 → valor_invalido', () => {
    expect(parcelasDoPagamentoDeFixa({ vencimento: '2026-10-10', valorCentavos: 23000, numParcelas: 2 })).toEqual(
      invalido,
    );
  });
  it('valor fora da regra → valor_invalido', () => {
    expect(parcelasDoPagamentoDeFixa({ vencimento: '2026-10-10', valorCentavos: 0, numParcelas: 1 })).toEqual(invalido);
  });
});
