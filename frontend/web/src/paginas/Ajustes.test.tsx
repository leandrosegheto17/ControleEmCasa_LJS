import { screen, waitFor, within } from '@testing-library/react';
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

/** Ajustes (SDD 9.3, `/app/ajustes`): atalhos dos cadastros, dados da pessoa e saída da sessão. */

let servidor: Servidor;

beforeAll(preAquecerPaginas, 30_000);

beforeEach(async () => {
  servidor = criarServidor();
  instalarApi(servidor);
  await limparAparelho();
});
afterEach(() => vi.unstubAllGlobals());

describe('Ajustes', () => {
  it('mostra nome e e-mail da pessoa logada e a versão do app', async () => {
    montarApp('/app/ajustes');

    expect(await screen.findByText('Ana · ana@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText('Versão')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
  });

  it('lista os cadastros com links para as telas sob /app/ajustes', async () => {
    montarApp('/app/ajustes');

    const main = (await screen.findByRole('heading', { level: 1, name: 'Ajustes' })).closest('div')!.parentElement!;
    const links = within(main).getAllByRole('link');
    const destino = (nome: string) => links.find((l) => l.textContent?.includes(nome))?.getAttribute('href');
    expect(destino('Contas')).toBe('/app/ajustes/contas');
    expect(destino('Formas de pagamento')).toBe('/app/ajustes/formas');
    expect(destino('Categorias')).toBe('/app/ajustes/categorias');
    expect(destino('Despesas fixas')).toBe('/app/fixas');
  });

  it('o título volta para o Início do app', async () => {
    montarApp('/app/ajustes');

    expect(await screen.findByRole('link', { name: 'Voltar para Início' })).toHaveAttribute('href', '/app');
  });

  it('navegar de Ajustes para Contas abre a lista', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    const main = (await screen.findByRole('heading', { level: 1, name: 'Ajustes' })).closest('div')!.parentElement!;
    await usuario.click(within(main).getByRole('link', { name: /^Contas/ }));

    expect(await screen.findByText('Nubank')).toBeInTheDocument();
    expect(local()).toBe('/app/ajustes/contas');
  });

  it('"Sair deste aparelho" encerra a sessão e leva a Entrar', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    await usuario.click(await screen.findByRole('button', { name: /Sair deste aparelho/ }));

    // A guarda também pode levar a Entrar com `?volta=`; o que importa é sair da área autenticada.
    await waitFor(() => expect(local()).toContain('/entrar'));
    expect(servidor.chamadas.some((c) => c.url === '/api/sessao/sair')).toBe(true);
  });

  it('"Sair de todos os aparelhos" pede confirmação; cancelar não encerra nada', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    await usuario.click(await screen.findByRole('button', { name: /Sair de todos os aparelhos/ }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText('Sair de todos os aparelhos?')).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    expect(servidor.chamadas.some((c) => c.url === '/api/sessao/sair-de-todos')).toBe(false);
    expect(local()).toBe('/app/ajustes');
  });

  it('confirmando "Sair de todos", chama a rota global e leva a Entrar', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    await usuario.click(await screen.findByRole('button', { name: /Sair de todos os aparelhos/ }));
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Sair de todos' }));

    await waitFor(() => expect(local()).toContain('/entrar'));
    expect(servidor.chamadas.some((c) => c.url === '/api/sessao/sair-de-todos')).toBe(true);
  });

  it('sem sessão, o endereço de Ajustes vai a Entrar guardando a volta', async () => {
    servidor.logado = false;
    const { local } = montarApp('/app/ajustes/contas');

    await waitFor(() => expect(local()).toBe('/entrar?volta=%2Fapp%2Fajustes%2Fcontas'));
  });
});
