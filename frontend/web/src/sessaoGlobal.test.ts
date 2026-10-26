import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registrarLimpeza } from './dados/aparelho';
import { chamar } from './dados/transporte';
import { ligarPerdaDeSessao } from './sessaoGlobal';

const fetchSimulado = vi.fn<typeof fetch>();
const limpeza = vi.fn();
let desligar: () => void;
let desregistrar: () => void;
let cliente: QueryClient;

function roteadorEm(pathname: string, search = '') {
  return { navigate: vi.fn(), state: { location: { pathname, search } } };
}

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
  limpeza.mockReset();
  desregistrar = registrarLimpeza(limpeza);
  cliente = new QueryClient();
});

afterEach(() => {
  desligar?.();
  desregistrar();
  vi.unstubAllGlobals();
});

const sessaoRevogada = () =>
  new Response(JSON.stringify({ code: 'sessao_expirada', message: 'x' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

describe('401 global (SDD 9.2, G-39)', () => {
  it('limpa o cache, limpa o aparelho e leva a /entrar?volta= com a tela de origem', async () => {
    cliente.setQueryData(['lancamentos'], [{ id: 1 }]);
    const roteador = roteadorEm('/app/lancamentos', '?mes=2026-10-01');
    desligar = ligarPerdaDeSessao(cliente, roteador);
    fetchSimulado.mockResolvedValue(sessaoRevogada());

    await expect(chamar('GET', '/api/lancamentos')).rejects.toEqual({ tipo: 'autenticacao' });

    expect(cliente.getQueryData(['lancamentos'])).toBeUndefined();
    expect(cliente.getQueryData(['sessao'])).toBeNull();
    await vi.waitFor(() => expect(limpeza).toHaveBeenCalledTimes(1));
    expect(roteador.navigate).toHaveBeenCalledWith('/entrar?volta=%2Fapp%2Flancamentos%3Fmes%3D2026-10-01', {
      replace: true,
    });
  });

  it('fora do app (ex.: na tela de entrada) limpa mas não navega', async () => {
    const roteador = roteadorEm('/entrar');
    desligar = ligarPerdaDeSessao(cliente, roteador);
    fetchSimulado.mockResolvedValue(sessaoRevogada());

    await expect(chamar('POST', '/api/lar')).rejects.toBeDefined();

    expect(roteador.navigate).not.toHaveBeenCalled();
  });

  it('vários 401 seguidos tratam a perda uma vez só', async () => {
    const roteador = roteadorEm('/app');
    desligar = ligarPerdaDeSessao(cliente, roteador);
    fetchSimulado.mockImplementation(async () => sessaoRevogada());

    await Promise.allSettled([chamar('GET', '/api/a'), chamar('GET', '/api/b'), chamar('GET', '/api/c')]);

    expect(roteador.navigate).toHaveBeenCalledTimes(1);
  });

  it('desligar o ouvinte deixa o 401 passar sem efeito', async () => {
    const roteador = roteadorEm('/app');
    desligar = ligarPerdaDeSessao(cliente, roteador);
    desligar();
    fetchSimulado.mockResolvedValue(sessaoRevogada());

    await expect(chamar('GET', '/api/a')).rejects.toEqual({ tipo: 'autenticacao' });

    expect(roteador.navigate).not.toHaveBeenCalled();
  });
});
