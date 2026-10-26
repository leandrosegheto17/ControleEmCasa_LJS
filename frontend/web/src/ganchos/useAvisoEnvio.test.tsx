import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAvisoEnvio } from './useAvisoEnvio';

type Ouvinte = (evento: Record<string, unknown>) => void;

const { fila, ouvintes, cancelar } = vi.hoisted(() => {
  const ouvintes: Ouvinte[] = [];
  const cancelar = vi.fn();
  return {
    ouvintes,
    cancelar,
    fila: {
      assinar: vi.fn((cb: Ouvinte) => {
        ouvintes.push(cb);
        return cancelar;
      }),
      listar: vi.fn(async () => []),
    },
  };
});

vi.mock('../dados/fila/fila', () => ({ fila }));

const RESPOSTA_CREDITO = JSON.parse(
  readFileSync(new URL('../../test/fixtures/respostas/lancar-despesa-credito.json', import.meta.url), 'utf8'),
);

const ITEM = { id: '00000000-0000-4000-8000-0000000009a1', situacao: 'aguardando' };

function emitir(evento: Record<string, unknown>) {
  act(() => ouvintes.forEach((cb) => cb(evento)));
}

beforeEach(() => {
  ouvintes.length = 0;
  vi.clearAllMocks();
});

describe('useAvisoEnvio', () => {
  it('assina a fila uma vez ao montar', () => {
    renderHook(() => useAvisoEnvio(vi.fn()));
    expect(fila.assinar).toHaveBeenCalledTimes(1);
  });

  it('no evento "enviado", entrega a resposta do servidor (com a data da 1ª parcela)', () => {
    const aoEnviado = vi.fn();
    renderHook(() => useAvisoEnvio(aoEnviado));
    emitir({ tipo: 'enviado', item: ITEM, resposta: RESPOSTA_CREDITO });
    expect(aoEnviado).toHaveBeenCalledTimes(1);
    expect(aoEnviado.mock.calls[0][0]).toMatchObject({ primeira_parcela_data: '2026-11-10', num_parcelas: 3 });
  });

  it('outros eventos da fila não avisam', () => {
    const aoEnviado = vi.fn();
    renderHook(() => useAvisoEnvio(aoEnviado));
    emitir({ tipo: 'mudanca' });
    expect(aoEnviado).not.toHaveBeenCalled();
  });

  it('item que a T03 está aguardando não gera aviso duplicado', () => {
    const aoEnviado = vi.fn();
    const ignorar = vi.fn((item: { id: string }) => item.id === ITEM.id);
    renderHook(() => useAvisoEnvio(aoEnviado, { ignorar }));
    emitir({ tipo: 'enviado', item: ITEM, resposta: RESPOSTA_CREDITO });
    expect(ignorar).toHaveBeenCalled();
    expect(aoEnviado).not.toHaveBeenCalled();

    emitir({ tipo: 'enviado', item: { ...ITEM, id: 'outro' }, resposta: RESPOSTA_CREDITO });
    expect(aoEnviado).toHaveBeenCalledTimes(1);
  });

  it('ao desmontar, cancela a assinatura', () => {
    const { unmount } = renderHook(() => useAvisoEnvio(vi.fn()));
    unmount();
    expect(cancelar).toHaveBeenCalledTimes(1);
  });
});
