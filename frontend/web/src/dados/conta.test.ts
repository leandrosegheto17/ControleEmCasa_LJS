import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { PRAZO_PURGA_DIAS as PRAZO_DO_CONTRATO } from '@controle/contrato';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRAZO_PURGA_DIAS } from '../comum/conta';
import { confirmarExclusao, pedirExclusao } from './conta';
import { fila } from './fila/fila';
import { gravarItem, lerTodos, removerItem } from './fila/armazem';
import { A, B, EXIBICAO, argsDeDespesa } from './fila/apoioTeste';
import { donoLembrado, obterSessao } from './sessao';

/**
 * Exclusão de conta no front (RN-26; CA-26.1, CA-26.2). Pedir leva só a senha, no corpo do POST; confirmar leva só o
 * token e deixa o aparelho limpo: fila do usuário, dono lembrado e convite em espera.
 */

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

let chamadas: Array<{ metodo: string; url: string; corpo: unknown; cabecalhos: Record<string, string> }>;
let respostas: Map<string, Response>;

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  // O armazém abre o banco uma vez só: esvazia-o em vez de confiar na fábrica nova.
  for (const item of await lerTodos()) await removerItem(item.id);
  chamadas = [];
  respostas = new Map();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entrada);
      const metodo = init?.method ?? 'GET';
      chamadas.push({
        metodo,
        url,
        corpo: init?.body ? JSON.parse(String(init.body)) : undefined,
        cabecalhos: (init?.headers ?? {}) as Record<string, string>,
      });
      if (url === '/api/sessao') {
        return json({
          usuario: { id: A, nome: 'Ana', email: 'ana@exemplo.com' },
          membro: null,
          lar: null,
          plano: null,
          termos_pendentes: false,
        });
      }
      return respostas.get(`${metodo} ${url}`) ?? new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('o prazo espelha o contrato', () => {
  it('PRAZO_PURGA_DIAS do front é o do contrato', () => expect(PRAZO_PURGA_DIAS).toBe(PRAZO_DO_CONTRATO));
});

describe('pedirExclusao (CA-26.1)', () => {
  it('envia a senha só no corpo do POST, com o cabeçalho de escrita', async () => {
    respostas.set('POST /api/conta/exclusao', new Response(null, { status: 202 }));

    await pedirExclusao('minha-senha-longa-123');

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toMatchObject({
      metodo: 'POST',
      url: '/api/conta/exclusao',
      corpo: { senha: 'minha-senha-longa-123' },
    });
    expect(chamadas[0]!.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    expect(chamadas[0]!.url).not.toContain('minha-senha');
    expect(JSON.stringify([{ ...localStorage }, { ...sessionStorage }])).not.toContain('minha-senha');
  });

  it('senha errada vira erro de regra, sem mexer no aparelho', async () => {
    respostas.set('POST /api/conta/exclusao', json({ code: 'credenciais_invalidas', message: 'x' }, 400));

    await expect(pedirExclusao('errada')).rejects.toEqual({ tipo: 'regra', codigo: 'credenciais_invalidas' });
  });
});

describe('confirmarExclusao (CA-26.2)', () => {
  it('envia só o token e limpa o aparelho: fila do dono, dono lembrado e convite em espera', async () => {
    await obterSessao();
    expect(donoLembrado()).toBe(A);
    const meu = await fila.enfileirar(argsDeDespesa('meu'), EXIBICAO);
    await gravarItem({ ...meu, id: '00000000-0000-4000-8000-0000000000d2', dono: B });
    window.sessionStorage.setItem('controle.convite-em-espera', 'token-de-convite');

    await confirmarExclusao('token-do-link');

    const confirmacao = chamadas.find((c) => c.url === '/api/conta/exclusao/confirmar');
    expect(confirmacao).toMatchObject({ metodo: 'POST', corpo: { token: 'token-do-link' } });
    expect((await lerTodos()).map((i) => i.dono)).toEqual([B]);
    expect(donoLembrado()).toBeUndefined();
    expect(window.sessionStorage.getItem('controle.convite-em-espera')).toBeNull();
  });

  it('link vencido: lança link_expirado e não apaga nada do aparelho', async () => {
    await obterSessao();
    await fila.enfileirar(argsDeDespesa('meu'), EXIBICAO);
    respostas.set('POST /api/conta/exclusao/confirmar', json({ code: 'link_expirado', message: 'x' }, 400));

    await expect(confirmarExclusao('vencido')).rejects.toEqual({ tipo: 'regra', codigo: 'link_expirado' });

    expect(await lerTodos()).toHaveLength(1);
    expect(donoLembrado()).toBe(A);
  });
});
