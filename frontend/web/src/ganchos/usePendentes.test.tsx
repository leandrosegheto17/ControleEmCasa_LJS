import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';

const { lancarDespesa, sessao } = vi.hoisted(() => ({
  lancarDespesa: vi.fn(),
  sessao: { dono: '00000000-0000-4000-8000-0000000000a1' as string | null },
}));

vi.mock('../dados/comandos/lancarDespesa', () => ({ lancarDespesa }));
vi.mock('../dados/sessao', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../dados/sessao')>()),
  obterSessao: vi.fn(async () => (sessao.dono ? { usuario: { id: sessao.dono } } : null)),
  donoLembrado: vi.fn(() => sessao.dono ?? undefined),
}));

const B = '00000000-0000-4000-8000-0000000000b1';
const EXIBICAO = { categoria_nome: 'Mercado', forma_nome: 'Pix Nubank' };
const ARGS = {
  valor_centavos: 4590,
  categoria_id: '00000000-0000-4000-8000-000000000401',
  forma_id: '00000000-0000-4000-8000-000000000301',
  parcelas: 1,
  data: '2026-10-09',
  descricao: 'Feira',
};

async function carregar() {
  vi.resetModules();
  const { fila } = await import('../dados/fila/fila');
  const { usePendentes } = await import('./usePendentes');
  return { fila, usePendentes };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  lancarDespesa.mockReset();
  sessao.dono = '00000000-0000-4000-8000-0000000000a1';
});

describe('usePendentes', () => {
  it('começa em zero com a fila vazia', async () => {
    const { usePendentes } = await carregar();
    const { result } = renderHook(() => usePendentes());
    await waitFor(() => expect(result.current).toMatchObject({ total: 0, aguardando: 0, falhas: 0 }));
  });

  it('enfileirar soma; falha conta em falhas; envio zera', async () => {
    const { fila, usePendentes } = await carregar();
    const { result } = renderHook(() => usePendentes());

    await act(() => fila.enfileirar(ARGS, EXIBICAO));
    await waitFor(() => expect(result.current).toMatchObject({ total: 1, aguardando: 1, falhas: 0 }));

    lancarDespesa.mockRejectedValueOnce({ tipo: 'regra', codigo: 'categoria_arquivada' });
    await act(() => fila.esvaziar());
    await waitFor(() => expect(result.current).toMatchObject({ total: 1, aguardando: 0, falhas: 1 }));

    await act(async () => {
      const [item] = await fila.listar();
      await fila.descartar(item.id, { confirmado: true });
    });
    await act(() => fila.enfileirar(ARGS, EXIBICAO));
    lancarDespesa.mockResolvedValue(lerResposta('lancar-despesa-credito.json'));
    await act(() => fila.esvaziar());

    await waitFor(() => expect(result.current).toMatchObject({ total: 0, aguardando: 0, falhas: 0 }));
  });

  it('não conta itens de outro membro', async () => {
    const { fila, usePendentes } = await carregar();
    await fila.enfileirar(ARGS, EXIBICAO);

    sessao.dono = B;
    const { result } = renderHook(() => usePendentes());

    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.total).toBe(0);
  });
});
