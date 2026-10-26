import { describe, expect, it } from 'vitest';
import { formatarMesCurto } from './mes';

describe('formatarMesCurto', () => {
  it.each([
    ['2027-07', 'jul/2027'],
    ['2026-01', 'jan/2026'],
    ['2026-03', 'mar/2026'],
    ['2026-12', 'dez/2026'],
  ])('%s → %s', (mes, esperado) => {
    expect(formatarMesCurto(mes)).toBe(esperado);
  });

  it('sem ponto de abreviação', () => {
    expect(formatarMesCurto('2026-09')).not.toContain('.');
  });
});
