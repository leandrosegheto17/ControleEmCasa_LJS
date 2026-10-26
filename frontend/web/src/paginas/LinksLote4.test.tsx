import { configure, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  criarServidorMetas,
  ID_RESERVA,
  instalarApiMetas,
  preAquecerMetas,
  type ServidorMetas,
} from '../../test/apoio/apiMetas';
import { LINK_LAR, LINK_METAS, linkMetaEditar, linkMetaNova } from '../formatacao/linksApp';

/**
 * Acessos às telas do lote 4 (SDD 9.3): os links do Início para Fixas, Orçamento e Metas, que ficavam mortos até os
 * lotes 3 e 4, e os atalhos de Ajustes para Metas e para Casa e membros. Cada clique chega à tela certa, sem cair no
 * "Página não encontrada".
 */

let servidor: ServidorMetas;

configure({ asyncUtilTimeout: 5000 });

beforeAll(async () => {
  await preAquecerPaginas();
  await preAquecerMetas();
}, 60_000);

beforeEach(async () => {
  servidor = criarServidorMetas();
  instalarApiMetas(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('links de metas e do lar', () => {
  it('montam os caminhos de SDD 9.3', () => {
    expect(LINK_METAS).toBe('/app/metas');
    expect(linkMetaNova()).toBe('/app/metas/nova');
    expect(linkMetaNova('casa')).toBe('/app/metas/nova?escopo=casa');
    expect(linkMetaNova('eu')).toBe('/app/metas/nova?escopo=eu');
    expect(linkMetaEditar('m')).toBe('/app/metas/m/editar');
    expect(LINK_LAR).toBe('/app/ajustes/lar');
  });
});

describe('Início leva às telas', () => {
  it('uma meta da casa abre o detalhe da meta', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app?mes=2026-10');

    await usuario.click(await screen.findByRole('link', { name: /Reserva de emergência/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Reserva de emergência' })).toBeInTheDocument();
    expect(local()).toBe(`/app/metas/${ID_RESERVA}`);
  });

  it('"Nova meta" abre o formulário de criação', async () => {
    const usuario = userEvent.setup();
    servidor.resumo.conjunto.metas = [];
    const { local } = montarApp('/app?mes=2026-10');

    await screen.findByRole('heading', { name: 'Metas da casa' });
    await usuario.click(await screen.findByRole('link', { name: 'Nova meta' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Nova meta' })).toBeInTheDocument();
    expect(local()).toBe('/app/metas/nova');
  });

  it('"Ver todas as fixas" abre Despesas fixas no mesmo mês', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app?mes=2026-10');

    await usuario.click(await screen.findByRole('link', { name: /Ver todas as fixas/ }));

    expect(await screen.findByRole('heading', { level: 1, name: /Despesas fixas/ })).toBeInTheDocument();
    expect(local()).toBe('/app/fixas?mes=2026-10');
  });

  it('o item Metas da navegação abre a lista de metas', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app?mes=2026-10');

    await screen.findByRole('heading', { name: 'Metas da casa' });
    const navegacao = screen
      .getAllByRole('navigation')
      .flatMap((n) => within(n).queryAllByRole('link', { name: 'Metas' }));
    expect(navegacao.length).toBeGreaterThan(0);
    for (const link of navegacao) expect(link).toHaveAttribute('href', '/app/metas');
    await usuario.click(navegacao[0]!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument();
    expect(local()).toBe('/app/metas');
  });

  it('as rotas de fixas, orçamento e metas existem (não caem em "Página não encontrada")', async () => {
    for (const caminho of ['/app/fixas?mes=2026-10', '/app/orcamento?mes=2026-10', '/app/metas', '/app/metas/nova']) {
      const { unmount } = montarApp(caminho);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByText(/Página não encontrada/)).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe('Ajustes leva às telas', () => {
  it('"Metas" e "Casa e membros" aparecem em Ajustes e abrem as telas', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    const principal = within(await screen.findByRole('main'));
    const metas = await principal.findByRole('link', { name: /^Metas/ });
    expect(metas).toHaveAttribute('href', '/app/metas');
    const lar = principal.getByRole('link', { name: /Casa e membros/ });
    expect(lar).toHaveAttribute('href', '/app/ajustes/lar');

    await usuario.click(lar);

    expect(await screen.findByRole('heading', { level: 1, name: 'Casa e membros' })).toBeInTheDocument();
    expect(local()).toBe('/app/ajustes/lar');
  });
});
