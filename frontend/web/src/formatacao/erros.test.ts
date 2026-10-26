import { describe, expect, it } from 'vitest';
import { digitosParaCentavos } from './centavos';
import { formatarMes, formatarMesCurto } from './mes';

describe('digitosParaCentavos acima do inteiro seguro', () => {
  it('lança RangeError', () => {
    expect(() => digitosParaCentavos('9'.repeat(17))).toThrow(RangeError);
  });
});

describe('mês fora de 01-12', () => {
  it.each(['2026-13', '2026-00'])('formatarMes("%s") lança RangeError', (mes) => {
    expect(() => formatarMes(mes)).toThrow(RangeError);
  });

  it('formatarMesCurto("2026-13") lança RangeError', () => {
    expect(() => formatarMesCurto('2026-13')).toThrow(RangeError);
  });
});
