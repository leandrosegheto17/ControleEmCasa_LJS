import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  criarServidorFixas,
  ID_CONTAS_CASA,
  ID_DELIVERY_CASAL,
  ID_TRANSPORTE,
  instalarApiFixas,
  preAquecerFixas,
  type ServidorFixas,
} from '../../test/apoio/apiFixas';
import { chamadasA } from '../../test/apoio/apiLancamentos';

/**
 * Orçamento do mês (etapa 12, lote 3). Critérios: RN-16 (realizado = Σ parcelas do mês, total = todas as despesas do
 * escopo, situação pela razão exata: < 80% dentro, até 100% atenção, acima estourado; ordem por percentual desc;
 * copiar do mês anterior sem sobrescrever; individual só do próprio membro), RN-25 (aberto neste lote), RT-05.
 */

let servidor: ServidorFixas;

// Com a suíte inteira em paralelo, a primeira montagem de uma tela pode passar de 1 s (módulos e contrato carregados na hora).
configure({ asyncUtilTimeout: 5000 });

beforeAll(async () => {
  await preAquecerPaginas();
  await preAquecerFixas();
}, 60_000);

beforeEach(async () => {
  servidor = criarServidorFixas();
  instalarApiFixas(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Regex que casa o texto literal, aceitando qualquer espaço (inclusive o não separável da moeda) onde há espaço. */
const moeda = (texto: string) => new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`).replace(/ /g, '\\s'));
const buscas = () => chamadasA(servidor, 'GET', '/api/orcamento').map((c) => c.url);
const ORCAMENTO = '/app/orcamento?mes=2026-10';

describe('Orcamento: mês com orçamento', () => {
  it('mostra o mês no título, o escopo Casa marcado e pede o mês no dia 1 com o escopo da API', async () => {
    montarApp(ORCAMENTO);

    expect(await screen.findByRole('heading', { level: 1, name: 'Orçamento de Outubro de 2026' })).toBeInTheDocument();
    const escopo = screen.getByRole('group', { name: 'Escopo do orçamento' });
    expect(within(escopo).getByRole('radio', { name: 'Casa' })).toBeChecked();
    await screen.findByRole('heading', { name: /Orçamento da casa/ });
    expect(buscas()).toEqual(['/api/orcamento?mes=2026-10-01&escopo=conjunto']);
  });

  it('cartão total: selo, realizado de orçado, %, barra e resultado parcial, tudo como o servidor calculou', async () => {
    montarApp(ORCAMENTO);

    const titulo = await screen.findByRole('heading', { name: /Orçamento da casa/ });
    expect(titulo).toHaveTextContent('Dentro');
    const cartao = titulo.closest('section') as HTMLElement;
    expect(cartao).toHaveTextContent(moeda('R$ 2.418,70'));
    expect(cartao).toHaveTextContent(moeda('R$ 4.300,00'));
    expect(cartao).toHaveTextContent('56%');
    expect(within(cartao).getByRole('progressbar', { name: 'Orçamento da casa' })).toHaveAttribute(
      'aria-valuenow',
      '56',
    );
    expect(cartao).toHaveTextContent('Resultado da casa');
    expect(cartao).toHaveTextContent('parcial');
    expect(cartao).toHaveTextContent(moeda('R$ 1.881,30'));
  });

  it('lista as categorias por percentual decrescente, cada uma com sua situação (dentro, atenção, estourado)', async () => {
    montarApp(ORCAMENTO);

    const porCategoria = await screen.findByRole('region', { name: 'Por categoria' });
    const links = within(porCategoria).getAllByRole('link', { name: /^Editar orçamento de / });
    expect(links.map((a) => a.getAttribute('aria-label')?.split(':')[0])).toEqual([
      'Editar orçamento de Contas da casa',
      'Editar orçamento de Delivery/iFood do casal',
      'Editar orçamento de Mercado',
      'Editar orçamento de Outros da casa',
      'Editar orçamento de Moradia',
    ]);
    const contas = within(porCategoria).getByRole('link', { name: /Editar orçamento de Contas da casa/ });
    expect(contas).toHaveAttribute('href', `/app/orcamento?mes=2026-10&escopo=casa&editar=${ID_CONTAS_CASA}`);
    expect(contas).toHaveAccessibleName(
      moeda('Editar orçamento de Contas da casa: R$ 332,50 de R$ 300,00, 111%, estourado'),
    );
    expect(contas).toHaveTextContent('Estourado');
    // 368,00 de 400,00 = 92%: acima de 80% e dentro do orçado.
    expect(within(porCategoria).getByRole('link', { name: /Delivery/ })).toHaveTextContent('Atenção');
    // 768,20 de 1.000,00 = 77%: abaixo de 80%.
    expect(within(porCategoria).getByRole('link', { name: /Mercado/ })).toHaveTextContent('Dentro');
  });

  it('a situação usa a razão exata, não o percentual arredondado (RT-05): 79,99% é dentro e mostra 80%', async () => {
    servidor.orcado.conjunto.set(`2026-10-01|${ID_DELIVERY_CASAL}`, 10000);
    servidor.realizado.set(`2026-10-01|${ID_DELIVERY_CASAL}`, 7999);
    montarApp(ORCAMENTO);

    const delivery = await screen.findByRole('link', { name: /Editar orçamento de Delivery/ });

    expect(delivery).toHaveTextContent('80%');
    expect(delivery).toHaveTextContent('Dentro');
  });

  it.each([
    [8000, 'Atenção', '80%'],
    [10000, 'Atenção', '100%'],
    [10001, 'Estourado', '100%'],
    [0, 'Dentro', '0%'],
  ])('realizado %i de 10.000: situação %s, percentual %s (tabela da RN-16)', async (realizado, selo, percentual) => {
    servidor.orcado.conjunto.set(`2026-10-01|${ID_DELIVERY_CASAL}`, 10000);
    servidor.realizado.set(`2026-10-01|${ID_DELIVERY_CASAL}`, realizado);
    montarApp(ORCAMENTO);

    const delivery = await screen.findByRole('link', { name: /Editar orçamento de Delivery/ });

    expect(delivery).toHaveTextContent(selo);
    expect(delivery).toHaveTextContent(percentual);
  });

  it('o total conta o gasto de categorias SEM orçamento (CA-16.6)', async () => {
    servidor.orcado.conjunto.delete(`2026-10-01|${ID_CONTAS_CASA}`);
    montarApp(ORCAMENTO);

    const titulo = await screen.findByRole('heading', { name: /Orçamento da casa/ });
    const cartao = titulo.closest('section') as HTMLElement;
    expect(cartao).toHaveTextContent(moeda('R$ 2.418,70'));
    expect(cartao).toHaveTextContent(moeda('R$ 4.000,00'));
  });

  it('sem categorias sem orçamento mostra a linha de tudo orçado', async () => {
    montarApp(ORCAMENTO);

    expect(
      await screen.findByText('Todas as categorias de despesa da casa têm orçamento em outubro.'),
    ).toBeInTheDocument();
  });

  it('com categorias sem orçamento mostra a seção recolhida com "Definir" para cada uma', async () => {
    servidor.orcado.conjunto.delete(`2026-10-01|${ID_DELIVERY_CASAL}`);
    montarApp(ORCAMENTO);

    expect(await screen.findByText(/Sem orçamento \(1\)/)).toBeInTheDocument();
    expect(
      screen.queryByText('Todas as categorias de despesa da casa têm orçamento em outubro.'),
    ).not.toBeInTheDocument();
    const definir = screen.getByRole('link', { name: 'Definir orçamento de Delivery/iFood do casal', hidden: true });
    expect(definir).toHaveAttribute('href', `/app/orcamento?mes=2026-10&escopo=casa&editar=${ID_DELIVERY_CASAL}`);
  });

  it('trocar o mês grava ?mes= e pede o mês novo; mês sem orçamento mostra o vazio', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(ORCAMENTO);
    await screen.findByRole('heading', { name: /Orçamento da casa/ });

    await usuario.click(screen.getByRole('button', { name: /Próximo mês/ }));

    expect(await screen.findByRole('heading', { name: 'Sem orçamento da casa em novembro' })).toBeInTheDocument();
    expect(local()).toBe('/app/orcamento?mes=2026-11');
    expect(buscas().at(-1)).toBe('/api/orcamento?mes=2026-11-01&escopo=conjunto');
  });
});

describe('Orcamento: escopo na URL (RN-16e: o individual é só de quem consulta)', () => {
  it('trocar para Eu grava escopo=eu e pede o escopo individual; o orçamento da casa não aparece', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(ORCAMENTO);
    await screen.findByRole('heading', { name: /Orçamento da casa/ });

    await usuario.click(screen.getByRole('radio', { name: 'Eu' }));

    expect(await screen.findByRole('heading', { name: 'Sem orçamento seu em outubro' })).toBeInTheDocument();
    expect(local()).toBe('/app/orcamento?mes=2026-10&escopo=eu');
    expect(buscas().at(-1)).toBe('/api/orcamento?mes=2026-10-01&escopo=individual');
    expect(screen.queryByRole('heading', { name: /Orçamento da casa/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByText('Moradia')).not.toBeInTheDocument();
  });

  it('o escopo Eu com orçamento mostra só as categorias individuais, com o título "Meu orçamento"', async () => {
    servidor.orcado.individual.set(`2026-10-01|${ID_TRANSPORTE}`, 20000);
    montarApp(`${ORCAMENTO}&escopo=eu`);

    const titulo = await screen.findByRole('heading', { name: /Meu orçamento/ });
    expect(titulo.closest('section')).toHaveTextContent('Meu resultado');
    const porCategoria = screen.getByRole('region', { name: 'Por categoria' });
    expect(within(porCategoria).getAllByRole('link')).toHaveLength(1);
    expect(within(porCategoria).getByRole('link', { name: /Transporte/ })).toHaveTextContent('Dentro');
    expect(within(screen.getByRole('main')).queryByText('Mercado')).not.toBeInTheDocument();
  });

  it('escopo desconhecido na URL vale Casa', async () => {
    montarApp(`${ORCAMENTO}&escopo=xyz`);

    expect(await screen.findByRole('radio', { name: 'Casa' })).toBeChecked();
    await screen.findByRole('heading', { name: /Orçamento da casa/ });
    expect(buscas()).toEqual(['/api/orcamento?mes=2026-10-01&escopo=conjunto']);
  });
});

describe('Orcamento: mês vazio e copiar do mês anterior (CA-16.7)', () => {
  const NOVEMBRO = '/app/orcamento?mes=2026-11';

  it('oferece copiar do mês anterior com o resumo do que será copiado', async () => {
    montarApp(NOVEMBRO);

    expect(await screen.findByRole('heading', { name: 'Sem orçamento da casa em novembro' })).toBeInTheDocument();
    expect(screen.getByText(/Copie os valores de outubro/)).toHaveTextContent(
      moeda('Copie os valores de outubro (R$ 4.300,00 em 5 categorias) e ajuste o que mudar.'),
    );
    expect(screen.getByRole('button', { name: 'Copiar de outubro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Definir do zero' })).toBeInTheDocument();
  });

  it('copiar envia o mês e o escopo da API, avisa e passa a mostrar o orçamento copiado', async () => {
    const usuario = userEvent.setup();
    montarApp(NOVEMBRO);

    await usuario.click(await screen.findByRole('button', { name: 'Copiar de outubro' }));

    expect(await screen.findByText('Orçamento copiado de outubro')).toBeInTheDocument();
    const copias = chamadasA(servidor, 'POST', '/api/orcamento/');
    expect(copias).toHaveLength(1);
    expect(copias[0]!.url).toBe('/api/orcamento/2026-11-01/copiar');
    expect(copias[0]!.corpo).toEqual({ escopo: 'conjunto' });
    expect(copias[0]!.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    const titulo = await screen.findByRole('heading', { name: /Orçamento da casa/ });
    expect(titulo.closest('section')).toHaveTextContent(moeda('R$ 4.300,00'));
    expect(titulo).toHaveTextContent('Dentro');
  });

  it('no escopo Eu a cópia vai com individual (e só copia o que o próprio membro orçou)', async () => {
    const usuario = userEvent.setup();
    servidor.orcado.individual.set(`2026-10-01|${ID_TRANSPORTE}`, 20000);
    montarApp(`${NOVEMBRO}&escopo=eu`);

    await usuario.click(await screen.findByRole('button', { name: 'Copiar de outubro' }));

    await screen.findByText('Orçamento copiado de outubro');
    expect(chamadasA(servidor, 'POST', '/api/orcamento/')[0]!.corpo).toEqual({ escopo: 'individual' });
    expect(servidor.orcado.individual.get(`2026-11-01|${ID_TRANSPORTE}`)).toBe(20000);
    expect([...servidor.orcado.conjunto.keys()].some((k) => k.startsWith('2026-11-01'))).toBe(false);
  });

  it('copiar não sobrescreve o que o mês já tem: o botão some quando o mês já tem orçamento', async () => {
    servidor.orcado.conjunto.set(`2026-11-01|${ID_DELIVERY_CASAL}`, 55000);
    montarApp(NOVEMBRO);

    expect(await screen.findByRole('heading', { name: /Orçamento da casa/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copiar de/ })).not.toBeInTheDocument();
    expect(servidor.orcado.conjunto.get(`2026-11-01|${ID_DELIVERY_CASAL}`)).toBe(55000);
  });

  it('"Definir do zero" abre a seção com todas as categorias para definir, sem chamar o servidor', async () => {
    const usuario = userEvent.setup();
    montarApp(NOVEMBRO);

    await usuario.click(await screen.findByRole('button', { name: 'Definir do zero' }));

    expect(screen.queryByRole('heading', { name: 'Sem orçamento da casa em novembro' })).not.toBeInTheDocument();
    expect(screen.getByText(/Sem orçamento \(5\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Definir orçamento de Mercado' })).toBeInTheDocument();
    expect(chamadasA(servidor, 'POST', '/api/orcamento/')).toHaveLength(0);
  });

  it('mês sem orçamento e sem mês anterior para copiar oferece só "Definir orçamento"', async () => {
    montarApp('/app/orcamento?mes=2026-08');

    expect(await screen.findByRole('heading', { name: 'Sem orçamento da casa em agosto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Definir orçamento' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copiar de/ })).not.toBeInTheDocument();
  });

  it('erro de rede na cópia avisa e o estado continua igual', async () => {
    const usuario = userEvent.setup();
    montarApp(NOVEMBRO);
    const copiar = await screen.findByRole('button', { name: 'Copiar de outubro' });
    servidor.semRede = true;
    await usuario.click(copiar);

    expect(await screen.findByText('Sem conexão. O orçamento não foi copiado.')).toBeInTheDocument();
    expect(screen.queryByText(/Orçamento copiado/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar de outubro' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Sem orçamento da casa em novembro' })).toBeInTheDocument();
  });
});

describe('Orcamento: estados de leitura', () => {
  it('carregando mostra o texto de carregamento com o segmentado visível', async () => {
    servidor.atrasos.set('GET /api/orcamento', 3000);
    montarApp(ORCAMENTO);

    expect(await screen.findByRole('radio', { name: 'Casa' })).toBeInTheDocument();
    expect(await screen.findByText('Carregando o orçamento…', {}, { timeout: 2500 })).toBeInTheDocument();
  });

  it('erro sem cache mostra o estado de erro, sem o segmentado; "Tentar de novo" recarrega', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('GET /api/orcamento', { status: 500, code: 'erro_interno' });
    montarApp(ORCAMENTO);

    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Casa' })).not.toBeInTheDocument();
    servidor.falhas.clear();
    await usuario.click(screen.getByRole('button', { name: /Tentar de novo/ }));

    await waitFor(() => expect(screen.getByRole('heading', { name: /Orçamento da casa/ })).toBeInTheDocument());
  });
});

describe('Acesso à tela de orçamento', () => {
  it('"Ver orçamento" do bloco da casa, no Início, leva à tela de orçamento sob /app, com o mês', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app?mes=2026-10');

    await usuario.click(await screen.findByRole('link', { name: /Ver orçamento/ }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Orçamento de Outubro de 2026' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(local()).toBe('/app/orcamento?mes=2026-10&escopo=casa');
  });

  it('"Ver meu orçamento" leva à tela já no escopo Eu', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app?mes=2026-10');

    await usuario.click(await screen.findByRole('link', { name: /Ver meu orçamento/ }));

    expect(await screen.findByRole('radio', { name: 'Eu' }, { timeout: 5000 })).toBeChecked();
    expect(local()).toBe('/app/orcamento?mes=2026-10&escopo=eu');
  });

  it('o trilho de navegação leva ao Orçamento carregando o mês', async () => {
    const usuario = userEvent.setup();
    montarApp('/app?mes=2026-09');
    const trilho = (await screen.findAllByRole('navigation', { name: 'Navegação principal' }))[0]!;

    await usuario.click(within(trilho).getByRole('link', { name: 'Orçamento' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Orçamento de Setembro de 2026' }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
