import { describe, expect, it } from 'vitest';
import { digitosParaCentavos } from './centavos';

describe('digitosParaCentavos', () => {
  it.each([
    ['4590', 4590],
    ['', 0],
    ['0', 0],
    ['0045', 45],
    ['R$ 45,90', 4590],
    ['1.234,56', 123456],
  ])('"%s" → %i', (texto, esperado) => {
    expect(digitosParaCentavos(texto)).toBe(esperado);
  });

  it('15 dígitos dão um inteiro seguro', () => {
    const r = digitosParaCentavos('123456789012345');
    expect(r).toBe(123456789012345);
    expect(Number.isSafeInteger(r)).toBe(true);
  });

  it('resultado sempre inteiro seguro', () => {
    for (const texto of ['9', '99', '999999999999999', 'abc', '  12  ']) {
      expect(Number.isSafeInteger(digitosParaCentavos(texto))).toBe(true);
    }
  });
});
