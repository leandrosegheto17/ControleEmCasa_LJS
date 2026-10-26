import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRevalidarPagina } from './useRevalidarPagina';

describe('useRevalidarPagina', () => {
  it('refaz só as consultas ativas da página e devolve uma promessa', async () => {
    const clienteConsulta = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const resumo = vi.fn(async () => 'resumo');
    const lancamentos = vi.fn(async () => 'lancamentos');
    const inativa = vi.fn(async () => 'metas');
    await clienteConsulta.fetchQuery({ queryKey: ['metas'], queryFn: inativa });

    const envolver = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={clienteConsulta}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () => {
        useQuery({ queryKey: ['resumo_mes'], queryFn: resumo });
        useQuery({ queryKey: ['lancamentos_mes'], queryFn: lancamentos });
        return useRevalidarPagina();
      },
      { wrapper: envolver },
    );
    await waitFor(() => expect(resumo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(lancamentos).toHaveBeenCalledTimes(1));

    await act(async () => {
      const retorno = result.current();
      expect(retorno).toBeInstanceOf(Promise);
      await retorno;
    });

    expect(resumo).toHaveBeenCalledTimes(2);
    expect(lancamentos).toHaveBeenCalledTimes(2);
    expect(inativa).toHaveBeenCalledTimes(1);
  });
});
