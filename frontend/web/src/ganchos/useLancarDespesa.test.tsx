import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';

type Fila = typeof import('../dados/fila/fila').fila;
type Gancho = typeof import('./useLancarDespesa').useLancarDespesa;

let fila: Fila;
let useLancarDespesa: Gancho;

const { lancarDespesa, sessao } = vi.hoisted(() => ({
  lancarDespesa: vi.fn(),
  sessao: { dono: '00000000-0000-4000-8000-0000000000a1' as string | null },
}));

vi.mock('../dados/comandos/lancarDespesa', () => ({ lancarDespesa }));
vi.mock('../dados/sessao', () => ({
  obterSessao: vi.fn(async () => (sessao.dono ? { usuario: { id: sessao.dono } } : null)),
  donoLembrado: vi.fn(() => sessao.dono ?? undefined),
}));

const credito = lerResposta('lancar-despesa-credito.json');

const ENTRADA = {
  valorCentavos: 4590,
  categoriaId: '00000000-0000-4000-8000-000000000401',
  formaId: '00000000-0000-4000-8000-000000000301',
  parcelas: 1,
  data: '2026-10-09',
  descricao: '',
  exibicao: { categoria_nome: 'Mercado', forma_nome: 'Pix Nubank' },
};

function envoltorio() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
}

function montar() {
  return renderHook(() => useLancarDespesa(), { wrapper: envoltorio() });
}

function respondeEm(ms: number, valor: unknown) {
  return () => new Promise((resolver) => setTimeout(() => resolver(valor), ms));
}

async function esperarItens(n: number) {
  for (let i = 0; i < 50; i++) {
    if ((await fila.listar()).length === n) return;
    await act(() => vi.advanceTimersByTimeAsync(10));
  }
  throw new Error(`a fila não chegou a ${n} item(ns)`);
}

beforeEach(async () => {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  fila = (await import('../dados/fila/fila')).fila;
  useLancarDespesa = (await import('./useLancarDespesa')).useLancarDespesa;
  lancarDespesa.mockReset();
  sessao.dono = '00000000-0000-4000-8000-0000000000a1';
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00Z'));
});

afterEach(async () => {
  // Deixa terminar o que o teste largou em andamento: senão a chamada cai no mock do teste seguinte.
  for (let i = 0; i < 30; i++) await act(() => vi.advanceTimersByTimeAsync(100));
  vi.useRealTimers();
});

describe('useLancarDespesa', () => {
  it('resposta em 1 s → sucesso com a resposta do servidor e fila vazia', async () => {
    lancarDespesa.mockImplementation(respondeEm(1000, credito));
    const { result } = montar();

    let promessa!: Promise<unknown>;
    act(() => {
      promessa = result.current.lancar(ENTRADA);
    });
    await esperarItens(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await expect(promessa).resolves.toMatchObject({ tipo: 'sucesso', resposta: credito });
    expect(await fila.listar()).toHaveLength(0);
  });

  it('sem resposta em 3 s → guardado, e o item continua na fila', async () => {
    lancarDespesa.mockImplementation(() => new Promise(() => {}));
    const { result } = montar();

    let promessa!: Promise<unknown>;
    act(() => {
      promessa = result.current.lancar(ENTRADA);
    });
    await act(() => vi.advanceTimersByTimeAsync(2999));
    const antes = vi.fn();
    void promessa.then(antes);
    await act(() => Promise.resolve());
    expect(antes).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));

    await expect(promessa).resolves.toMatchObject({ tipo: 'guardado' });
    const itens = await fila.listar();
    expect(itens).toHaveLength(1);
    expect(itens[0].situacao).toBe('aguardando');
  });

  it('erro de rede → guardado, item intacto', async () => {
    lancarDespesa.mockRejectedValue({ tipo: 'rede' });
    const { result } = montar();

    let promessa!: Promise<unknown>;
    act(() => {
      promessa = result.current.lancar(ENTRADA);
    });
    await act(() => vi.advanceTimersByTimeAsync(0));

    await expect(promessa).resolves.toMatchObject({ tipo: 'guardado' });
    const itens = await fila.listar();
    expect(itens).toHaveLength(1);
    expect(itens[0].situacao).toBe('aguardando');
  });

  it('servidor indisponível → guardado', async () => {
    lancarDespesa.mockRejectedValue({ tipo: 'indisponivel' });
    const { result } = montar();

    let promessa!: Promise<unknown>;
    act(() => {
      promessa = result.current.lancar(ENTRADA);
    });
    await act(() => vi.advanceTimersByTimeAsync(0));

    await expect(promessa).resolves.toMatchObject({ tipo: 'guardado' });
  });

  it('registro_invalido → regra com o código', async () => {
    lancarDespesa.mockRejectedValue({ tipo: 'regra', codigo: 'registro_invalido' });
    const { result } = montar();

    let promessa!: Promise<unknown>;
    act(() => {
      promessa = result.current.lancar(ENTRADA);
    });
    await act(() => vi.advanceTimersByTimeAsync(0));

    await expect(promessa).resolves.toMatchObject({ tipo: 'regra', codigo: 'registro_invalido' });
  });

  it('grava a chamada completa antes de enviar, com o dono da sessão e a data', async () => {
    lancarDespesa.mockImplementation(() => new Promise(() => {}));
    const { result } = montar();

    act(() => {
      void result.current.lancar(ENTRADA);
    });

    await esperarItens(1);
    const [item] = await fila.listar();
    expect(item.dono).toBe('00000000-0000-4000-8000-0000000000a1');
    expect(item.args).toMatchObject({
      valor_centavos: 4590,
      categoria_id: '00000000-0000-4000-8000-000000000401',
      forma_id: '00000000-0000-4000-8000-000000000301',
      parcelas: 1,
      data: '2026-10-09',
    });
    expect(item.args.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.exibicao).toEqual({ categoria_nome: 'Mercado', forma_nome: 'Pix Nubank' });
  });

  it('o tempo de 3 s não cria um segundo item nem um segundo envio', async () => {
    lancarDespesa.mockImplementation(() => new Promise(() => {}));
    const { result } = montar();

    act(() => {
      void result.current.lancar(ENTRADA);
    });
    await esperarItens(1);
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(await fila.listar()).toHaveLength(1);
    expect(lancarDespesa).toHaveBeenCalledTimes(1);
  });

  it('duplo envio durante a espera é ignorado', async () => {
    lancarDespesa.mockImplementation(() => new Promise(() => {}));
    const { result } = montar();

    act(() => {
      void result.current.lancar(ENTRADA);
      void result.current.lancar(ENTRADA);
    });
    await esperarItens(1);
    act(() => {
      void result.current.lancar(ENTRADA);
    });
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(await fila.listar()).toHaveLength(1);
    expect(lancarDespesa).toHaveBeenCalledTimes(1);
  });

  it('o mesmo id é usado no reenvio do item guardado', async () => {
    lancarDespesa.mockRejectedValueOnce({ tipo: 'rede' }).mockResolvedValueOnce({ ...credito, ja_existia: true });
    const { result } = montar();

    let promessa!: Promise<unknown>;
    act(() => {
      promessa = result.current.lancar(ENTRADA);
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    await promessa;
    const [guardado] = await fila.listar();

    await fila.esvaziar();

    const ids = lancarDespesa.mock.calls.map(([args]) => (args as { id: string }).id);
    expect(ids).toEqual([guardado.args.id, guardado.args.id]);
    expect(await fila.listar()).toHaveLength(0);
  });
});
