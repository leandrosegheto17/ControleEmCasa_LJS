import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import { ID_DELIVERY_CASAL } from '../../test/apoio/apiFixas';
import { chamadasA } from '../../test/apoio/apiLancamentos';
import { ID_VIAGEM } from '../../test/apoio/apiMetas';
import {
  criarServidorPlano,
  instalarApiPlano,
  planoFree,
  planoTrial,
  preAquecerPlano,
  type ServidorPlano,
} from '../../test/apoio/apiPlano';

/**
 * Orçamento e metas no plano Free (etapa 13, lote 2). Critérios: RN-25 e CA-25.1 a CA-25.5 (no Free as telas continuam
 * legíveis e toda escrita é bloqueada; o servidor responde 403 `plano_necessario`), CA-T2.3. A tela avisa e leva a Meu
 * plano; o botão escondido não é a proteção (o servidor é), então o texto do 403 também é conferido.
 */

let servidor: ServidorPlano;

configure({ asyncUtilTimeout: 5000 });

beforeAll(async () => {
  await preAquecerPaginas();
  await preAquecerPlano();
}, 60_000);

beforeEach(async () => {
  servidor = criarServidorPlano({ meuPlano: planoFree() });
  instalarApiPlano(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A faixa do plano (há outra região `status` na tela, a dos avisos). */
const faixaDoPlano = async () =>
  (await screen.findByText(/fica só para consulta/)).closest('[role="status"]') as HTMLElement;
const ORCAMENTO = '/app/orcamento?mes=2026-10';
const escritasDeOrcamentoEMetas = () =>
  servidor.chamadas.filter((c) => c.metodo !== 'GET' && /^\/api\/(orcamento|metas)/.test(c.url));

describe('Orçamento no Free', () => {
  it('continua legível, avisa que é só consulta e leva a Meu plano', async () => {
    montarApp(ORCAMENTO);

    expect(await screen.findByRole('heading', { name: /Orçamento da casa/ })).toBeInTheDocument();
    const aviso = await faixaDoPlano();
    expect(aviso).toHaveTextContent('No plano Free o orçamento fica só para consulta. Assine o Pro para editar.');
    expect(within(aviso).getByRole('link', { name: 'Ver meu plano' })).toHaveAttribute('href', '/app/ajustes/plano');
    const porCategoria = screen.getByRole('region', { name: 'Por categoria' });
    expect(within(porCategoria).getByText('Moradia')).toBeInTheDocument();
  });

  it('as linhas não abrem a edição e nada oferece definir ou copiar orçamento', async () => {
    servidor.orcado.conjunto.delete(`2026-10-01|${ID_DELIVERY_CASAL}`);
    montarApp(ORCAMENTO);

    const porCategoria = await screen.findByRole('region', { name: 'Por categoria' });
    expect(within(porCategoria).queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByRole('link', { name: /Definir orçamento de/, hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Definir|Copiar/ })).not.toBeInTheDocument();
  });

  it('mês sem orçamento: explica e não oferece copiar nem definir', async () => {
    montarApp('/app/orcamento?mes=2026-11');

    expect(await screen.findByRole('heading', { name: 'Sem orçamento da casa em novembro' })).toBeInTheDocument();
    expect(screen.getByText('No plano Free não é possível definir orçamento.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copiar|Definir/ })).not.toBeInTheDocument();
  });

  it('o endereço de edição (?editar=) não abre a folha e nada é gravado', async () => {
    montarApp(`${ORCAMENTO}&escopo=casa&editar=${ID_DELIVERY_CASAL}`);

    await screen.findByRole('heading', { name: /Orçamento da casa/ });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Valor orçado')).not.toBeInTheDocument();
    expect(escritasDeOrcamentoEMetas()).toEqual([]);
  });

  it('no Pro (e no trial) a tela segue como antes: sem aviso e com as linhas editáveis', async () => {
    servidor.meuPlano = planoTrial();
    servidor.plano = 'pro';
    montarApp(ORCAMENTO);

    const porCategoria = await screen.findByRole('region', { name: 'Por categoria' });
    expect(within(porCategoria).getAllByRole('link').length).toBeGreaterThan(0);
    expect(screen.queryByText(/fica só para consulta/)).not.toBeInTheDocument();
  });

  it('plano mudou no servidor (sessão ainda diz Pro): o 403 plano_necessario tem texto próprio', async () => {
    const usuario = userEvent.setup();
    servidor.plano = 'pro';
    servidor.meuPlano = planoFree();
    montarApp(`${ORCAMENTO}&escopo=casa&editar=${ID_DELIVERY_CASAL}`);

    await usuario.click(await screen.findByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('Orçamento e metas ficam só para consulta no plano Free. Assine o Pro para editar'),
    ).toBeInTheDocument();
    expect(chamadasA(servidor, 'PUT', '/api/orcamento/')).toHaveLength(1);
  });
});

describe('Metas no Free', () => {
  it('a lista continua legível, avisa e não oferece criar meta', async () => {
    montarApp('/app/metas');

    expect(await screen.findByRole('heading', { level: 1, name: 'Metas' })).toBeInTheDocument();
    expect(await screen.findByText('Viagem Nordeste')).toBeInTheDocument();
    expect(await faixaDoPlano()).toHaveTextContent('No plano Free as metas fica só para consulta');
    expect(screen.queryByRole('link', { name: /Nova meta/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver meu plano' })).toHaveAttribute('href', '/app/ajustes/plano');
  });

  it('sem metas, o estado vazio explica sem botão de criar', async () => {
    servidor.metas = [];
    servidor.movimentos = [];
    montarApp('/app/metas');

    expect(await screen.findByText(/Nenhuma meta da casa ainda/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Nova meta/ })).not.toBeInTheDocument();
  });

  it('o detalhe da meta mostra o histórico, mas sem editar, aportar nem retirar', async () => {
    montarApp(`/app/metas/${ID_VIAGEM}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Viagem Nordeste' })).toBeInTheDocument();
    expect(await faixaDoPlano()).toHaveTextContent('só para consulta');
    expect(screen.queryByRole('link', { name: 'Editar meta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Aportar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Retirar' })).not.toBeInTheDocument();
  });

  it('o endereço de movimentar (?movimentar=) não abre a folha e nada é gravado', async () => {
    montarApp(`/app/metas/${ID_VIAGEM}?movimentar=aporte`);

    await screen.findByRole('heading', { level: 1, name: 'Viagem Nordeste' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(escritasDeOrcamentoEMetas()).toEqual([]);
  });

  it.each(['/app/metas/nova', `/app/metas/${ID_VIAGEM}/editar`])(
    '%s mostra o bloqueio com o caminho para assinar',
    async (caminho) => {
      montarApp(caminho);

      expect(await screen.findByRole('heading', { name: 'Metas só para consulta no plano Free' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ver meu plano' })).toHaveAttribute('href', '/app/ajustes/plano');
      expect(screen.queryByLabelText(/Nome/)).not.toBeInTheDocument();
      await waitFor(() => expect(escritasDeOrcamentoEMetas()).toEqual([]));
    },
  );

  it('no trial a lista de metas segue com "Nova meta" e sem aviso', async () => {
    servidor.meuPlano = planoTrial();
    servidor.plano = 'pro';
    montarApp('/app/metas');

    expect(await screen.findByRole('link', { name: /Nova meta/ })).toBeInTheDocument();
    expect(screen.queryByText(/fica só para consulta/)).not.toBeInTheDocument();
  });
});
