import {
  SENHA_MAX_BYTES,
  SENHA_MIN_CARACTERES,
  VERSAO_PRIVACIDADE,
  VERSAO_TERMOS,
  senhaAtendePolitica,
} from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { problemaDaSenha, SENHA_MAX_BYTES as MAX, SENHA_MIN_CARACTERES as MIN } from './senha';
import * as versoes from './versoes';

describe('política de senha (CA-19.4)', () => {
  it('espelha as constantes do contrato', () => {
    expect([MIN, MAX]).toEqual([SENHA_MIN_CARACTERES, SENHA_MAX_BYTES]);
    expect(versoes.VERSAO_TERMOS).toBe(VERSAO_TERMOS);
    expect(versoes.VERSAO_PRIVACIDADE).toBe(VERSAO_PRIVACIDADE);
  });

  it.each([
    '',
    'a'.repeat(11),
    'a'.repeat(12),
    'a'.repeat(72),
    'a'.repeat(73),
    'ã'.repeat(36),
    'ã'.repeat(37),
    '😀'.repeat(18),
    '😀'.repeat(19),
  ])('decide como o contrato para o caso %#', (senha) => {
    expect(problemaDaSenha(senha) === null).toBe(senhaAtendePolitica(senha));
  });

  it('11 caracteres é curta; 73 bytes é longa', () => {
    expect(problemaDaSenha('a'.repeat(11))).toBe('curta');
    expect(problemaDaSenha('a'.repeat(73))).toBe('longa');
  });
});
