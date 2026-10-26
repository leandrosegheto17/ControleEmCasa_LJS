import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  criarServidor,
  ID_INTER,
  ID_PIX,
  instalarApi,
  preAquecerPaginas,
  type Servidor,
} from '../../test/apoio/apiCadastros';
import { useCategoria, useCategorias, useComandosCategoria } from './useCategorias';
import { useComandosConta, useConta, useContas, usePreviaAjuste } from './useContas';
import { useComandosForma, useForma, useFormasPagamento } from './useFormasPagamento';

/** Ganchos dos cadastros: leitura pela API, cache por chave e o que cada escrita invalida. */

let servidor: Servidor;

beforeAll(preAquecerPaginas, 30_000);
const contagem = (url: string) => servidor.chamadas.filter((c) => c.metodo === 'GET' && c.url === url).length;

function envoltorio() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Provedor = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return Provedor;
}

beforeEach(() => {
  servidor = criarServidor();
  instalarApi(servidor);
});
afterEach(() => vi.unstubAllGlobals());

describe('consultas', () => {
  it('useContas, useFormasPagamento e useCategorias leem as listas da API', async () => {
    const { result } = renderHook(() => [useContas(), useFormasPagamento(), useCategorias()] as const, {
      wrapper: envoltorio(),
    });

    await waitFor(() => expect(result.current.every((c) => c.isSuccess)).toBe(true));
    expect(result.current[0].data).toHaveLength(2);
    expect(result.current[1].data).toHaveLength(2);
    expect(result.current[2].data).toHaveLength(2);
  });

  it('useConta, useForma e useCategoria devolvem a linha pedida ou registro_invalido', async () => {
    const { result } = renderHook(() => [useConta(ID_INTER), useForma(ID_PIX), useCategoria('x')] as const, {
      wrapper: envoltorio(),
    });

    await waitFor(() => expect(result.current[0].isSuccess && result.current[1].isSuccess).toBe(true));
    expect(result.current[0].data?.nome).toBe('Inter');
    expect(result.current[1].data?.nome).toBe('Pix Nubank');
    await waitFor(() => expect(result.current[2].isError).toBe(true));
    expect(result.current[2].error).toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
  });

  it('usePreviaAjuste só pergunta ao servidor com um valor e não grava', async () => {
    const { result, rerender } = renderHook(({ valor }) => usePreviaAjuste(ID_INTER, valor), {
      wrapper: envoltorio(),
      initialProps: { valor: undefined as number | undefined },
    });
    expect(servidor.chamadas).toHaveLength(0);

    rerender({ valor: 7000 });

    await waitFor(() => expect(result.current.data).toBe(2000));
    expect(servidor.contas[1]?.saldo_centavos).toBe(5000);
  });
});

describe('invalidação depois de escrever', () => {
  it('salvar conta relê as contas e as formas (a forma mostra o nome da conta)', async () => {
    const { result } = renderHook(
      () => ({ contas: useContas(), formas: useFormasPagamento(), cmd: useComandosConta() }),
      { wrapper: envoltorio() },
    );
    await waitFor(() => expect(result.current.contas.isSuccess && result.current.formas.isSuccess).toBe(true));

    await act(() =>
      result.current.cmd.salvarConta.mutateAsync({ id: ID_INTER, nome: 'Inter PJ', saldoInicialCentavos: 0 }),
    );

    await waitFor(() => expect(contagem('/api/contas')).toBe(2));
    await waitFor(() => expect(contagem('/api/formas')).toBe(2));
    await waitFor(() => expect(result.current.contas.data?.find((c) => c.id === ID_INTER)?.nome).toBe('Inter PJ'));
  });

  it('ajustar saldo relê só as contas', async () => {
    const { result } = renderHook(
      () => ({ contas: useContas(), formas: useFormasPagamento(), cmd: useComandosConta() }),
      { wrapper: envoltorio() },
    );
    await waitFor(() => expect(result.current.contas.isSuccess && result.current.formas.isSuccess).toBe(true));

    await act(() => result.current.cmd.ajustarSaldo.mutateAsync({ contaId: ID_INTER, saldoRealCentavos: 9000 }));

    await waitFor(() => expect(contagem('/api/contas')).toBe(2));
    expect(contagem('/api/formas')).toBe(1);
    await waitFor(() => expect(result.current.contas.data?.find((c) => c.id === ID_INTER)?.saldo_centavos).toBe(9000));
  });

  it('definir preferida relê as formas; arquivar categoria relê as categorias', async () => {
    const { result } = renderHook(
      () => ({
        formas: useFormasPagamento(),
        categorias: useCategorias(),
        f: useComandosForma(),
        c: useComandosCategoria(),
      }),
      { wrapper: envoltorio() },
    );
    await waitFor(() => expect(result.current.formas.isSuccess && result.current.categorias.isSuccess).toBe(true));

    await act(() => result.current.f.definirPreferida.mutateAsync({ id: ID_PIX, preferida: true }));
    await waitFor(() => expect(contagem('/api/formas')).toBe(2));
    expect(contagem('/api/categorias')).toBe(1);

    await act(() => result.current.c.arquivarCategoria.mutateAsync('00000000-0000-4000-8000-000000000401'));
    await waitFor(() => expect(contagem('/api/categorias')).toBe(2));
    expect(contagem('/api/formas')).toBe(2);
  });

  it('escrita que falha não invalida nada e expõe o erro de regra', async () => {
    servidor.erros.set('DELETE /api/contas/:id', { status: 409, code: 'em_uso' });
    const { result } = renderHook(() => ({ contas: useContas(), cmd: useComandosConta() }), {
      wrapper: envoltorio(),
    });
    await waitFor(() => expect(result.current.contas.isSuccess).toBe(true));

    await act(async () => {
      await result.current.cmd.excluirConta.mutateAsync(ID_INTER).catch(() => undefined);
    });

    await waitFor(() => expect(result.current.cmd.excluirConta.error).toEqual({ tipo: 'regra', codigo: 'em_uso' }));
    expect(contagem('/api/contas')).toBe(1);
  });
});
