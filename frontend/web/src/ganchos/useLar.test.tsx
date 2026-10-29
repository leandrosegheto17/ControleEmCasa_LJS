import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErroDados } from '../comum/erros';
import { removerMembro, sairDoLar } from '../dados/lar';
import { CHAVES } from './chavesConsulta';
import { tomarSaidaDaCasa } from './saidaDaCasa';
import { useRemoverMembro, useSairDoLar } from './useLar';
import { CHAVE_SESSAO } from './useSessao';

vi.mock('../dados/lar', async (original) => ({
  ...(await original<typeof import('../dados/lar')>()),
  removerMembro: vi.fn(),
  sairDoLar: vi.fn(),
}));

const ID = '00000000-0000-4000-8000-0000000000c1';
const CHAVE_OUTRA = CHAVES.contas;

let cliente: QueryClient;

/** Cache com o lar, a sessão e uma leitura qualquer do lar (contas), todas frescas. */
function envoltorio() {
  cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  cliente.setQueryData(CHAVES.lar, { membros: [] });
  cliente.setQueryData(CHAVE_SESSAO, { lar: { id: 'x' } });
  cliente.setQueryData(CHAVE_OUTRA, [{ id: 'conta-da-casa-anterior' }]);
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
}
const invalidada = (chave: readonly unknown[]) => cliente.getQueryState(chave)?.isInvalidated;

beforeEach(() => {
  vi.mocked(removerMembro).mockReset();
  vi.mocked(sairDoLar).mockReset();
});
afterEach(() => onlineManager.setOnline(true));

describe('useRemoverMembro', () => {
  it('sucesso chama a remoção com o id e invalida só a chave do lar', async () => {
    vi.mocked(removerMembro).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoverMembro(), { wrapper: envoltorio() });

    await act(() => result.current.mutateAsync(ID));

    expect(removerMembro).toHaveBeenCalledWith(ID);
    expect(invalidada(CHAVES.lar)).toBe(true);
    expect(invalidada(CHAVE_SESSAO)).toBe(false);
    expect(invalidada(CHAVE_OUTRA)).toBe(false);
  });

  it.each<ErroDados>([{ tipo: 'regra', codigo: 'registro_invalido' }, { tipo: 'rede' }, { tipo: 'indisponivel' }])(
    'falha %j chega à tela e não invalida nada',
    async (erro) => {
      vi.mocked(removerMembro).mockRejectedValue(erro);
      const { result } = renderHook(() => useRemoverMembro(), { wrapper: envoltorio() });

      act(() => result.current.mutate(ID));

      await waitFor(() => expect(result.current.error).toEqual(erro));
      expect(invalidada(CHAVES.lar)).toBe(false);
      expect(invalidada(CHAVE_SESSAO)).toBe(false);
      expect(invalidada(CHAVE_OUTRA)).toBe(false);
    },
  );

  it('sem rede a mutação roda (não fica pausada) e o erro rede chega à tela', async () => {
    onlineManager.setOnline(false);
    vi.mocked(removerMembro).mockRejectedValue({ tipo: 'rede' });
    const { result } = renderHook(() => useRemoverMembro(), { wrapper: envoltorio() });

    act(() => result.current.mutate(ID));

    await waitFor(() => expect(result.current.error).toEqual({ tipo: 'rede' }));
    expect(result.current.isPaused).toBe(false);
    expect(removerMembro).toHaveBeenCalledTimes(1);
  });
});

describe('useSairDoLar', () => {
  it('sucesso invalida a sessão (a guarda leva ao primeiro acesso) e tira do cache os dados da casa anterior', async () => {
    vi.mocked(sairDoLar).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSairDoLar(), { wrapper: envoltorio() });

    await act(async () => {
      await expect(result.current.mutateAsync()).resolves.toBe('saiu');
    });

    expect(sairDoLar).toHaveBeenCalledTimes(1);
    expect(invalidada(CHAVE_SESSAO)).toBe(true);
    expect(cliente.getQueryData(CHAVE_OUTRA)).toBeUndefined();
    expect(cliente.getQueryData(CHAVES.lar)).toBeUndefined();
  });

  it.each(['registro_invalido', 'sem_lar'] as const)(
    '%s também renova a sessão, sem erro para a tela',
    async (codigo) => {
      vi.mocked(sairDoLar).mockRejectedValue({ tipo: 'regra', codigo });
      const { result } = renderHook(() => useSairDoLar(), { wrapper: envoltorio() });

      await act(async () => {
        await expect(result.current.mutateAsync()).resolves.toBe('sem_vinculo');
      });

      expect(result.current.error).toBeNull();
      expect(invalidada(CHAVE_SESSAO)).toBe(true);
    },
  );

  it.each<ErroDados>([{ tipo: 'rede' }, { tipo: 'indisponivel' }, { tipo: 'regra', codigo: 'muitas_requisicoes' }])(
    'falha %j chega à tela e mantém sessão e cache como estavam',
    async (erro) => {
      vi.mocked(sairDoLar).mockRejectedValue(erro);
      const { result } = renderHook(() => useSairDoLar(), { wrapper: envoltorio() });

      act(() => result.current.mutate());

      await waitFor(() => expect(result.current.error).toEqual(erro));
      expect(invalidada(CHAVE_SESSAO)).toBe(false);
      expect(cliente.getQueryData(CHAVE_OUTRA)).toEqual([{ id: 'conta-da-casa-anterior' }]);
    },
  );

  it('sem rede a mutação roda (não fica pausada) e o erro rede chega à tela', async () => {
    onlineManager.setOnline(false);
    vi.mocked(sairDoLar).mockRejectedValue({ tipo: 'rede' });
    const { result } = renderHook(() => useSairDoLar(), { wrapper: envoltorio() });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.error).toEqual({ tipo: 'rede' }));
    expect(result.current.isPaused).toBe(false);
    expect(sairDoLar).toHaveBeenCalledTimes(1);
  });
});

describe('useSairDoLar: aviso na chegada ao primeiro acesso', () => {
  afterEach(() => void tomarSaidaDaCasa());

  it('só a saída feita agora deixa a marca, uma vez', async () => {
    vi.mocked(sairDoLar).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSairDoLar(), { wrapper: envoltorio() });

    await act(() => result.current.mutateAsync());

    expect(tomarSaidaDaCasa()).toBe(true);
    expect(tomarSaidaDaCasa()).toBe(false);
  });

  it.each<ErroDados>([
    { tipo: 'regra', codigo: 'registro_invalido' },
    { tipo: 'regra', codigo: 'sem_lar' },
    { tipo: 'rede' },
  ])('%j não deixa a marca', async (erro) => {
    vi.mocked(sairDoLar).mockRejectedValue(erro);
    const { result } = renderHook(() => useSairDoLar(), { wrapper: envoltorio() });

    await act(() => result.current.mutateAsync().catch(() => undefined));

    expect(tomarSaidaDaCasa()).toBe(false);
  });
});
