import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { CHAVES } from './chavesConsulta';
import { useLancamento } from './useLancamento';

const ID_GELADEIRA = '00000000-0000-4000-8000-000000000520';
const fetchSimulado = vi.fn<typeof fetch>();
const resposta = (status: number, corpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } }));

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

describe('useLancamento (GET /api/lancamentos/:id)', () => {
  it('busca o detalhe e guarda em ["lancamento", id]', async () => {
    const detalhe = lerResposta('lancamento-pagador.json');
    fetchSimulado.mockImplementation(() => resposta(200, detalhe));
    const { cliente, wrapper } = criarAmbiente();

    const { result } = renderHook(() => useLancamento(ID_GELADEIRA), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSimulado.mock.calls[0]?.[0]).toBe(`/api/lancamentos/${ID_GELADEIRA}`);
    expect(cliente.getQueryData(CHAVES.lancamento(ID_GELADEIRA))).toEqual(detalhe);
  });

  it('para o outro membro a resposta não traz as chaves privadas e o gancho a entrega como veio (RN-04)', async () => {
    const detalhe = lerResposta<Record<string, unknown>>('lancamento-outro-membro.json');
    fetchSimulado.mockImplementation(() => resposta(200, detalhe));
    const { wrapper } = criarAmbiente();

    const { result } = renderHook(() => useLancamento(ID_GELADEIRA), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect('pagamento' in (result.current.data as object)).toBe(false);
  });

  it('registro_invalido (inexistente ou de outro lar) fica exposto como erro', async () => {
    fetchSimulado.mockImplementation(() => resposta(404, { code: 'registro_invalido', message: 'x' }));
    const { wrapper } = criarAmbiente();

    const { result } = renderHook(() => useLancamento(ID_GELADEIRA), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
  });

  it('id malformado nem chega à rede e vale registro_invalido', async () => {
    const { wrapper } = criarAmbiente();

    const { result } = renderHook(() => useLancamento('nao-e-uuid'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});
