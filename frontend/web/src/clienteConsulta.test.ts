import { describe, expect, it } from 'vitest';
import { clienteConsulta } from './clienteConsulta';

describe('clienteConsulta', () => {
  it('reconsulta ao voltar o foco da janela', () => {
    expect(clienteConsulta.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true);
  });

  describe('retry padrão', () => {
    const retry = clienteConsulta.getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean;

    it('não repete erro de regra', () => {
      expect(retry(0, { tipo: 'regra', codigo: 'registro_invalido' })).toBe(false);
    });

    it.each(['rede', 'indisponivel', 'autenticacao', 'desconhecido'])('repete erro %s até a 3ª falha', (tipo) => {
      for (const tentativas of [0, 1, 2]) expect(retry(tentativas, { tipo })).toBe(true);
      expect(retry(3, { tipo })).toBe(false);
    });
  });
});
