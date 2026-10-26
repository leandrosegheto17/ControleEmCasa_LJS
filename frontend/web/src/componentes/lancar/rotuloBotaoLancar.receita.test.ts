import { describe, expect, it } from 'vitest';
import { rotuloBotaoLancar } from './rotuloBotaoLancar';

const comEspacoComum = (texto: string) => texto.replace(/ /g, ' ');

describe('rotuloBotaoLancar na receita', () => {
  it('750000 → "Lançar receita R$ 7.500,00"', () => {
    expect(comEspacoComum(rotuloBotaoLancar(750000, 1, 'receita'))).toBe('Lançar receita R$ 7.500,00');
  });

  it('receita não mostra parcelas', () => {
    expect(comEspacoComum(rotuloBotaoLancar(750000, 3, 'receita'))).toBe('Lançar receita R$ 7.500,00');
  });

  it('valor zero → "Lançar receita"', () => {
    expect(rotuloBotaoLancar(0, 1, 'receita')).toBe('Lançar receita');
  });

  it('despesa continua igual com o tipo explícito', () => {
    expect(comEspacoComum(rotuloBotaoLancar(4590, 1, 'despesa'))).toBe('Lançar R$ 45,90');
    expect(comEspacoComum(rotuloBotaoLancar(36000, 3, 'despesa'))).toBe('Lançar R$ 360,00 em 3x');
  });
});
