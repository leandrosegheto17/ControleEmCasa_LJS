import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAVES } from './chavesConsulta';
import { useComandosFixas } from './useComandosFixas';
import { useComandosLancamento } from './useComandosLancamento';
import { useComandosOrcamento } from './useComandosOrcamento';

/**
 * Comandos de fixas e de orçamento (etapa 12, lote 3): só em sucesso invalidam o que mudou; nada vai para a fila e o
 * erro de rede sobe para a tela (sem pausa offline). Escrever fixa ou orçamento invalida o resumo e o orçamento.
 */

type Chave = readonly unknown[];

const ID_FIXA = '00000000-0000-4000-8000-000000000701';
const ID_OCORRENCIA = '00000000-0000-4000-8000-000000000801';
const ID_PAGAMENTO = '00000000-0000-4000-8000-000000000a01';
const ID_FORMA = '00000000-0000-4000-8000-000000000301';
const ID_CATEGORIA = '00000000-0000-4000-8000-000000000403';

const fetchSimulado = vi.fn<typeof fetch>();
const resposta = (status: number, corpo?: unknown) =>
  Promise.resolve(
    new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
const PAGO = {
  ocorrencia_id: ID_OCORRENCIA,
  lancamento_id: ID_PAGAMENTO,
  situacao: 'paga',
  valor_pago_centavos: 11990,
  vencimento: '2026-10-05',
  ja_existia: false,
};

function criarAmbiente() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const espia = vi.spyOn(cliente, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  const chaves = (): Chave[] =>
    espia.mock.calls.map(([filtro]) => (filtro as { queryKey?: Chave } | undefined)?.queryKey ?? []);
  return { wrapper, espia, chaves };
}
const invalidou = (chaves: Chave[], raiz: string) => chaves.some((c) => c[0] === raiz);

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => vi.unstubAllGlobals());

describe('useComandosFixas', () => {
  it('salvar invalida os modelos, as ocorrências, o resumo e o orçamento', async () => {
    fetchSimulado.mockImplementation(() => resposta(201, { id: ID_FIXA }));
    const { wrapper, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosFixas(), { wrapper });

    await act(() =>
      result.current.salvarDespesaFixa.mutateAsync({
        id: ID_FIXA,
        descricao: 'Aluguel',
        categoriaId: ID_CATEGORIA,
        valorPrevistoCentavos: 120000,
        diaVencimento: 10,
      }),
    );

    expect(chaves()).toEqual(
      expect.arrayContaining([
        [...CHAVES.despesasFixas],
        [...CHAVES.ocorrenciasMes],
        [...CHAVES.resumoMes],
        [...CHAVES.orcamentoMes],
      ]),
    );
  });

  it('encerrar invalida os mesmos itens', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));
    const { wrapper, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosFixas(), { wrapper });

    await act(() => result.current.encerrarDespesaFixa.mutateAsync(ID_FIXA));

    expect(fetchSimulado.mock.calls[0]![0]).toBe(`/api/fixas/${ID_FIXA}/encerrar`);
    expect(invalidou(chaves(), CHAVES.despesasFixas[0])).toBe(true);
    expect(invalidou(chaves(), CHAVES.ocorrenciasMes[0])).toBe(true);
    expect(invalidou(chaves(), CHAVES.resumoMes[0])).toBe(true);
    expect(invalidou(chaves(), CHAVES.orcamentoMes[0])).toBe(true);
  });

  it('pagar invalida ocorrências, resumo, orçamento, lançamentos, contas e formas (o pagamento é um lançamento)', async () => {
    fetchSimulado.mockImplementation(() => resposta(201, PAGO));
    const { wrapper, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosFixas(), { wrapper });

    await act(() =>
      result.current.pagarOcorrencia.mutateAsync({ ocorrenciaId: ID_OCORRENCIA, id: ID_PAGAMENTO, formaId: ID_FORMA }),
    );

    for (const chave of [
      CHAVES.ocorrenciasMes,
      CHAVES.resumoMes,
      CHAVES.orcamentoMes,
      CHAVES.lancamentosMes,
      CHAVES.contas,
      CHAVES.formas,
    ]) {
      expect(chaves()).toContainEqual([...chave]);
    }
  });

  it('desfazer pagamento invalida o mesmo conjunto do pagamento', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));
    const { wrapper, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosFixas(), { wrapper });

    await act(() => result.current.desfazerPagamento.mutateAsync(ID_OCORRENCIA));

    expect(fetchSimulado.mock.calls[0]![1]?.method).toBe('DELETE');
    for (const chave of [CHAVES.ocorrenciasMes, CHAVES.resumoMes, CHAVES.orcamentoMes, CHAVES.lancamentosMes]) {
      expect(chaves()).toContainEqual([...chave]);
    }
  });

  it('erro de regra (ocorrencia_paga) sobe e nada é invalidado', async () => {
    fetchSimulado.mockImplementation(() => resposta(409, { code: 'ocorrencia_paga', message: 'x' }));
    const { wrapper, espia } = criarAmbiente();
    const { result } = renderHook(() => useComandosFixas(), { wrapper });

    await act(async () => {
      await expect(
        result.current.pagarOcorrencia.mutateAsync({
          ocorrenciaId: ID_OCORRENCIA,
          id: ID_PAGAMENTO,
          formaId: ID_FORMA,
        }),
      ).rejects.toEqual({ tipo: 'regra', codigo: 'ocorrencia_paga' });
    });

    expect(espia).not.toHaveBeenCalled();
  });

  it('sem rede: o erro "rede" sobe na hora (sem pausa offline) e nada é invalidado', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    const { wrapper, espia } = criarAmbiente();
    const { result } = renderHook(() => useComandosFixas(), { wrapper });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await act(async () => {
      await expect(result.current.encerrarDespesaFixa.mutateAsync(ID_FIXA)).rejects.toEqual({ tipo: 'rede' });
    });

    expect(espia).not.toHaveBeenCalled();
  });
});

