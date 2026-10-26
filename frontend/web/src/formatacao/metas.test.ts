import { describe, expect, it } from 'vitest';
import { textoPrazoMeta } from './metas';

const VIAGEM = { prazo: '2027-07', mensal_necessario_centavos: 64445 };

describe('textoPrazoMeta', () => {
  it('monta o prazo com o valor mensal vindo da API, em minúscula por padrão', () => {
    expect(textoPrazoMeta(VIAGEM)).toBe('até jul/2027 · R$ 644,45 por mês');
  });

  it('com maiuscula começa por "Até" (cartão da T10)', () => {
    expect(textoPrazoMeta(VIAGEM, { maiuscula: true })).toBe('Até jul/2027 · R$ 644,45 por mês');
  });

  it('aceita o prazo no formato de data do mês', () => {
    expect(textoPrazoMeta({ prazo: '2028-12-01', mensal_necessario_centavos: 76924 }, { maiuscula: true })).toBe(
      'Até dez/2028 · R$ 769,24 por mês',
    );
  });
});
