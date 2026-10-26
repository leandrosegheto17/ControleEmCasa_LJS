import { describe, expect, it } from 'vitest';
import { saldoRealDaUrl } from './saldoRealDaUrl';

const ler = (consulta: string) => saldoRealDaUrl(new URLSearchParams(consulta));

describe('saldoRealDaUrl', () => {
  it('aceita inteiro positivo', () => expect(ler('saldo_real=320255')).toBe(320255));
  it.each([
    '',
    'saldo_real=0',
    'saldo_real=-5',
    'saldo_real=12.5',
    'saldo_real=abc',
    'saldo_real=99999999999999999999',
  ])('ignora "%s"', (consulta) => expect(ler(consulta)).toBeUndefined());
});
