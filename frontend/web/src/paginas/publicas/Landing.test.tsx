import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarServidor, instalarApi, limparAparelho, preAquecerPaginas } from '../../../test/apoio/apiCadastros';
import { rotas } from '../../rotas';

/**
 * Landing em `/` (etapa 14; PRD §3 e §5.3): proposta de valor, como funciona, planos (Free e Pro R$ 9,90/mês, 14 dias de
 * Pro sem cartão), "Começar grátis" para o cadastro e links para Entrar, Termos e Privacidade. Pública: quem já entrou
 * não é redirecionado, ganha "Abrir o app".
 */

beforeAll(async () => {
  await preAquecerPaginas();
  await import('./Landing');
}, 30_000);
beforeEach(async () => {
  await limparAparelho();
});
afterEach(() => vi.unstubAllGlobals());

function montar(logado: boolean) {
  instalarApi(criarServidor({ logado }));
  const consulta = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const roteador = createMemoryRouter(rotas, { initialEntries: ['/'] });
  const tela = render(
    <QueryClientProvider client={consulta}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>,
  );
  return { roteador, ...tela };
}

describe('visitante', () => {
  it('mostra a proposta de valor como título da página', async () => {
    montar(false);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Saiba quanto a casa gasta de verdade, sem expor o que é só seu.',
      }),
    ).toBeInTheDocument();
  });

  it('tem os marcos da página: cabeçalho, conteúdo principal e rodapé', async () => {
    montar(false);
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Acesso' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Rodapé' })).toBeInTheDocument();
  });

  it('"Começar grátis" leva ao cadastro; "Entrar" ao acesso', async () => {
    montar(false);
    await screen.findByRole('heading', { level: 1 });

    const comecar = screen.getAllByRole('link', { name: 'Começar grátis' });
    expect(comecar.length).toBeGreaterThanOrEqual(2);
    for (const link of comecar) expect(link).toHaveAttribute('href', '/cadastro');
    const menu = within(screen.getByRole('navigation', { name: 'Acesso' }));
    expect(menu.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
    expect(screen.queryByRole('link', { name: 'Abrir o app' })).not.toBeInTheDocument();
  });

  it('o rodapé liga aos Termos e à Privacidade', async () => {
    montar(false);
    await screen.findByRole('heading', { level: 1 });

    const rodape = within(screen.getByRole('navigation', { name: 'Rodapé' }));
    expect(rodape.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos');
    expect(rodape.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade');
  });

  it('explica como funciona em três passos', async () => {
    montar(false);
    const secao = await screen.findByRole('region', { name: 'Como funciona' });

    expect(within(secao).getAllByRole('listitem')).toHaveLength(3);
    expect(within(secao).getByRole('heading', { level: 3, name: 'Lance os gastos' })).toBeInTheDocument();
  });

  it('mostra os planos: Free grátis e Pro R$ 9,90 por mês, com 14 dias de teste sem cartão', async () => {
    montar(false);
    const planos = await screen.findByRole('region', { name: 'Planos' });

    const free = within(within(planos).getByRole('article', { name: 'Free' }));
    expect(free.getByText(/R\$ 0/)).toBeInTheDocument();
    const pro = within(within(planos).getByRole('article', { name: 'Pro' }));
    expect(pro.getByText(/R\$ 9,90/)).toBeInTheDocument();
    expect(pro.getByText(/por mês, no Pix/)).toBeInTheDocument();
    expect(pro.getByText(/14 dias de teste, sem cartão/)).toBeInTheDocument();
  });

  it('de "Começar grátis" se chega ao cadastro (navegável até o fim)', async () => {
    const usuario = userEvent.setup();
    const { roteador } = montar(false);
    await screen.findByRole('heading', { level: 1 });

    await usuario.click(screen.getAllByRole('link', { name: 'Começar grátis' })[0]!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Criar conta' })).toBeInTheDocument();
    expect(roteador.state.location.pathname).toBe('/cadastro');
  });

  it('o título do documento e a descrição são os da landing; o canônico aponta para a raiz', async () => {
    const { unmount } = montar(false);
    await screen.findByRole('heading', { level: 1 });

    // O título e o `<head>` são aplicados em efeitos que podem rodar um instante depois do primeiro render.
    await waitFor(() => {
      expect(document.title).toBe('As finanças da casa, em dois · Controle em Casa');
      expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
        '14 dias de Pro sem cartão',
      );
      expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
        `${window.location.origin}/`,
      );
    });

    unmount();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

describe('quem já entrou', () => {
  it('não é redirecionado: continua em "/" e vê "Abrir o app" no lugar de "Começar grátis"', async () => {
    const { roteador } = montar(true);

    const abrir = await screen.findAllByRole('link', { name: 'Abrir o app' });
    for (const link of abrir) expect(link).toHaveAttribute('href', '/app');
    expect(roteador.state.location.pathname).toBe('/');
    expect(screen.queryByRole('link', { name: 'Começar grátis' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});
