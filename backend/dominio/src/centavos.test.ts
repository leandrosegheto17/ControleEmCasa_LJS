import { describe, expect, it } from 'vitest';
import {
  divisaoParaCima,
  percentualArredondado,
  validarSaldoInicial,
  validarSaldoReal,
  validarValorLancamento,
  validarValorPositivo,
} from './centavos';

const invalido = { ok: false, erro: 'valor_invalido' };

// CA-T5.1, CA-18.1; legado: T lancamento.sql:13-15, tests/lancamentos/valor_maximo.sql.
describe('validarValorLancamento (CA-T5.1, CA-18.1)', () => {
  it.each([1, 100, 100_000_000_000])('%i centavos é aceito', (v) => {
    expect(validarValorLancamento(v)).toEqual({ ok: true, valor: v });
  });
  it.each([
    [0, 'zero'],
    [-1, 'negativo'],
    [100_000_000_001, 'acima de R$ 1 bilhão'],
    [10.5, 'fracionário'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'infinito'],
    [null, 'vazio'],
    [undefined, 'ausente'],
    ['100', 'texto'],
  ])('%s → valor_invalido (%s)', (...[v]) => {
    expect(validarValorLancamento(v)).toEqual(invalido);
  });
});

describe('validarValorPositivo (RN-18)', () => {
  it('aceita > 0', () => expect(validarValorPositivo(1)).toEqual({ ok: true, valor: 1 }));
  it.each([0, -5, 1.5, null])('%s → valor_invalido', (v) => expect(validarValorPositivo(v)).toEqual(invalido));
});

describe('validarSaldoInicial (RN-03, RN-18)', () => {
  it.each([0, -1, -100_000_000_000, 100_000_000_000])('%i é aceito (pode ser negativo)', (v) => {
    expect(validarSaldoInicial(v)).toEqual({ ok: true, valor: v });
  });
  it.each([-100_000_000_001, 100_000_000_001, 0.1])('%s → valor_invalido', (v) => {
    expect(validarSaldoInicial(v)).toEqual(invalido);
  });
});

describe('validarSaldoReal (RN-12)', () => {
  it('aceita qualquer inteiro, inclusive negativo', () => {
    expect(validarSaldoReal(-123_456)).toEqual({ ok: true, valor: -123_456 });
  });
  it('recusa fracionário', () => expect(validarSaldoReal(1.01)).toEqual(invalido));
});

// Arredondamento do Postgres round(numeric): metade para longe do zero.
describe('percentualArredondado (CA-T5.3)', () => {
  it.each([
    [7999, 10000, 80],
    [8000, 10000, 80],
    [10001, 10000, 100],
    [33250, 30000, 111],
    [1, 3, 33],
    [2, 3, 67],
    [1, 200, 1], // 0,5 → 1 (metade para cima)
    [199, 200, 100], // 99,5 → 100
    [995, 1000, 100], // 99,5 → 100
    [996, 1000, 100],
    [0, 10000, 0],
    [140250, 241870, 58],
    [101620, 241870, 42],
  ])('round(100 × %i ÷ %i) = %i', (parte, total, esperado) => {
    expect(percentualArredondado(parte, total)).toBe(esperado);
  });
  it('total 0 → null (nullif do legado)', () => expect(percentualArredondado(5, 0)).toBeNull());
  it('negativo arredonda a metade para longe do zero', () => expect(percentualArredondado(-1, 200)).toBe(-1));
  it('é exato com valores grandes (sem erro de ponto flutuante)', () => {
    // 100 × 4.999.999.999.950 ÷ 10^13 = 49,9999999995 → 50.
    expect(percentualArredondado(4_999_999_999_950, 10_000_000_000_000)).toBe(50);
    // Metade exata (45,5) sobe; 1 centavo abaixo dela (45,49999999999) desce.
    expect(percentualArredondado(4_499_999_999_999, 10_000_000_000_000)).toBe(45);
    expect(percentualArredondado(4_550_000_000_000, 10_000_000_000_000)).toBe(46);
    expect(percentualArredondado(4_549_999_999_999, 10_000_000_000_000)).toBe(45);
  });
});

describe('divisaoParaCima', () => {
  it.each([
    [580000, 9, 64445],
    [2000000, 26, 76924],
    [1201, 2, 601],
    [1201, 1, 1201],
    [100000, 3, 33334],
    [0, 5, 0],
    [9, 3, 3],
  ])('⌈%i ÷ %i⌉ = %i', (a, b, esperado) => expect(divisaoParaCima(a, b)).toBe(esperado));
});
