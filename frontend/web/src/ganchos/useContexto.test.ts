import type { SaidaSessaoAtual } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { montarContexto } from './useContexto';

const SESSAO: SaidaSessaoAtual = {
  usuario: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana', email: 'ana@exemplo.com' },
  membro: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Ana', papel: 'titular' },
  lar: { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' },
  plano: null,
  termos_pendentes: false,
};

describe('montarContexto', () => {
  it('traz nome e e-mail da pessoa logada', () => {
    expect(montarContexto(SESSAO)?.membro).toEqual({ nome: 'Ana', email: 'ana@exemplo.com' });
  });

  it('o mês corrente é o de São Paulo: 01h UTC do dia 1º ainda é o mês anterior (RT-04)', () => {
    // 2026-11-01T01:00Z = 31/10 22:00 em São Paulo.
    expect(montarContexto(SESSAO, new Date('2026-11-01T01:00:00Z'))?.mes_corrente).toBe('2026-10');
    expect(montarContexto(SESSAO, new Date('2026-11-01T03:00:00Z'))?.mes_corrente).toBe('2026-11');
  });

  it('sem sessão ativa não há contexto', () => {
    expect(montarContexto(null)).toBeUndefined();
  });
});
