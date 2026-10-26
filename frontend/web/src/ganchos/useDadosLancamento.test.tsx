import type { ReactNode } from 'react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { useDadosLancamento } from './useDadosLancamento';

vi.mock('../dados/consultas/dadosLancamento', () => ({
  buscarDadosLancamento: vi.fn(),
  lerDadosDoAparelho: vi.fn(),
}));

const consulta = await import('../dados/consultas/dadosLancamento');

const DADOS = lerResposta('dados-lancamento.json');
const SALVO_EM = Date.UTC(2026, 9, 9, 17, 32);

function montar() {
  const clienteConsulta = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const envolver = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={clienteConsulta}>{children}</QueryClientProvider>
  );
  return envolver;
}

beforeEach(() => {
  vi.mocked(consulta.buscarDadosLancamento).mockReset();
  vi.mocked(consulta.lerDadosDoAparelho).mockReset();
  vi.mocked(consulta.lerDadosDoAparelho).mockResolvedValue(undefined as never);
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('useDadosLancamento', () => {
  it('com rede entrega a resposta do servidor', async () => {
    vi.mocked(consulta.buscarDadosLancamento).mockResolvedValue({
      dados: DADOS,
      doAparelho: false,
      salvoEm: SALVO_EM,
    } as never);

    const { result } = renderHook(() => useDadosLancamento(), { wrapper: montar() });

    await waitFor(() => expect(result.current.data?.dados).toEqual(DADOS));
    expect(result.current.data?.doAparelho).toBe(false);
  });

  it('sem rede a consulta não fica pausada: roda e entrega o cache do aparelho', async () => {
    onlineManager.setOnline(false);
    vi.mocked(consulta.buscarDadosLancamento).mockResolvedValue({
      dados: DADOS,
      doAparelho: true,
      salvoEm: SALVO_EM,
    } as never);

    const { result } = renderHook(() => useDadosLancamento(), { wrapper: montar() });

    await waitFor(() => expect(consulta.buscarDadosLancamento).toHaveBeenCalled());
    await waitFor(() => expect(result.current.data?.dados).toEqual(DADOS));
    expect(result.current.data?.doAparelho).toBe(true);
    expect(result.current.fetchStatus).not.toBe('paused');
  });

  it('com cache local e rede lenta, os dados aparecem antes da resposta do servidor', async () => {
    vi.mocked(consulta.buscarDadosLancamento).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(consulta.lerDadosDoAparelho).mockResolvedValue({
      dados: DADOS,
      doAparelho: true,
      salvoEm: SALVO_EM,
    } as never);

    const { result } = renderHook(() => useDadosLancamento(), { wrapper: montar() });

    await waitFor(() => expect(result.current.data?.dados).toEqual(DADOS));
  });

  it('resposta do servidor substitui o cache mostrado', async () => {
    let responder: (v: unknown) => void = () => undefined;
    vi.mocked(consulta.buscarDadosLancamento).mockReturnValue(
      new Promise((r) => {
        responder = r;
      }) as never,
    );
    vi.mocked(consulta.lerDadosDoAparelho).mockResolvedValue({
      dados: DADOS,
      doAparelho: true,
      salvoEm: SALVO_EM,
    } as never);
    const novos = lerResposta('dados-lancamento-sem-formas.json');

    const { result } = renderHook(() => useDadosLancamento(), { wrapper: montar() });
    await waitFor(() => expect(result.current.data?.dados).toEqual(DADOS));

    responder({ dados: novos, doAparelho: false, salvoEm: Date.now() });

    await waitFor(() => expect(result.current.data?.dados).toEqual(novos));
  });
});
