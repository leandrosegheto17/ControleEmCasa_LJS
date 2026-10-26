import { describe, expect, it } from 'vitest';
import { rotuloBotaoLancar } from './rotuloBotaoLancar';

describe('rotuloBotaoLancar', () => {
  it('sem valor: só "Lançar"', () => {
    expect(rotuloBotaoLancar(0, 1)).toBe('Lançar');
  });

  it('à vista: "Lançar R$ 45,90"', () => {
    expect(rotuloBotaoLancar(4590, 1)).toBe('Lançar R$ 45,90');
  });

  it('parcelado: "Lançar R$ 360,00 em 3x"', () => {
    expect(rotuloBotaoLancar(36000, 3)).toBe('Lançar R$ 360,00 em 3x');
  });

  it('valor grande com milhar', () => {
    expect(rotuloBotaoLancar(123456, 12)).toBe('Lançar R$ 1.234,56 em 12x');
  });
});
