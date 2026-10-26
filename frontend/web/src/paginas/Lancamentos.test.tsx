import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  chamadasA,
  criarServidorLancamentos,
  instalarApiLancamentos,
  type ServidorLancamentos,
} from '../../test/apoio/apiLancamentos';

/**
 * Lista de lançamentos do mês (etapa 12, lote 2). O mês e os filtros vivem na URL (SDD 9.3); o total e a quantidade
 * vêm do servidor (a tela não soma); o outro membro só aparece como pagador.
 */

let servidor: ServidorLancamentos;

beforeAll(preAquecerPaginas, 30_000);

beforeEach(async () => {
  servidor = criarServidorLancamentos();
  instalarApiLancamentos(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const buscasDaLista = () => chamadasA(servidor, 'GET', '/api/lancamentos?').map((c) => c.url);

describe('Lançamentos: o mês pela URL', () => {
  it('com ?mes=, pede o mês no dia 1, mostra o título do mês e o total e a quantidade do servidor', async () => {
    montarApp('/app/lancamentos?mes=2026-10');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lançamentos de Outubro de 2026' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('R$ 846,30')).toBeInTheDocument();
    expect(screen.getByText('· 15 lançamentos')).toBeInTheDocument();
    expect(buscasDaLista()).toEqual(['/api/lancamentos?mes=2026-10-01']);
    await waitFor(() => expect(document.title).toBe('Lançamentos · Outubro de 2026 · Controle em Casa'));
  });

  it('sem ?mes=, vale o mês corrente de São Paulo', async () => {
    montarApp('/app/lancamentos');

    await screen.findByText('R$ 846,30');
    expect(buscasDaLista()).toEqual(['/api/lancamentos?mes=2026-10-01']);
  });

  it('?mes= inválido cai no mês corrente em vez de quebrar', async () => {
    montarApp('/app/lancamentos?mes=2026-13');

    await screen.findByText('R$ 846,30');
    expect(buscasDaLista()).toEqual(['/api/lancamentos?mes=2026-10-01']);
  });

  it('"Próximo mês" muda a URL e pede o mês novo; mês sem lançamento mostra o vazio', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancamentos?mes=2026-10');
    await screen.findByText('R$ 846,30');

    await usuario.click(screen.getByRole('button', { name: /Próximo mês/ }));

    expect(await screen.findByText('Nenhum lançamento em novembro')).toBeInTheDocument();
    expect(local()).toBe('/app/lancamentos?mes=2026-11');
    expect(buscasDaLista().at(-1)).toBe('/api/lancamentos?mes=2026-11-01');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Novembro de 2026');
  });

  it('o mês acompanha o usuário para as outras telas pelo trilho', async () => {
    montarApp('/app/lancamentos?mes=2026-09');
    await screen.findByRole('heading', { level: 1, name: /Setembro de 2026/ });

    const trilho = screen.getAllByRole('navigation', { name: 'Navegação principal' })[0]!;
    expect(within(trilho).getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/app?mes=2026-09');
  });
});

describe('Lançamentos: a lista', () => {
  it('agrupa por dia, mostra título com parcela e o pagador, e cada linha leva ao detalhe', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancamentos?mes=2026-10');

    expect(await screen.findByRole('heading', { level: 2, name: 'Sábado, 10 de outubro' })).toBeInTheDocument();
    const fone = await screen.findByRole('link', { name: /Fone bluetooth.*parcela 2 de 3/ });
    expect(fone).toHaveAttribute('href', '/app/lancamentos/00000000-0000-4000-8000-000000000515');

    await usuario.click(fone);

    await waitFor(() => expect(local()).toBe('/app/lancamentos/00000000-0000-4000-8000-000000000515'));
  });

  it('o item de outro membro aparece com o nome de quem pagou', async () => {
    servidor.itensMes = servidor.itensMes.map((i, n) =>
      n === 0
        ? { ...i, escopo: 'conjunto', pagador: { id: '00000000-0000-4000-8000-000000000102', nome: 'Beatriz' } }
        : i,
    );
    montarApp('/app/lancamentos?mes=2026-10');

    const linha = await screen.findByRole('link', { name: /Fone bluetooth/ });

    expect(linha).toHaveTextContent('Beatriz');
  });
});

describe('Lançamentos: os filtros pela URL', () => {
  it('lê escopo e variável da URL e os mostra marcados; só eles vão na requisição', async () => {
    montarApp('/app/lancamentos?mes=2026-10&escopo=eu&variavel=1');

    await screen.findByText('R$ 846,30');
    expect(screen.getByRole('button', { name: 'Eu' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Casa' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Variável' })).toHaveAttribute('aria-pressed', 'true');
    expect(buscasDaLista()).toEqual(['/api/lancamentos?mes=2026-10-01&escopo=individual&variavel=true']);
  });

  it('"Casa" escreve escopo=casa na URL (mantendo o mês) e pede escopo=conjunto', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancamentos?mes=2026-10');
    await screen.findByText('R$ 846,30');

    await usuario.click(screen.getByRole('button', { name: 'Casa' }));

    await waitFor(() => expect(local()).toBe('/app/lancamentos?mes=2026-10&escopo=casa'));
    expect(await screen.findByText('· 0 lançamentos')).toBeInTheDocument();
    expect(buscasDaLista().at(-1)).toBe('/api/lancamentos?mes=2026-10-01&escopo=conjunto');
  });

  it('clicar de novo no filtro ligado o desliga', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancamentos?mes=2026-10&variavel=1');
    await screen.findByText('R$ 846,30');

    await usuario.click(screen.getByRole('button', { name: 'Variável' }));

    await waitFor(() => expect(local()).toBe('/app/lancamentos?mes=2026-10'));
  });

  it('categoria: escolher na lista escreve categoria=<id> e filtra', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancamentos?mes=2026-10');
    await screen.findByText('R$ 846,30');

    await usuario.click(await screen.findByRole('button', { name: /^Categoria: todas/ }));
    await usuario.click(await screen.findByRole('radio', { name: 'Transporte' }));

    await waitFor(() => expect(local()).toContain('categoria=00000000-0000-4000-8000-000000000413'));
    await waitFor(() => expect(buscasDaLista().at(-1)).toContain('categoria_id=00000000-0000-4000-8000-000000000413'));
    expect(await screen.findByRole('button', { name: /^Categoria: Transporte/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('filtro sem resultado explica e "Limpar filtros" volta à lista inteira', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancamentos?mes=2026-10&escopo=casa');

    expect(await screen.findByText('Nenhum lançamento em outubro com esses filtros.')).toBeInTheDocument();
    await usuario.click(screen.getAllByRole('button', { name: 'Limpar filtros' }).at(-1)!);

    await waitFor(() => expect(local()).toBe('/app/lancamentos?mes=2026-10'));
    expect(await screen.findByText('R$ 846,30')).toBeInTheDocument();
  });

  it('filtros e id malformados na URL são ignorados', async () => {
    montarApp('/app/lancamentos?mes=2026-10&escopo=tudo&categoria=nao-e-uuid&forma=x');

    await screen.findByText('R$ 846,30');
    expect(buscasDaLista()).toEqual(['/api/lancamentos?mes=2026-10-01']);
  });
});

describe('Lançamentos: carregando, erro e vazio', () => {
  it('enquanto carrega a página está ocupada; depois mostra a lista', async () => {
    servidor.atrasos.set('GET /api/lancamentos', 400);
    montarApp('/app/lancamentos?mes=2026-10');

    const principal = await screen.findByRole('main');
    expect(principal).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('R$ 846,30')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false');
  });

  it('erro do servidor: tela de erro com "Tentar de novo", que busca outra vez', async () => {
    servidor.falhas.set('GET /api/lancamentos', { status: 503, code: 'indisponivel' });
    const usuario = userEvent.setup();
    montarApp('/app/lancamentos?mes=2026-10');

    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' });
    servidor.falhas.clear();
    await usuario.click(tentar);

    expect(await screen.findByText('R$ 846,30')).toBeInTheDocument();
  });

  it('mês sem lançamentos: estado vazio com o nome do mês', async () => {
    servidor.itensMes = [];
    montarApp('/app/lancamentos?mes=2026-10');

    expect(await screen.findByText('Nenhum lançamento em outubro')).toBeInTheDocument();
    expect(screen.getByText('· 0 lançamentos')).toBeInTheDocument();
  });
});
