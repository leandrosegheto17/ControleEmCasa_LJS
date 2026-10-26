import { describe, expect, it } from 'vitest';
import { escreverMesNaUrl, formatarMes, lerMesDaUrl } from './mes';

describe('formatarMes', () => {
  it.each([
    ['2026-10', 'Outubro de 2026'],
    ['2026-01', 'Janeiro de 2026'],
    ['2026-12', 'Dezembro de 2026'],
    ['2026-03', 'Março de 2026'],
  ])('%s → "%s"', (mes, esperado) => {
    expect(formatarMes(mes)).toBe(esperado);
  });

  it('em minúscula para o aria-label do seletor de mês', () => {
    expect(formatarMes('2026-09', { minuscula: true })).toBe('setembro de 2026');
  });

  it('aceita YYYY-MM-01 (mes_corrente do contexto)', () => {
    expect(formatarMes('2026-10-01')).toBe('Outubro de 2026');
  });
});

describe('lerMesDaUrl', () => {
  it('lê ?mes=AAAA-MM válido', () => {
    expect(lerMesDaUrl(new URLSearchParams('mes=2026-10'))).toBe('2026-10');
  });

  it.each(['mes=2026-13', 'mes=2026-00', 'mes=2026-1', 'mes=abc', 'mes=2026-10-01', 'mes=', 'escopo=casa'])(
    '"%s" → null',
    (busca) => {
      expect(lerMesDaUrl(new URLSearchParams(busca))).toBeNull();
    },
  );
});

describe('escreverMesNaUrl', () => {
  it('troca o mês preservando os demais parâmetros', () => {
    const entrada = new URLSearchParams('mes=2026-09&escopo=casa&categoria=x');
    const saida = escreverMesNaUrl(entrada, '2026-10');
    expect(saida.get('mes')).toBe('2026-10');
    expect(saida.get('escopo')).toBe('casa');
    expect(saida.get('categoria')).toBe('x');
  });

  it('acrescenta o mês quando ele não existe', () => {
    const saida = escreverMesNaUrl(new URLSearchParams('escopo=casa'), '2026-10');
    expect(saida.get('mes')).toBe('2026-10');
    expect(saida.get('escopo')).toBe('casa');
  });

  it('não muta a entrada', () => {
    const entrada = new URLSearchParams('mes=2026-09&escopo=casa');
    const saida = escreverMesNaUrl(entrada, '2026-10');
    expect(entrada.toString()).toBe('mes=2026-09&escopo=casa');
    expect(saida).not.toBe(entrada);
  });
});
