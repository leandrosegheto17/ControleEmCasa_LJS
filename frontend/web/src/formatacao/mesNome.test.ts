import { describe, expect, it } from 'vitest';
import { formatarNomeMes } from './mes';

describe('formatarNomeMes', () => {
  it('devolve o nome do mês em minúscula, sem o ano', () => {
    expect(formatarNomeMes('2026-10')).toBe('outubro');
    expect(formatarNomeMes('2026-03-01')).toBe('março');
  });
});
