import { describe, expect, it } from 'vitest';
import { PRECO_PRO_CENTAVOS, TRIAL_DIAS } from './index';

describe('constantes do contrato (SDD 2.1)', () => {
  it('o plano Pro custa 990 centavos', () => expect(PRECO_PRO_CENTAVOS).toBe(990));
  it('o período de teste tem 14 dias', () => expect(TRIAL_DIAS).toBe(14));
});
