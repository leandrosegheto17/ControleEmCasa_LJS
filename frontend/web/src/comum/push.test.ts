import {
  PREFERENCIAS_PADRAO as DO_CONTRATO,
  MAX_ASSINATURAS_PUSH as MAX_DO_CONTRATO,
  entrada,
} from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { MAX_ASSINATURAS_PUSH, PREFERENCIAS_PADRAO } from './push';

describe('espelho do contrato de push', () => {
  it('as preferências padrão são as do contrato (RN-27)', () => expect(PREFERENCIAS_PADRAO).toEqual(DO_CONTRATO));
  it('o teto de aparelhos é o do contrato', () => expect(MAX_ASSINATURAS_PUSH).toBe(MAX_DO_CONTRATO));
  it('as preferências padrão passam no contrato de entrada', () =>
    expect(entrada.Preferencias.safeParse(PREFERENCIAS_PADRAO).success).toBe(true));
});
