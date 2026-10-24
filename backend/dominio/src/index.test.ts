import { describe, expect, it } from 'vitest';
import { somarCentavos } from './index';

describe('somarCentavos', () => {
  it('soma centavos inteiros sem erro de ponto flutuante', () => {
    expect(somarCentavos([10, 20])).toBe(30);
  });
  it('lista vazia soma zero', () => {
    expect(somarCentavos([])).toBe(0);
  });
});
