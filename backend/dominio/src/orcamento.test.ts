import { describe, expect, it } from 'vitest';
import { destaquesOrcamento, situacaoOrcamento } from './orcamento';

// Casos portados de MyMoney/backend/supabase/tests/orcamento/situacao_orcamento.sql e da tabela da RN-16.
describe('situacaoOrcamento (RN-16, CA-T5.3)', () => {
  it.each([
    [10000, 7999, 80, 'dentro', '79,99% fica dentro (percentual exibido 80)'],
    [10000, 8000, 80, 'atencao', '80% é atenção'],
    [10000, 10000, 100, 'atencao', '100% é atenção'],
    [10000, 10001, 100, 'estourado', '100,01% é estourado (exibe 100)'],
    [10000, 0, 0, 'dentro', 'realizado zero é 0% dentro'],
    [30000, 33250, 111, 'estourado', '33250 de 30000 é 111% estourado'],
  ] as const)('orçado %i, realizado %i → %i%% %s (%s)', (...[orcado, realizado, percentual, situacao]) => {
    expect(situacaoOrcamento(orcado, realizado)).toEqual({ percentual, situacao });
  });

  it('a razão é exata: 1 centavo abaixo de 80% é dentro, mesmo em valores grandes', () => {
    expect(situacaoOrcamento(100_000_000_000, 79_999_999_999).situacao).toBe('dentro');
    expect(situacaoOrcamento(100_000_000_000, 80_000_000_000).situacao).toBe('atencao');
    expect(situacaoOrcamento(100_000_000_000, 100_000_000_001).situacao).toBe('estourado');
  });

  it('orçado 0: percentual nulo (nullif do legado); realizado 0 é atenção, > 0 é estourado', () => {
    expect(situacaoOrcamento(0, 0)).toEqual({ percentual: null, situacao: 'atencao' });
    expect(situacaoOrcamento(0, 1)).toEqual({ percentual: null, situacao: 'estourado' });
  });

  it('recusa valor que não é centavo inteiro', () => {
    expect(() => situacaoOrcamento(100.5, 1)).toThrow();
  });
});

// Ordem e destaques: F orcado_realizado.sql (percentual desc, nome) e tests/resumo/resumo_mes_orcamento.sql.
describe('destaquesOrcamento (RN-16)', () => {
  it('as 3 primeiras por percentual decrescente, empate por nome', () => {
    const linhas = [
      { nome: 'Mercado', percentual: 50 },
      { nome: 'Contas da casa', percentual: 120 },
      { nome: 'Delivery', percentual: 80 },
      { nome: 'Almoço', percentual: 80 },
      { nome: 'Moradia', percentual: 10 },
    ];
    expect(destaquesOrcamento(linhas).map((l) => l.nome)).toEqual(['Contas da casa', 'Almoço', 'Delivery']);
  });
  it('menos de 3 linhas: devolve todas; sem linhas: vazio', () => {
    expect(destaquesOrcamento([{ nome: 'A', percentual: 1 }])).toHaveLength(1);
    expect(destaquesOrcamento([])).toEqual([]);
  });
  it('não altera a lista recebida', () => {
    const linhas = [
      { nome: 'B', percentual: 1 },
      { nome: 'A', percentual: 2 },
    ];
    destaquesOrcamento(linhas);
    expect(linhas.map((l) => l.nome)).toEqual(['B', 'A']);
  });
});