describe('useComandosOrcamento', () => {
  it('definir invalida o orçamento (os dois escopos) e o resumo', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));
    const { wrapper, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosOrcamento(), { wrapper });

    await act(() =>
      result.current.definirOrcamento.mutateAsync({ mes: '2026-10', categoriaId: ID_CATEGORIA, valorCentavos: 40000 }),
    );

    expect(chaves()).toEqual(expect.arrayContaining([[...CHAVES.orcamentoMes], [...CHAVES.resumoMes]]));
    // A raiz do orçamento cobre os dois escopos: `pode_copiar_anterior` cruza escopos.
    expect(CHAVES.orcamentoDoMes('2026-10', 'conjunto').slice(0, 1)).toEqual([...CHAVES.orcamentoMes]);
    expect(CHAVES.orcamentoDoMes('2026-10', 'individual').slice(0, 1)).toEqual([...CHAVES.orcamentoMes]);
  });

  it('copiar devolve a quantidade copiada e invalida o orçamento e o resumo', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, { copiadas: 5 }));
    const { wrapper, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosOrcamento(), { wrapper });

    let copiadas = 0;
    await act(async () => {
      copiadas = await result.current.copiarOrcamento.mutateAsync({ mes: '2026-11', escopo: 'conjunto' });
    });

    expect(copiadas).toBe(5);
    expect(invalidou(chaves(), CHAVES.orcamentoMes[0])).toBe(true);
    expect(invalidou(chaves(), CHAVES.resumoMes[0])).toBe(true);
  });

  it('erro de regra e erro de rede sobem e nada é invalidado', async () => {
    fetchSimulado.mockImplementationOnce(() => resposta(400, { code: 'valor_invalido', message: 'x' }));
    const { wrapper, espia } = criarAmbiente();
    const { result } = renderHook(() => useComandosOrcamento(), { wrapper });

    await act(async () => {
      await expect(
        result.current.definirOrcamento.mutateAsync({ mes: '2026-10', categoriaId: ID_CATEGORIA, valorCentavos: 0 }),
      ).rejects.toEqual({ tipo: 'regra', codigo: 'valor_invalido' });
    });
    fetchSimulado.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await act(async () => {
      await expect(result.current.copiarOrcamento.mutateAsync({ mes: '2026-11', escopo: 'conjunto' })).rejects.toEqual({
        tipo: 'rede',
      });
    });

    expect(espia).not.toHaveBeenCalled();
  });
});

describe('useComandosLancamento: o lançamento de pagamento de fixa (RN-15)', () => {
  it('excluir um lançamento invalida as ocorrências e o orçamento: a ocorrência volta a pendente e o realizado muda', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));
    const { wrapper, chaves } = criarAmbiente();
    const { result } = renderHook(() => useComandosLancamento(), { wrapper });

    await act(() => result.current.excluir.mutateAsync(ID_PAGAMENTO));

    expect(chaves()).toEqual(
      expect.arrayContaining([[...CHAVES.ocorrenciasMes], [...CHAVES.orcamentoMes], [...CHAVES.resumoMes]]),
    );
  });
});
