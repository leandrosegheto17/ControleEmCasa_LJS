import { afterEach, describe, expect, it } from 'vitest';
import { formatarDataCurta, formatarDataPorExtenso, formatarDiaSemana } from './data';

const tzOriginal = process.env.TZ;

afterEach(() => {
  if (tzOriginal === undefined) delete process.env.TZ;
  else process.env.TZ = tzOriginal;
});

for (const tz of [undefined, 'UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
  describe(`fuso da máquina: ${tz ?? 'padrão'}`, () => {
    const comFuso = () => {
      if (tz) process.env.TZ = tz;
    };

    describe('formatarDataCurta (coluna de data da linha)', () => {
      it('"2026-10-10" → "10/10"', () => {
        comFuso();
        expect(formatarDataCurta('2026-10-10')).toBe('10/10');
      });

      it('"2026-01-01" → "01/01"', () => {
        comFuso();
        expect(formatarDataCurta('2026-01-01')).toBe('01/01');
      });
    });

    describe('formatarDataPorExtenso (nome acessível)', () => {
      it('"2026-10-10" → "10 de outubro"', () => {
        comFuso();
        expect(formatarDataPorExtenso('2026-10-10')).toBe('10 de outubro');
      });

      it('"2026-10-12" → "12 de outubro"', () => {
        comFuso();
        expect(formatarDataPorExtenso('2026-10-12')).toBe('12 de outubro');
      });

      it('"2026-01-01" → "1 de janeiro" (dia sem zero à esquerda)', () => {
        comFuso();
        expect(formatarDataPorExtenso('2026-01-01')).toBe('1 de janeiro');
      });

      it('"2026-12-31" → "31 de dezembro"', () => {
        comFuso();
        expect(formatarDataPorExtenso('2026-12-31')).toBe('31 de dezembro');
      });
    });

    describe('formatarDiaSemana (título do grupo do dia)', () => {
      it('sábado, 10/10/2026', () => {
        comFuso();
        expect(formatarDiaSemana('2026-10-10')).toBe('Sábado, 10 de outubro');
      });

      it('quinta, 01/10/2026, sem "-feira" e sem zero à esquerda', () => {
        comFuso();
        expect(formatarDiaSemana('2026-10-01')).toBe('Quinta, 1 de outubro');
      });

      it('31/12/2026 (quinta)', () => {
        comFuso();
        expect(formatarDiaSemana('2026-12-31')).toBe('Quinta, 31 de dezembro');
      });

      it('01/01/2026 (quinta, virada de ano)', () => {
        comFuso();
        expect(formatarDiaSemana('2026-01-01')).toBe('Quinta, 1 de janeiro');
      });

      it('os demais dias da semana como no mockup', () => {
        comFuso();
        expect(formatarDiaSemana('2026-10-04')).toBe('Domingo, 4 de outubro');
        expect(formatarDiaSemana('2026-10-05')).toBe('Segunda, 5 de outubro');
        expect(formatarDiaSemana('2026-10-06')).toBe('Terça, 6 de outubro');
        expect(formatarDiaSemana('2026-10-07')).toBe('Quarta, 7 de outubro');
        expect(formatarDiaSemana('2026-10-09')).toBe('Sexta, 9 de outubro');
      });
    });
  });
}
