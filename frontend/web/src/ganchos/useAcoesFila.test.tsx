import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAcoesFila } from './useAcoesFila';

const { fila, enviarAgora, ordem } = vi.hoisted(() => {
  const ordem: string[] = [];
  return {
    ordem,
    fila: {
      reativarFalhas: vi.fn(async () => {
        ordem.push('reativarFalhas');
      }),
      descartar: vi.fn(async () => undefined),
      listar: vi.fn(async () => []),
      assinar: vi.fn(() => () => undefined),
      esvaziar: vi.fn(async () => undefined),
    },
    enviarAgora: vi.fn(async () => {
      ordem.push('enviarAgora');
    }),
  };
});

vi.mock('../dados/fila/fila', () => ({ fila }));
vi.mock('../dados/fila/envioAutomatico', () => ({ enviarAgora, iniciarEnvioAutomatico: vi.fn(() => () => undefined) }));

const ID = '00000000-0000-4000-8000-0000000009a1';

beforeEach(() => {
  ordem.length = 0;
  vi.clearAllMocks();
});

describe('useAcoesFila — Tentar agora', () => {
  it('reativa as falhas e depois chama enviarAgora', async () => {
    const { result } = renderHook(() => useAcoesFila());
    await act(() => result.current.tentarAgora());
    expect(fila.reativarFalhas).toHaveBeenCalledTimes(1);
    expect(enviarAgora).toHaveBeenCalledTimes(1);
    expect(ordem).toEqual(['reativarFalhas', 'enviarAgora']);
  });

  it('fica "enviando" durante a rodada e volta ao fim', async () => {
    let terminar: () => void = () => undefined;
    enviarAgora.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          terminar = resolve;
        }),
    );
    const { result } = renderHook(() => useAcoesFila());
    expect(result.current.enviando).toBe(false);

    let rodada: Promise<void> = Promise.resolve();
    act(() => {
      rodada = result.current.tentarAgora();
    });
    await waitFor(() => expect(result.current.enviando).toBe(true));

    await act(async () => {
      terminar();
      await rodada;
    });
    expect(result.current.enviando).toBe(false);
  });

  it('erro na rodada não deixa o estado preso em "enviando"', async () => {
    enviarAgora.mockRejectedValueOnce({ tipo: 'rede' });
    const { result } = renderHook(() => useAcoesFila());
    await act(async () => {
      await result.current.tentarAgora().catch(() => undefined);
    });
    expect(result.current.enviando).toBe(false);
  });
});

describe('useAcoesFila — Descartar', () => {
  it('descarta pela fila com confirmação explícita', async () => {
    const { result } = renderHook(() => useAcoesFila());
    await act(() => result.current.descartar(ID));
    expect(fila.descartar).toHaveBeenCalledTimes(1);
    expect(fila.descartar).toHaveBeenCalledWith(ID, { confirmado: true });
  });
});

describe('useAcoesFila — Corrigir', () => {
  it('lançar a versão corrigida descarta o item antigo', async () => {
    const { result } = renderHook(() => useAcoesFila());
    act(() => result.current.iniciarCorrecao(ID));
    expect(fila.descartar).not.toHaveBeenCalled();

    await act(() => result.current.concluirCorrecao());
    expect(fila.descartar).toHaveBeenCalledTimes(1);
    expect(fila.descartar).toHaveBeenCalledWith(ID, { confirmado: true });
  });

  it('fechar a T03 sem lançar mantém o item', async () => {
    const { result } = renderHook(() => useAcoesFila());
    act(() => result.current.iniciarCorrecao(ID));
    act(() => result.current.cancelarCorrecao());
    await act(() => result.current.concluirCorrecao());
    expect(fila.descartar).not.toHaveBeenCalled();
  });

  it('lançamento comum, sem correção em andamento, não descarta nada', async () => {
    const { result } = renderHook(() => useAcoesFila());
    await act(() => result.current.concluirCorrecao());
    expect(fila.descartar).not.toHaveBeenCalled();
  });

  it('a correção só descarta uma vez', async () => {
    const { result } = renderHook(() => useAcoesFila());
    act(() => result.current.iniciarCorrecao(ID));
    await act(() => result.current.concluirCorrecao());
    await act(() => result.current.concluirCorrecao());
    expect(fila.descartar).toHaveBeenCalledTimes(1);
  });
});
