import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onlineManager } from '@tanstack/react-query';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../../test/apoio/apiCadastros';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import {
  chamadasA,
  criarServidorLancamentos,
  instalarApiLancamentos,
  type ServidorLancamentos,
} from '../../../test/apoio/apiLancamentos';
import { fila, limparFila } from '../../../test/apoio/apoioFila';
import { TEXTO_FAIXA_OFFLINE } from '../../rotulos/textosConexao';

/**
 * Início real (etapa 12, lote 2): resumo do mês de `GET /api/resumo`, gasto do cartão, pendências da fila, vazio, erro
 * e carregando. Critérios: RN-16 (resumo do mês: total, individual só de quem consulta), RN-12/RN-13 (cartão), ADR-007.
 */

let servidor: ServidorLancamentos;

beforeAll(preAquecerPaginas, 30_000);

beforeEach(async () => {
  servidor = criarServidorLancamentos();
  instalarApiLancamentos(servidor);
  // Antes de esquecer o dono: a fila só lista os itens do usuário lembrado.
  await limparFila();
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T15:00:00-03:00'));
});
afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const buscasDoResumo = () => chamadasA(servidor, 'GET', '/api/resumo').map((c) => c.url);

describe('Início: resumo do mês', () => {
  it('pede o mês corrente no dia 1 e mostra Casa e Eu com os totais do servidor', async () => {
    montarApp('/app');

    const casa = await screen.findByRole('region', { name: 'Casa' });
    expect(within(casa).getByText('Total do casal')).toBeInTheDocument();
    expect(within(casa).getByText('R$ 2.418,70')).toBeInTheDocument();
    const eu = screen.getByRole('region', { name: /Eu/ });
    expect(eu).toHaveTextContent('Ana');
    expect(within(eu).getByText('R$ 2.248,80')).toBeInTheDocument();
    expect(buscasDoResumo()).toEqual(['/api/resumo?mes=2026-10-01']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Outubro de 2026');
  });

  it('mostra o gasto do cartão de crédito: neste mês e nos próximos', async () => {
    montarApp('/app');

    const cartoes = (await screen.findByText('Cartões')).closest('section')!;
    expect(within(cartoes).getByText('Cartão de crédito XP')).toBeInTheDocument();
    expect(within(cartoes).getByText('Neste mês R$ 1.284,60')).toBeInTheDocument();
    expect(within(cartoes).getByText('Próximos meses R$ 2.150,00')).toBeInTheDocument();
    expect(within(cartoes).getByText('vence dia 10')).toBeInTheDocument();
  });

  it('?mes= pede esse mês; o seletor troca o mês na URL e refaz a leitura', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app?mes=2026-09');
    await screen.findByRole('region', { name: 'Casa' });
    expect(buscasDoResumo()).toEqual(['/api/resumo?mes=2026-09-01']);

    await usuario.click(screen.getByRole('button', { name: /Próximo mês/ }));

    await waitFor(() => expect(local()).toBe('/app?mes=2026-10'));
    await waitFor(() => expect(buscasDoResumo().at(-1)).toBe('/api/resumo?mes=2026-10-01'));
  });

  it('o resumo individual é só de quem consulta: o bloco Eu traz o nome da sessão, não o do outro membro', async () => {
    montarApp('/app');

    const eu = await screen.findByRole('region', { name: /Eu/ });

    expect(eu).toHaveTextContent('Ana');
    expect(eu).not.toHaveTextContent('Leandro');
  });

  it('quando a API devolve fixas pendentes, o cartão lista as primeiras com o botão de marcar como paga', async () => {
    montarApp('/app');

    const casa = await screen.findByRole('region', { name: 'Casa' });

    expect(within(casa).getByText('Fixas a pagar')).toBeInTheDocument();
    expect(within(casa).getAllByRole('link', { name: /Marcar como paga/ }).length).toBeGreaterThan(0);
  });
});

