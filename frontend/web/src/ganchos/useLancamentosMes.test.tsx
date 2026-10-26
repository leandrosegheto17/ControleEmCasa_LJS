import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { CHAVES } from './chavesConsulta';
import { useLancamentosMes } from './useLancamentosMes';

const fetchSimulado = vi.fn<typeof fetch>();
const resposta = (status: number, corpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } }));
const urls = () => fetchSimulado.mock.calls.map(([u]) => String(u));

function criarAmbiente() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return { cliente, wrapper };
}

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => vi.unstubAllGlobals());

describe('useLancamentosMes (GET /api/lancamentos)', () => {
  it('pede o mês no dia 1 só com os filtros dados e guarda em ["lancamentos", mês, filtros]', async () => {
    const lista = lerResposta('lancamentos-mes.json');
    fetchSimulado.mockImplementation(() => resposta(200, lista));
    const { cliente, wrapper } = criarAmbiente();
    const filtros = { escopo: 'individual' as const, variavel: true as const };

    const { result } = renderHook(() => useLancamentosMes('2026-10', filtros), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(lista);
    expect(urls()).toEqual(['/api/lancamentos?mes=2026-10-01&escopo=individual&variavel=true']);
    expect(cliente.getQueryData([...CHAVES.lancamentosMes, '2026-10', filtros])).toEqual(lista);
  });

  it('sem filtros, só o mês vai na requisição', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, lerResposta('lancamentos-mes.json')));
    const { wrapper } = criarAmbiente();

    const { result } = renderHook(() => useLancamentosMes('2026-10', {}), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls()).toEqual(['/api/lancamentos?mes=2026-10-01']);
  });

  it('categoria e forma vão como categoria_id e forma_id', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, lerResposta('lancamentos-mes.json')));
    const { wrapper } = criarAmbiente();
    const ids = {
      categoriaId: '00000000-0000-4000-8000-000000000401',
      formaId: '00000000-0000-4000-8000-000000000301',
    };

    const { result } = renderHook(() => useLancamentosMes('2026-10', ids), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls()[0]).toBe(`/api/lancamentos?mes=2026-10-01&categoria_id=${ids.categoriaId}&forma_id=${ids.formaId}`);
  });

  it('trocar o filtro mantém os dados anteriores até chegar a nova resposta', async () => {
    let resolverNova: (r: Response) => void = () => {};
    fetchSimulado
      .mockImplementationOnce(() => resposta(200, lerResposta('lancamentos-mes.json')))
      .mockImplementationOnce(() => new Promise<Response>((r) => (resolverNova = r)));
    const { wrapper } = criarAmbiente();

    const { result, rerender } = renderHook(
      ({ filtros }: { filtros: { escopo?: 'conjunto' } }) => useLancamentosMes('2026-10', filtros),
      { wrapper, initialProps: { filtros: {} } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ filtros: { escopo: 'conjunto' } });

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(2));
    expect(result.current.data).toEqual(lerResposta('lancamentos-mes.json'));
    expect(result.current.isPlaceholderData).toBe(true);

    resolverNova(
      new Response(JSON.stringify(lerResposta('lancamentos-mes-vazio.json')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await waitFor(() => expect(result.current.data).toEqual(lerResposta('lancamentos-mes-vazio.json')));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it('sem rede o erro "rede" fica exposto', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    const { wrapper } = criarAmbiente();

    const { result } = renderHook(() => useLancamentosMes('2026-10', {}), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ tipo: 'rede' });
  });
});
