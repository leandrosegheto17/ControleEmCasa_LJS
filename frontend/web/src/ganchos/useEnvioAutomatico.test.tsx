import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnvioAutomatico } from './useEnvioAutomatico';

const { parar, iniciarEnvioAutomatico, fila, ouvintes } = vi.hoisted(() => {
  const ouvintes: Array<(evento: unknown) => void> = [];
  const parar = vi.fn();
  return {
    parar,
    ouvintes,
    iniciarEnvioAutomatico: vi.fn(() => parar),
    fila: {
      esvaziar: vi.fn(async () => undefined),
      listar: vi.fn(async () => []),
      assinar: vi.fn((cb: (evento: unknown) => void) => {
        ouvintes.push(cb);
        return () => {
          const i = ouvintes.indexOf(cb);
          if (i >= 0) ouvintes.splice(i, 1);
        };
      }),
    },
  };
});

vi.mock('../dados/fila/envioAutomatico', () => ({ iniciarEnvioAutomatico, enviarAgora: vi.fn() }));
vi.mock('../dados/fila/fila', () => ({ fila }));

function montar() {
  const clienteConsulta = new QueryClient();
  const invalidar = vi.spyOn(clienteConsulta, 'invalidateQueries');
  const envolver = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={clienteConsulta}>{children}</QueryClientProvider>
  );
  return { invalidar, envolver };
}

beforeEach(() => {
  vi.clearAllMocks();
  ouvintes.length = 0;
});

describe('useEnvioAutomatico', () => {
  it('inicia o envio automático uma vez ao montar', () => {
    const { envolver } = montar();
    const { rerender } = renderHook(() => useEnvioAutomatico(), { wrapper: envolver });
    rerender();
    expect(iniciarEnvioAutomatico).toHaveBeenCalledTimes(1);
  });

  it('evento "enviado" invalida as consultas para as telas mostrarem o lançamento', () => {
    const { envolver, invalidar } = montar();
    renderHook(() => useEnvioAutomatico(), { wrapper: envolver });

    act(() => {
      for (const ouvinte of [...ouvintes]) ouvinte({ tipo: 'enviado', item: { id: 'i1' }, resposta: {} });
    });

    expect(invalidar).toHaveBeenCalled();
  });

  it('desmontar chama parar e cancela a assinatura', () => {
    const { envolver } = montar();
    const { unmount } = renderHook(() => useEnvioAutomatico(), { wrapper: envolver });

    unmount();

    expect(parar).toHaveBeenCalledTimes(1);
    expect(ouvintes).toHaveLength(0);
  });
});
