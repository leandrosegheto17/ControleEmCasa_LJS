import { describe, it, expect } from 'vitest';
import { formatarHora } from './data';

describe('formatarHora (America/Sao_Paulo)', () => {
  it('formata HH:mm no fuso de São Paulo', () => {
    expect(formatarHora(Date.parse('2026-10-09T17:32:00Z'))).toBe('14:32');
  });

  it('23h30 em São Paulo, já dia seguinte em UTC', () => {
    expect(formatarHora(Date.parse('2026-10-10T02:30:00Z'))).toBe('23:30');
  });

  it('virada de dia em UTC ainda é noite em São Paulo', () => {
    expect(formatarHora(Date.parse('2026-10-10T00:15:00Z'))).toBe('21:15');
  });

  it('meia-noite em São Paulo é 00:00', () => {
    expect(formatarHora(Date.parse('2026-10-10T03:00:00Z'))).toBe('00:00');
  });

  it('completa com zero à esquerda', () => {
    expect(formatarHora(Date.parse('2026-10-09T12:05:00Z'))).toBe('09:05');
  });
});
