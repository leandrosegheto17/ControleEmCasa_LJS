import {
  CODIGOS_ERRO_ACESSO,
  CODIGOS_ERRO_CADASTROS,
  CODIGOS_ERRO_FIXAS,
  CODIGOS_ERRO_LANCAMENTO,
  CODIGOS_ERRO_LAR,
  CODIGOS_ERRO_ORCAMENTO_METAS,
} from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import type { CodigoErro } from '../comum/erros';
import { ROTULO_ERRO } from './erros';

const TODOS = [
  ...new Set<CodigoErro>([
    ...CODIGOS_ERRO_ACESSO,
    ...CODIGOS_ERRO_CADASTROS,
    ...CODIGOS_ERRO_FIXAS,
    ...CODIGOS_ERRO_LANCAMENTO,
    ...CODIGOS_ERRO_LAR,
    ...CODIGOS_ERRO_ORCAMENTO_METAS,
  ]),
];

describe('rotulos/erros', () => {
  it.each(TODOS)('"%s" tem texto pt-BR', (codigo) => {
    const texto = ROTULO_ERRO[codigo].texto;
    expect(typeof texto).toBe('string');
    expect(texto.trim().length).toBeGreaterThan(0);
  });

  it.each(TODOS)('"%s" nunca mostra o código cru', (codigo) => {
    expect(ROTULO_ERRO[codigo].texto).not.toContain(codigo);
    expect(ROTULO_ERRO[codigo].texto).not.toMatch(/_/);
  });

  it('não tem chave fora do contrato', () => {
    expect(Object.keys(ROTULO_ERRO).sort()).toEqual([...TODOS].sort());
  });

  it('as credenciais erradas não dizem se o e-mail existe (G-19)', () => {
    expect(ROTULO_ERRO.credenciais_invalidas.texto).toBe('E-mail ou senha incorretos.');
  });
});
