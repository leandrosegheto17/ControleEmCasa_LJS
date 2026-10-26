import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarServidor, instalarApi, montarApp, preAquecerPaginas, type Servidor } from '../test/apoio/apiCadastros';
import { encerrarNoAparelho } from './dados/sessao';

/** Rotas de `/app/ajustes/*` (SDD 9.3): chegam antes do coringa `/app/*`, têm título e moldura do app. */

let servidor: Servidor;

beforeAll(preAquecerPaginas, 30_000);

beforeEach(async () => {
  servidor = criarServidor();
  instalarApi(servidor);
  await encerrarNoAparelho();
});
afterEach(() => vi.unstubAllGlobals());

describe('rotas de Ajustes e cadastros', () => {
  it.each([
    ['/app/ajustes', 'Ajustes · Controle em Casa'],
    ['/app/ajustes/contas', 'Contas · Controle em Casa'],
    ['/app/ajustes/contas/nova', 'Nova conta · Controle em Casa'],
    ['/app/ajustes/formas', 'Formas de pagamento · Controle em Casa'],
    ['/app/ajustes/formas/nova', 'Nova forma · Controle em Casa'],
    ['/app/ajustes/categorias', 'Categorias · Controle em Casa'],
    ['/app/ajustes/categorias/nova', 'Nova categoria · Controle em Casa'],
  ])('%s abre a tela e põe o título "%s"', async (caminho, titulo) => {
    montarApp(caminho);

    await waitFor(() => expect(document.title).toBe(titulo));
    expect(screen.queryByText('Página não encontrada')).not.toBeInTheDocument();
  });

  it('o que não existe sob /app/ajustes cai em "não encontrada"', async () => {
    montarApp('/app/ajustes/inexistente');

    expect(await screen.findByRole('heading', { name: /não encontrada/i })).toBeInTheDocument();
  });

  it('as telas levam a moldura do app: trilho com Ajustes ativo e barra inferior', async () => {
    montarApp('/app/ajustes/contas');

    await screen.findByText('Nubank');
    const navegacoes = screen.getAllByRole('navigation', { name: 'Navegação principal' });
    expect(navegacoes).toHaveLength(2);
    const trilho = navegacoes[0]!;
    const ativo = within(trilho)
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page');
    expect(ativo.map((l) => l.textContent?.trim())).toEqual(['Ajustes']);
  });

  it('do Início se chega a Ajustes pelo atalho', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app');

    const atalho = (await screen.findAllByRole('link', { name: 'Ajustes' })).find((l) => l.closest('header'));
    await usuario.click(atalho!);

    expect(await screen.findByText('Ana · ana@exemplo.com')).toBeInTheDocument();
    expect(local()).toBe('/app/ajustes');
  });
});
