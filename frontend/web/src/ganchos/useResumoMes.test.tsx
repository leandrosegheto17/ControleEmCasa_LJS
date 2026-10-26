import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { CHAVES } from './chavesConsulta';
import { useResumoMes } from './useResumoMes';

const resumo = lerResposta('resumo-mes.json');
const fetchSimulado = vi.fn<typeof fetch>();

const resposta = (status: number, corpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } }));

function montar(mesInicial: string) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  const resultado = renderHook(({ mes }: { mes: string }) => useResumoMes(mes), {
    wrapper,
    initialProps: { mes: mesInicial },
  });
  return { cliente, ...resultado };
}

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => vi.unstubAllGlobals());

describe('useResumoMes (GET /api/resumo)', () => {
  it('pede o mês no dia 1 e guarda na chave ["resumo", mes]', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, resumo));
    const { result, cliente } = montar('2026-10');

    await waitFor(() => expect(result.current.data).toEqual(resumo));
    expect(fetchSimulado.mock.calls[0]?.[0]).toBe('/api/resumo?mes=2026-10-01');
    expect(cliente.getQueryData(CHAVES.resumoDoMes('2026-10'))).toEqual(resumo);
  });

  it('trocar o mês refaz a consulta com o mês novo', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, resumo));
    const { result, rerender } = montar('2026-10');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ mes: '2026-09' });

    await waitFor(() => expect(fetchSimulado.mock.calls.map(([u]) => u)).toContain('/api/resumo?mes=2026-09-01'));
    expect(fetchSimulado).toHaveBeenCalledTimes(2);
  });

  it('servidor fora do ar chega ao gancho como ErroDados "indisponivel"', async () => {
    fetchSimulado.mockImplementation(() => resposta(503, { message: 'Service Unavailable' }));
    const { result } = montar('2026-10');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ tipo: 'indisponivel' });
  });
});