describe('Início: mês vazio', () => {
  it('sem lançamentos: "Nada lançado" com o atalho Lançar que abre a folha', async () => {
    servidor.resumo = lerResposta('resumo-mes-vazio.json');
    const usuario = userEvent.setup();
    const { local } = montarApp('/app');

    expect(await screen.findByText('Nada lançado em outubro ainda.')).toBeInTheDocument();
    const lancar = screen.getAllByRole('link', { name: 'Lançar' }).find((l) => l.closest('main'))!;
    expect(lancar).toHaveAttribute('href', '/app/lancar');

    await usuario.click(lancar);

    await waitFor(() => expect(local()).toBe('/app/lancar'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('sem conta nem forma cadastradas aparecem os primeiros passos', async () => {
    servidor.resumo = lerResposta('resumo-mes-vazio.json');
    servidor.dados = { ...servidor.dados, contas: [], formas: [], forma_padrao_id: null };

    montarApp('/app');

    const passos = await screen.findByRole('region', { name: 'Primeiros passos' });
    expect(within(passos).getByRole('link', { name: 'Cadastre uma conta' })).toHaveAttribute(
      'href',
      '/app/ajustes/contas/nova',
    );
    expect(within(passos).getByRole('link', { name: 'Cadastre uma forma de pagamento' })).toHaveAttribute(
      'href',
      '/app/ajustes/formas/nova',
    );
  });

  it('com conta e forma os primeiros passos não aparecem', async () => {
    montarApp('/app');
    await screen.findByRole('region', { name: 'Casa' });

    await waitFor(() => expect(servidor.chamadas.some((c) => c.url === '/api/lancamentos/dados')).toBe(true));
    expect(screen.queryByRole('region', { name: 'Primeiros passos' })).not.toBeInTheDocument();
  });
});

describe('Início: carregando, erro e cache', () => {
  it('enquanto carrega a página está ocupada e o esqueleto é anunciado; depois some', async () => {
    servidor.atrasos.set('GET /api/resumo', 500);
    montarApp('/app');

    const principal = await screen.findByRole('main');
    expect(principal).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByText('Carregando o resumo de outubro…')).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Casa' });
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false');
  });

  it('servidor fora do ar: texto próprio dizendo que os lançamentos ficam guardados; "Tentar de novo" recarrega', async () => {
    servidor.falhas.set('GET /api/resumo', { status: 503, code: 'indisponivel' });
    const usuario = userEvent.setup();
    montarApp('/app');

    expect(await screen.findByText('Servidor indisponível')).toBeInTheDocument();
    expect(screen.getByText(/Seus lançamentos de despesa ficam guardados no aparelho/)).toBeInTheDocument();
    servidor.falhas.clear();
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('region', { name: 'Casa' })).toBeInTheDocument();
  });

  it('erro de rede sem dado anterior: tela de erro com o texto padrão', async () => {
    servidor.falhas.set('GET /api/resumo', { status: 400, code: 'valor_invalido' });
    montarApp('/app');

    expect(await screen.findByText('Verifique a conexão e tente de novo.')).toBeInTheDocument();
  });

  it('falha ao reler depois de já ter o resumo: mantém os dados e avisa que são os guardados', async () => {
    const { cliente } = montarApp('/app');
    await screen.findByRole('region', { name: 'Casa' });

    servidor.falhas.set('GET /api/resumo', { status: 503, code: 'indisponivel' });
    await act(async () => {
      await cliente.refetchQueries({ queryKey: ['resumo'] }).catch(() => undefined);
    });

    expect(await screen.findByText(/^Mostrando dados de /)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Casa' })).toBeInTheDocument();
    expect(screen.getByText('R$ 2.418,70')).toBeInTheDocument();
  });
});

describe('Início: pendências da fila e conexão', () => {
  const ARGS = {
    valor_centavos: 4590,
    categoria_id: '00000000-0000-4000-8000-000000000401',
    forma_id: '00000000-0000-4000-8000-000000000301',
    parcelas: 1,
    data: '2026-10-09',
    descricao: 'Feira',
  };
  const EXIBICAO = { categoria_nome: 'Mercado', forma_nome: 'Pix Nubank' };

  // O envio automático da fila roda ao abrir o app; com o servidor fora do ar para lançar, o item fica aguardando.
  beforeEach(() => {
    servidor.falhas.set('POST /api/lancamentos/despesas', { status: 503, code: 'indisponivel' });
  });

  it('com item na fila, a faixa conta os pendentes, o cabeçalho ganha o ícone e "Ver" abre a folha de envios', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app');
    await screen.findByRole('region', { name: 'Casa' });
    await fila.enfileirar(ARGS, EXIBICAO);

    expect(
      await screen.findByText('1 lançamento aguardando envio. Ele fica guardado no aparelho.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Envios pendentes: 1' })).toHaveAttribute(
      'href',
      '/app?mes=2026-10&envios=1',
    );

    await usuario.click(screen.getByRole('link', { name: 'Ver' }));

    await waitFor(() => expect(local()).toBe('/app?mes=2026-10&envios=1'));
    const folha = within(await screen.findByRole('dialog', { name: 'Envios pendentes' }));
    expect(folha.getByText(/Feira/)).toBeInTheDocument();
  });

  it('"Tentar agora" envia a fila: o item sai, a faixa some e o resumo é relido', async () => {
    const usuario = userEvent.setup();
    montarApp('/app?envios=1');
    await screen.findByRole('region', { name: 'Casa' });
    const item = await fila.enfileirar(ARGS, EXIBICAO);
    const folha = within(await screen.findByRole('dialog', { name: 'Envios pendentes' }));
    const antes = buscasDoResumo().length;
    servidor.falhas.clear();

    await usuario.click(folha.getByRole('button', { name: /Tentar agora/ }));

    await waitFor(async () => expect(await fila.listar()).toHaveLength(0));
    expect(chamadasA(servidor, 'POST', '/api/lancamentos/despesas').map((c) => c.corpo?.id)).toContain(item.args.id);
    await waitFor(() => expect(buscasDoResumo().length).toBeGreaterThan(antes));
  });

  it('descartar o item pede confirmação e só então o tira da fila', async () => {
    const usuario = userEvent.setup();
    montarApp('/app?envios=1');
    await screen.findByRole('region', { name: 'Casa' });
    await fila.enfileirar(ARGS, EXIBICAO);
    const folha = within(await screen.findByRole('dialog', { name: 'Envios pendentes' }));

    await usuario.click(folha.getByRole('button', { name: /Descartar/ }));
    expect(await fila.listar()).toHaveLength(1);
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /Descartar/ }));

    await waitFor(async () => expect(await fila.listar()).toHaveLength(0));
  });

  it('sem rede: a faixa offline aparece', async () => {
    montarApp('/app');
    await screen.findByRole('region', { name: 'Casa' });

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    const faixas = await screen.findAllByText(TEXTO_FAIXA_OFFLINE);
    expect(faixas.some((f) => f.closest('main') !== null)).toBe(true);
  });

  it('item de outro usuário no aparelho não conta como pendente deste membro (G-38)', async () => {
    montarApp('/app');
    await screen.findByRole('region', { name: 'Casa' });

    expect(screen.queryByText(/aguardando envio/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Envios pendentes/ })).not.toBeInTheDocument();
  });
});
