import { cpfCnpjValido as doContrato } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { cpfCnpjValido, digitosCpfCnpj, mascararCpfCnpj } from './cpfCnpj';

/** Formato do CPF/CNPJ da assinatura (CA-24.6: o contrato recusa dígito verificador errado com `valor_invalido`). */

describe('mascararCpfCnpj', () => {
  it.each([
    ['5', '5'],
    ['5299', '529.9'],
    ['529982', '529.982'],
    ['5299822', '529.982.2'],
    ['52998224725', '529.982.247-25'],
    ['529.982.247-25', '529.982.247-25'],
    ['114447770001', '11.444.777/0001'],
    ['11444777000161', '11.444.777/0001-61'],
    ['11444777000161999', '11.444.777/0001-61'],
    ['abc', ''],
  ])('"%s" vira "%s"', (entrada, saida) => expect(mascararCpfCnpj(entrada)).toBe(saida));

  it('digitosCpfCnpj tira a pontuação e limita a 14 dígitos', () => {
    expect(digitosCpfCnpj('529.982.247-25')).toBe('52998224725');
    expect(digitosCpfCnpj('1'.repeat(20))).toHaveLength(14);
  });
});

describe('cpfCnpjValido', () => {
  const casos = [
    '529.982.247-25',
    '52998224725',
    '529.982.247-24',
    '111.111.111-11',
    '11.444.777/0001-61',
    '11.444.777/0001-62',
    '00000000000000',
    '1234567890',
    '',
    'abc.def.ghi-jk',
  ];
  it.each(casos)('"%s" concorda com a validação do contrato', (valor) => {
    expect(cpfCnpjValido(valor)).toBe(doContrato(valor));
  });
  it('aceita CPF e CNPJ certos e recusa dígito errado e repetido', () => {
    expect(cpfCnpjValido('529.982.247-25')).toBe(true);
    expect(cpfCnpjValido('11.444.777/0001-61')).toBe(true);
    expect(cpfCnpjValido('529.982.247-24')).toBe(false);
    expect(cpfCnpjValido('111.111.111-11')).toBe(false);
  });
});
