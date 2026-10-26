import { describe, expect, it } from 'vitest';
import { comMes, mesAnterior, mesSeguinte } from './mes';

describe('mesAnterior e mesSeguinte', () => {
  it('volta um mês na virada de ano', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12');
  });

  it('avança um mês na virada de ano', () => {
    expect(mesSeguinte('2026-12')).toBe('2027-01');
  });

  it('anda um mês no meio do ano', () => {
    expect(mesAnterior('2026-10')).toBe('2026-09');
    expect(mesSeguinte('2026-10')).toBe('2026-11');
  });
});

describe('comMes', () => {
  const ler = (caminho: string) => new URL(caminho, 'http://app.local');

  it('acrescenta o mês ao caminho sem parâmetros', () => {
    const url = ler(comMes('/lancamentos', '2026-08'));
    expect(url.pathname).toBe('/lancamentos');
    expect(url.searchParams.get('mes')).toBe('2026-08');
  });

  it('aponta o Início para /?mes=', () => {
    expect(comMes('/', '2026-08')).toBe('/?mes=2026-08');
  });

  it('preserva os outros parâmetros do caminho', () => {
    const url = ler(comMes('/lancamentos?escopo=eu&categoria=mercado', '2026-08'));
    expect(url.pathname).toBe('/lancamentos');
    expect(url.searchParams.get('escopo')).toBe('eu');
    expect(url.searchParams.get('categoria')).toBe('mercado');
    expect(url.searchParams.get('mes')).toBe('2026-08');
  });

  it('troca o mês que já estava no caminho, sem repetir o parâmetro', () => {
    const url = ler(comMes('/orcamento?mes=2026-01&escopo=casa', '2026-08'));
    expect(url.searchParams.getAll('mes')).toEqual(['2026-08']);
    expect(url.searchParams.get('escopo')).toBe('casa');
  });
});
