import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAVES } from './chavesConsulta';
import { useComandosLancamento } from './useComandosLancamento';

type Chave = readonly unknown[];

const ID_GELADEIRA = '00000000-0000-4000-8000-000000000520';
const ID_PARCELA_2 = '00000000-0000-4000-8000-000000000621';

const fetchSimulado = vi.fn<typeof fetch>();
const resposta = (status: number, corpo?: unknown) =>
  Promise.resolve(
    new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
const EDITADO = { id: ID_GELADEIRA, escopo: 'conjunto', num_parcelas: 3, alterado_em: '2026-10-12T15:00:00Z' };

function criarAmbiente() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const espiaInvalidar = vi.spyOn(cliente, 'invalidateQueries');
  const espiaRemover = vi.spyOn(cliente, 'removeQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  const chaves = (espia: typeof espiaInvalidar | typeof espiaRemover): Chave[] =>
    espia.mock.calls.map(([filtro]) => (filtro as { queryKey?: Chave } | undefined)?.queryKey ?? []);
  return { wrapper, espiaInvalidar, espiaRemover, chaves };
}

const comInicio = (chaves: Chave[], prefixo: string) => chaves.some((c) => c[0] === prefixo);
const chamada = () => fetchSimulado.mock.calls[0]!;
const corpoEnviado = () => JSON.parse(String(chamada()[1]?.body)) as Record<string, unknown>;

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => vi.unstubAllGlobals());

describe('useComandosLancamento: editar (PATCH /api/lancamentos/:id)', () => {
  it('manda só os campos alterados mais confirmar_descarte e invalida a lista, o detalhe e o resumo', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, EDITADO));
    const { wrapper, espiaInvalidar, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(() => result.current.editar.mutateAsync({ id: ID_GELADEIRA, campos: { descricao: 'Geladeira inox' } }));

    expect(chamada()[0]).toBe(`/api/lancamentos/${ID_GELADEIRA}`);
    expect(chamada()[1]?.method).toBe('PATCH');
    expect(corpoEnviado()).toEqual({ descricao: 'Geladeira inox', confirmar_descarte: false });
    const invalidadas = chaves(espiaInvalidar);
    expect(invalidadas).toEqual(
      expect.arrayContaining([[...CHAVES.lancamentosMes], [...CHAVES.lancamento(ID_GELADEIRA)]]),
    );
    expect(comInicio(invalidadas, CHAVES.resumoMes[0])).toBe(true);
  });

  it('com a confirmação, reenvia com confirmar_descarte: true (CA-06.4)', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, EDITADO));
    const { wrapper } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(() =>
      result.current.editar.mutateAsync({
        id: ID_GELADEIRA,
        campos: { valorTotalCentavos: 200000, numParcelas: 4 },
        confirmarDescarte: true,
      }),
    );

    expect(corpoEnviado()).toEqual({ valor_total_centavos: 200000, num_parcelas: 4, confirmar_descarte: true });
  });

  it('descarte pendente: o código confirmar_descarte_ajustes sobe e nada é invalidado', async () => {
    fetchSimulado.mockImplementation(() => resposta(409, { code: 'confirmar_descarte_ajustes', message: 'x' }));
    const { wrapper, espiaInvalidar } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(async () => {
      await expect(
        result.current.editar.mutateAsync({ id: ID_GELADEIRA, campos: { valorTotalCentavos: 200000 } }),
      ).rejects.toEqual({ tipo: 'regra', codigo: 'confirmar_descarte_ajustes' });
    });

    expect(espiaInvalidar).not.toHaveBeenCalled();
  });

  it('sem rede: erro "rede" sobe e nada é invalidado', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    const { wrapper, espiaInvalidar } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(async () => {
      await expect(result.current.editar.mutateAsync({ id: ID_GELADEIRA, campos: { descricao: 'x' } })).rejects.toEqual(
        { tipo: 'rede' },
      );
    });

    expect(espiaInvalidar).not.toHaveBeenCalled();
  });
});

describe('useComandosLancamento: excluir (DELETE /api/lancamentos/:id)', () => {
  it('sucesso invalida as listas e o resumo e remove o detalhe sem refazer a leitura', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));
    const { wrapper, espiaInvalidar, espiaRemover, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(() => result.current.excluir.mutateAsync(ID_GELADEIRA));

    expect(chamada()[0]).toBe(`/api/lancamentos/${ID_GELADEIRA}`);
    expect(chamada()[1]?.method).toBe('DELETE');
    const invalidadas = chaves(espiaInvalidar);
    expect(invalidadas).toEqual(expect.arrayContaining([[...CHAVES.lancamentosMes]]));
    expect(comInicio(invalidadas, CHAVES.resumoMes[0])).toBe(true);
    expect(invalidadas).not.toContainEqual([...CHAVES.lancamento(ID_GELADEIRA)]);
    expect(chaves(espiaRemover)).toContainEqual([...CHAVES.lancamento(ID_GELADEIRA)]);
  });

  it('registro_invalido (já excluído pelo outro) sobe e não invalida nem remove', async () => {
    fetchSimulado.mockImplementation(() => resposta(404, { code: 'registro_invalido', message: 'x' }));
    const { wrapper, espiaInvalidar, espiaRemover } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(async () => {
      await expect(result.current.excluir.mutateAsync(ID_GELADEIRA)).rejects.toEqual({
        tipo: 'regra',
        codigo: 'registro_invalido',
      });
    });

    expect(espiaInvalidar).not.toHaveBeenCalled();
    expect(espiaRemover).not.toHaveBeenCalled();
  });
});

describe('useComandosLancamento: alterarDataParcela (PATCH /api/parcelas/:id)', () => {
  const ARGUMENTOS = { lancamentoId: ID_GELADEIRA, parcelaId: ID_PARCELA_2, data: '2026-11-05' };

  it('manda só a data e invalida o detalhe, a lista, o resumo e as formas (gasto do cartão)', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));
    const { wrapper, espiaInvalidar, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(() => result.current.alterarDataParcela.mutateAsync(ARGUMENTOS));

    expect(chamada()[0]).toBe(`/api/parcelas/${ID_PARCELA_2}`);
    expect(chamada()[1]?.method).toBe('PATCH');
    expect(corpoEnviado()).toEqual({ data: '2026-11-05' });
    const invalidadas = chaves(espiaInvalidar);
    expect(invalidadas).toEqual(
      expect.arrayContaining([[...CHAVES.lancamento(ID_GELADEIRA)], [...CHAVES.lancamentosMes], [...CHAVES.formas]]),
    );
    expect(comInicio(invalidadas, CHAVES.resumoMes[0])).toBe(true);
  });

  it('sem permissão (quem não pagou, ou não é crédito) sobe e não invalida', async () => {
    fetchSimulado.mockImplementation(() => resposta(403, { code: 'sem_permissao', message: 'x' }));
    const { wrapper, espiaInvalidar } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(async () => {
      await expect(result.current.alterarDataParcela.mutateAsync(ARGUMENTOS)).rejects.toEqual({
        tipo: 'regra',
        codigo: 'sem_permissao',
      });
    });

    expect(espiaInvalidar).not.toHaveBeenCalled();
  });
});
