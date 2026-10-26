import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useFiltrosDaUrl } from './useFiltrosDaUrl';

const DEBITO_ITAU = '00000000-0000-4000-8000-000000000302';

function montar(rota: string) {
  const envoltorio = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/inicio', rota]} initialIndex={1}>
      {children}
    </MemoryRouter>
  );
  return renderHook(
    () => {
      const [filtros, definir, limpar] = useFiltrosDaUrl();
      return { filtros, definir, limpar, local: useLocation(), navegar: useNavigate() };
    },
    { wrapper: envoltorio },
  );
}

describe('useFiltrosDaUrl', () => {
  it('lê os filtros da URL', () => {
    const { result } = montar(`/lancamentos?mes=2026-10&escopo=casa&forma=${DEBITO_ITAU}`);
    expect(result.current.filtros).toEqual({ escopo: 'casa', forma: DEBITO_ITAU });
  });

  it('definir grava na URL e mantém o mês', () => {
    const { result } = montar('/lancamentos?mes=2026-09');

    act(() => result.current.definir({ escopo: 'eu', variavel: true }));

    const params = new URLSearchParams(result.current.local.search);
    expect(params.get('mes')).toBe('2026-09');
    expect(params.get('escopo')).toBe('eu');
    expect(result.current.filtros).toEqual({ escopo: 'eu', variavel: true });
  });

  it('definir usa replace (não acrescenta entrada no histórico)', () => {
    const { result } = montar('/lancamentos?mes=2026-10');

    act(() => result.current.definir({ escopo: 'casa' }));
    act(() => result.current.navegar(-1));

    expect(result.current.local.pathname).toBe('/inicio');
  });

  it('voltar para a lista mantém os filtros (recarregar com a mesma URL)', () => {
    const { result } = montar('/lancamentos?mes=2026-10');

    act(() => result.current.definir({ escopo: 'casa', forma: DEBITO_ITAU }));
    const urlComFiltros = result.current.local.pathname + result.current.local.search;
    act(() => result.current.navegar('/lancamentos/00000000-0000-4000-8000-000000000520'));
    act(() => result.current.navegar(-1));

    expect(result.current.local.pathname + result.current.local.search).toBe(urlComFiltros);
    expect(result.current.filtros).toEqual({ escopo: 'casa', forma: DEBITO_ITAU });

    const recarregado = montar(urlComFiltros);
    expect(recarregado.result.current.filtros).toEqual({ escopo: 'casa', forma: DEBITO_ITAU });
  });

  it('limpar remove todos os filtros e mantém o mês', () => {
    const { result } = montar(`/lancamentos?mes=2026-10&escopo=casa&forma=${DEBITO_ITAU}&variavel=1`);

    act(() => result.current.limpar());

    expect(result.current.local.search).toBe('?mes=2026-10');
    expect(result.current.filtros).toEqual({});
  });
});
