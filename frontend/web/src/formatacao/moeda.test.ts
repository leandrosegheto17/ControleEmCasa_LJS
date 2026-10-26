import { describe, expect, it } from 'vitest';
import { formatarMoeda } from './moeda';

describe('formatarMoeda', () => {
  it.each([
    [0, 'R$ 0,00'],
    [1, 'R$ 0,01'],
    [4590, 'R$ 45,90'],
    [123456, 'R$ 1.234,56'],
    [241870, 'R$ 2.418,70'],
    [99999999999, 'R$ 999.999.999,99'],
  ])('%i centavos → "%s"', (centavos, esperado) => {
    expect(formatarMoeda(centavos)).toBe(esperado);
  });

  it('usa espaço comum, sem NBSP, para o texto visível e o acessível serem iguais', () => {
    const texto = formatarMoeda(123456);
    expect(texto).not.toContain(' ');
    expect(texto).not.toContain(' ');
    expect(texto.startsWith('R$ ')).toBe(true);
  });

  it.each([1.5, 0.1, Number.NaN, Number.POSITIVE_INFINITY])('lança para valor não inteiro (%s)', (v) => {
    expect(() => formatarMoeda(v)).toThrow();
  });
});
