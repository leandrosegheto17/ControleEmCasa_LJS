import {
  CODIGOS_ERRO_ACESSO,
  CODIGOS_ERRO_CADASTROS,
  CODIGOS_ERRO_FIXAS,
  CODIGOS_ERRO_LANCAMENTO,
  CODIGOS_ERRO_LAR,
  CODIGOS_ERRO_ORCAMENTO_METAS,
  CODIGOS_ERRO_PLANO,
} from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { CODIGOS_ERRO } from './erros';

describe('comum/erros', () => {
  it('a lista local é a união exata dos códigos do contrato', () => {
    const doContrato = new Set<string>([
      ...CODIGOS_ERRO_ACESSO,
      ...CODIGOS_ERRO_CADASTROS,
      ...CODIGOS_ERRO_FIXAS,
      ...CODIGOS_ERRO_LANCAMENTO,
      ...CODIGOS_ERRO_LAR,
      ...CODIGOS_ERRO_ORCAMENTO_METAS,
      ...CODIGOS_ERRO_PLANO,
    ]);
    expect([...CODIGOS_ERRO].sort()).toEqual([...doContrato].sort());
  });
});
