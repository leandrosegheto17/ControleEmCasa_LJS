import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import { chamadasA } from '../../test/apoio/apiLancamentos';
import {
  criarServidorMetas,
  ID_NOTEBOOK,
  ID_RESERVA,
  ID_VIAGEM,
  instalarApiMetas,
  preAquecerMetas,
  type ServidorMetas,
} from '../../test/apoio/apiMetas';

/**
 * Lista de metas (etapa 12, lote 4). Critérios: RN-08 (guardado, falta, percentual limitado a 99 até atingir, valor
 * mensal necessário, atingida), CA-08.6 (não atingidas primeiro, depois por nome), RT-01 (a individual do outro membro
 * não chega) e o contrato de `GET /api/metas`. Os números vêm do servidor: a tela não recalcula.
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

const METAS = '/app/metas';
const secao = (nome: string) => screen.getByRole('region', { name: nome });
const nomes = (regiao: HTMLElement) =>
  within(regiao)
    .getAllByRole('link')
    .map((l) => l.textContent);

describe('Metas: sucesso', () => {
  it('pede GET /api/metas e separa "Da casa" e "Minhas" na ordem do servidor (não atingidas primeiro)', async () => {
    montarApp(METAS);

    const casa = await screen.findByRole('region', { name: 'Da casa' });
    expect(nomes(casa)).toEqual([
      expect.stringContaining('Reserva de emergência'),
      expect.stringContaining('Viagem Nordeste'),
    ]);
    expect(nomes(secao('Minhas'))).toEqual([
      expect.stringContaining('Notebook novo'),
      expect.stringContaining('Curso de inglês'),
    ]);
    expect(screen.getByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument();
    expect(chamadasA(servidor, 'GET', '/api/metas').map((c) => c.url)).toContain('/api/metas');
  });

  it('cartão com prazo: guardado, falta, % e valor mensal como o servidor calculou', async () => {
    montarApp(METAS);

    const cartao = await screen.findByRole('link', { name: /Viagem Nordeste/ });
    expect(within(cartao).getByText('52%')).toBeInTheDocument();
    expect(within(cartao).getByText('Guardado R$ 6.200,00 de R$ 12.000,00')).toBeInTheDocument();
    expect(within(cartao).getByText('Faltam R$ 5.800,00')).toBeInTheDocument();
    // Falta 5.800,00 em 9 meses (out/2026 a jul/2027), arredondado para cima: R$ 644,45.
    expect(within(cartao).getByText('Até jul/2027 · R$ 644,45 por mês')).toBeInTheDocument();
    const barra = within(cartao).getByRole('progressbar', { name: 'Viagem Nordeste' });
    expect(barra).toHaveAttribute('aria-valuenow', '52');
    expect(barra.className).toMatch(/barra-casa/);
    expect(cartao).toHaveAttribute('href', `/app/metas/${ID_VIAGEM}`);
  });

  it('cartão sem prazo mostra "Sem prazo"', async () => {
    montarApp(METAS);

    const cartao = await screen.findByRole('link', { name: /Reserva de emergência/ });
    expect(within(cartao).getByText('62%')).toBeInTheDocument();
    expect(within(cartao).getByText('Faltam R$ 11.500,00')).toBeInTheDocument();
    expect(within(cartao).getByText('Sem prazo')).toBeInTheDocument();
    expect(cartao).toHaveAttribute('href', `/app/metas/${ID_RESERVA}`);
  });

  it('meta individual usa a barra "eu"', async () => {
    montarApp(METAS);

    const cartao = await screen.findByRole('link', { name: /Notebook novo/ });
    expect(within(cartao).getByRole('progressbar', { name: 'Notebook novo' }).className).toMatch(/barra-eu/);
  });

  it('meta atingida: selo "Atingida", barra "dentro" e "100%" na linha final', async () => {
    montarApp(METAS);

    const cartao = await screen.findByRole('link', { name: /Curso de inglês/ });
    expect(within(cartao).getByText('Atingida')).toBeInTheDocument();
    expect(within(cartao).getByText('100%')).toBeInTheDocument();
    expect(within(cartao).getByText('Faltam R$ 0,00')).toBeInTheDocument();
    const barra = within(cartao).getByRole('progressbar', { name: 'Curso de inglês' });
    expect(barra).toHaveAttribute('aria-valuenow', '100');
    expect(barra.className).toMatch(/barra-dentro/);
  });

  it('um aporte que leva ao alvo faz a meta passar a atingida e ir para o fim da lista (CA-08.3, CA-08.6)', async () => {
    servidor.movimentos.push({
      id: '00000000-0000-4000-8000-000000000f01',
      metaId: ID_NOTEBOOK,
      tipo: 'aporte',
      valor: 360000,
      data: '2026-10-08',
      local: 'Cofre',
      autor: { nome: 'Ana', sou_eu: true },
    });
    montarApp(METAS);

    const minhas = await screen.findByRole('region', { name: 'Minhas' });
    const atingidas = within(minhas).getAllByText('Atingida');
    expect(atingidas).toHaveLength(2);
    expect(nomes(minhas)).toEqual([
      expect.stringContaining('Curso de inglês'),
      expect.stringContaining('Notebook novo'),
    ]);
  });

  it('não recalcula: mostra exatamente os números do servidor', async () => {
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, init?: RequestInit) => {
      const resposta = await original(entrada, init);
      if (String(entrada) !== '/api/metas') return resposta;
      const lista = (await resposta.json()) as Array<Record<string, unknown>>;
      const viagem = lista.find((m) => m.id === ID_VIAGEM)!;
      Object.assign(viagem, { percentual: 7, falta_centavos: 1, mensal_necessario_centavos: 2 });
      return new Response(JSON.stringify(lista), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    montarApp(METAS);

    const cartao = await screen.findByRole('link', { name: /Viagem Nordeste/ });
    expect(within(cartao).getByText('7%')).toBeInTheDocument();
    expect(within(cartao).getByText('Faltam R$ 0,01')).toBeInTheDocument();
    expect(within(cartao).getByText('Até jul/2027 · R$ 0,02 por mês')).toBeInTheDocument();
  });

  it('a meta individual do outro membro não aparece (RT-01)', async () => {
    servidor.metas.push({
      id: '00000000-0000-4000-8000-000000000f02',
      nome: 'Segredo da Beatriz',
      escopo: 'individual',
      alvo: 100000,
      prazo: null,
      doOutro: true,
    });
    montarApp(METAS);

    await screen.findByRole('link', { name: /Notebook novo/ });
    expect(screen.queryByText(/Segredo da Beatriz/)).not.toBeInTheDocument();
  });

  it('"Nova meta" no cabeçalho leva ao formulário em /app/metas/nova', async () => {
    montarApp(METAS);

    expect(await screen.findByRole('link', { name: 'Nova meta' })).toHaveAttribute('href', '/app/metas/nova');
  });
});

describe('Metas: vazio', () => {
  it('sem metas mostra o estado de cada seção com o escopo no link', async () => {
    servidor.metas = [];
    montarApp(METAS);

    const casa = await screen.findByRole('region', { name: 'Da casa' });
    const minhas = secao('Minhas');
    expect(
      within(casa).getByText(
        'Nenhuma meta da casa ainda. Uma meta da casa mostra aos dois quanto falta e quem guardou.',
      ),
    ).toBeInTheDocument();
    expect(within(casa).getByRole('link', { name: 'Nova meta da casa' })).toHaveAttribute(
      'href',
      '/app/metas/nova?escopo=casa',
    );
    expect(within(minhas).getByText('Nenhuma meta sua ainda. Só você vê as suas metas.')).toBeInTheDocument();
    expect(within(minhas).getByRole('link', { name: 'Nova meta minha' })).toHaveAttribute(
      'href',
      '/app/metas/nova?escopo=eu',
    );
  });

  it('só a seção sem metas mostra o estado vazio', async () => {
    servidor.metas = servidor.metas.filter((m) => m.escopo === 'individual');
    montarApp(METAS);

    const casa = await screen.findByRole('region', { name: 'Da casa' });
    const minhas = secao('Minhas');
    expect(within(casa).getByRole('link', { name: 'Nova meta da casa' })).toBeInTheDocument();
    expect(within(minhas).queryByRole('link', { name: 'Nova meta minha' })).not.toBeInTheDocument();
    expect(within(minhas).getAllByRole('link')).toHaveLength(2);
  });
});

describe('Metas: carregando e erro', () => {
  it('carregando mostra o aviso para leitor de tela, sem barras, e mantém "Nova meta"', async () => {
    servidor.atrasos.set('GET /api/metas', 600);
    montarApp(METAS);

    expect(await screen.findByText('Carregando as metas…')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova meta' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('erro do servidor sem dado: estado de erro, sem as seções, e "Tentar de novo" busca de novo', async () => {
    servidor.falhas.set('GET /api/metas', { status: 500, code: 'erro_interno' });
    montarApp(METAS);

    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Da casa' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova meta' })).toBeInTheDocument();

    servidor.falhas.clear();
    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));

    expect(await screen.findByRole('link', { name: /Viagem Nordeste/ })).toBeInTheDocument();
  });

  it('erro com dado em cache mantém os cartões e mostra a faixa "Mostrando dados de"', async () => {
    const { cliente } = montarApp(METAS);
    await screen.findByRole('link', { name: /Viagem Nordeste/ });

    servidor.semRede = true;
    await cliente.refetchQueries({ queryKey: ['metas'] });

    await waitFor(() => expect(screen.getByText(/Mostrando dados de/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Viagem Nordeste/ })).toBeInTheDocument();
  });
});
