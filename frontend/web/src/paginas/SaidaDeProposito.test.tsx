import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  criarServidor,
  instalarApi,
  limparAparelho,
  montarApp,
  preAquecerPaginas,
  type Servidor,
} from '../../test/apoio/apiCadastros';

/**
 * Sair de propósito (G-39): "Sair deste aparelho" e "Sair de todos" levam a `/entrar` limpo. A guarda de `/app/*` reage
 * ao fim da sessão antes do `navigate` da tela e montaria `/entrar?volta=%2Fapp%2Fajustes`: o login seguinte cairia de
 * volta nos Ajustes. A saída escolhida não deixa `volta` para área privada; a sessão perdida sem querer (401) deixa.
 */

let servidor: Servidor;

beforeAll(preAquecerPaginas, 30_000);

beforeEach(async () => {
  servidor = criarServidor();
  instalarApi(servidor);
  await limparAparelho();
});
afterEach(() => vi.unstubAllGlobals());

describe('a volta depois de sair de propósito', () => {
  it('"Sair deste aparelho" leva a /entrar sem `volta` e deixa a tela de Entrar aberta', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    await usuario.click(await screen.findByRole('button', { name: /Sair deste aparelho/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(local()).toBe('/entrar');
  });

  it('"Sair de todos os aparelhos" também leva a /entrar sem `volta`', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    await usuario.click(await screen.findByRole('button', { name: /Sair de todos os aparelhos/ }));
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sair de todos' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(local()).toBe('/entrar');
  });

  it('saindo de uma tela mais funda (Contas), a volta também não aponta para área privada', async () => {
    const usuario = userEvent.setup();
    const { local, roteador } = montarApp('/app/ajustes');
    await usuario.click(await screen.findByRole('button', { name: /Sair deste aparelho/ }));
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });

    expect(local()).not.toContain('volta');
    expect(roteador.state.location.search).toBe('');
  });

  it('entrar de novo depois de sair de propósito cai no início, não nos Ajustes', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');
    await usuario.click(await screen.findByRole('button', { name: /Sair deste aparelho/ }));
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });
    // O login simulado: `POST /api/sessao/entrar` devolve 204 e o servidor volta a reconhecer a sessão.
    const base = globalThis.fetch;
    vi.stubGlobal('fetch', (entrada: RequestInfo | URL, init?: RequestInit) => {
      if (String(entrada) !== '/api/sessao/entrar') return base(entrada, init);
      servidor.logado = true;
      return Promise.resolve(new Response(null, { status: 204 }));
    });

    await usuario.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await usuario.type(screen.getByLabelText('Senha'), 'senha-correta-123');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(local()).toBe('/app'));
  });

  it('sessão perdida sem querer (401 no meio do uso) continua levando a /entrar?volta= com a tela de origem', async () => {
    const { local, cliente } = montarApp('/app/ajustes');
    await screen.findByText('Ana · ana@exemplo.com');

    servidor.logado = false;
    await act(async () => {
      await cliente.invalidateQueries({ queryKey: ['sessao'] });
    });

    await waitFor(() => expect(local()).toBe('/entrar?volta=%2Fapp%2Fajustes'));
  });

  it('uma saída que falhou (sem rede, sair de todos) não deixa marca: o 401 seguinte mantém a `volta`', async () => {
    const usuario = userEvent.setup();
    const { local, cliente } = montarApp('/app/ajustes');
    await screen.findByText('Ana · ana@exemplo.com');
    servidor.semRede = true;
    await usuario.click(screen.getByRole('button', { name: /Sair de todos os aparelhos/ }));
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sair de todos' }));
    await screen.findByText('Sem conexão. Tente de novo');
    servidor.semRede = false;
    expect(local()).toBe('/app/ajustes');

    servidor.logado = false;
    await act(async () => {
      await cliente.invalidateQueries({ queryKey: ['sessao'] });
    });

    await waitFor(() => expect(local()).toBe('/entrar?volta=%2Fapp%2Fajustes'));
  });
});
