import { afterEach, describe, expect, it } from 'vitest';
import { formatarData, hojeEmSaoPaulo, periodoDePagamento } from './data';

describe('periodoDePagamento', () => {
  it.each([
    ['2026-10-09T15:00:00Z', '2026-11-08'],
    ['2026-12-15T01:00:00Z', '2027-01-13'],
    ['2028-02-10T12:00:00Z', '2028-03-11'],
  ])('em %s o máximo é %s', (agora, max) => {
    expect(periodoDePagamento(new Date(agora))).toEqual({ min: '2000-01-01', max });
  });
});

const tzOriginal = process.env.TZ;

afterEach(() => {
  if (tzOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = tzOriginal;
});

describe('formatarData', () => {
  it.each([
    ['2026-07-05', '05/07/2026'],
    ['2026-12-31', '31/12/2026'],
    ['2027-01-01', '01/01/2027'],
  ])('%s → %s', (iso, esperado) => {
    expect(formatarData(iso)).toBe(esperado);
  });

  it('não muda o dia em fuso a oeste de UTC', () => {
    process.env.TZ = 'America/Sao_Paulo';
    expect(formatarData('2026-07-05')).toBe('05/07/2026');
  });
});

describe('hojeEmSaoPaulo', () => {
  const casos: Array<[string, string, string]> = [
    ['23h30 em São Paulo ainda é o dia anterior ao de UTC', '2026-10-10T02:30:00Z', '2026-10-09'],
    ['virada de ano: 23h30 de 31/12 em São Paulo', '2027-01-01T02:30:00Z', '2026-12-31'],
    ['meia-noite em São Paulo já é o novo dia', '2026-10-10T03:00:00Z', '2026-10-10'],
  ];

  for (const tz of [undefined, 'UTC', 'Asia/Tokyo', 'America/Sao_Paulo']) {
    describe(`fuso da máquina: ${tz ?? 'padrão'}`, () => {
      it.each(casos)('%s', (_descricao, instante, esperado) => {
        if (tz) process.env.TZ = tz;
        expect(hojeEmSaoPaulo(new Date(instante))).toBe(esperado);
      });
    });
  }

  it('sem argumento usa o instante atual e devolve YYYY-MM-DD', () => {
    expect(hojeEmSaoPaulo()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
