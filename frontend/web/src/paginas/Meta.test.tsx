import { configure, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import { chamadasA } from '../../test/apoio/apiLancamentos';
import {
  criarServidorMetas,
  ID_CARRO,
  ID_VIAGEM,
  instalarApiMetas,
  preAquecerMetas,
  type ServidorMetas,
} from '../../test/apoio/apiMetas';

/**
 * Detalhe da meta (etapa 12, lote 4). Critérios: RN-08 (resumo, por local, histórico), CA-08.5 (a conta só nas linhas do
 * próprio autor), CA-09.5 e RT-01 (meta inexistente ou alheia dá a mesma resposta). `GET /api/metas/:id` devolve a meta
 * com `por_local`; `GET /api/metas/:id/movimentos`, do mais recente ao mais antigo.
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

const VIAGEM = `/app/metas/${ID_VIAGEM}`;
const CARRO = `/app/metas/${ID_CARRO}`;

function adicionarCarro() {
  servidor.metas.push({
    id: ID_CARRO,
    nome: 'Carro novo',
    escopo: 'individual',
    alvo: 2000000,
    prazo: '2028-12',
    doOutro: false,
  });
}

/** O estado de "não existe mais" é um `alert`; a região de avisos tem o seu próprio, vazio. */
async function alertaNaoExiste(): Promise<HTMLElement> {
  const titulo = await screen.findByRole('heading', { name: 'Esta meta não existe mais' });
  return titulo.closest('[role="alert"]') as HTMLElement;
}

function valorDaLinha(termo: string): string | null | undefined {
  return screen.getByText(termo, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('Meta: resumo', () => {
  it('título é o nome e o escopo aparece como selo; pede a meta e os movimentos', async () => {
    montarApp(VIAGEM);

    expect(await screen.findByRole('heading', { level: 1, name: 'Viagem Nordeste' })).toBeInTheDocument();
    expect(screen.getByText('Meta da casa')).toBeInTheDocument();
    expect(screen.getByText(/visível aos dois/)).toBeInTheDocument();
    await screen.findByRole('region', { name: 'Histórico' });
    expect(chamadasA(servidor, 'GET', `/api/metas/${ID_VIAGEM}`).map((c) => c.url)).toEqual(
      expect.arrayContaining([`/api/metas/${ID_VIAGEM}`, `/api/metas/${ID_VIAGEM}/movimentos`]),
    );
  });

  it('"Faltam" mostra o valor, o percentual e a barra como o servidor calculou', async () => {
    montarApp(VIAGEM);

    const resumo = await screen.findByRole('region', { name: 'Faltam' });
    expect(within(resumo).getByText('R$ 5.800,00')).toBeInTheDocument();
    expect(within(resumo).getByText('52%')).toBeInTheDocument();
    const barra = within(resumo).getByRole('progressbar', { name: 'Viagem Nordeste' });
    expect(barra).toHaveAttribute('aria-valuenow', '52');
    expect(barra.className).toMatch(/barra-casa/);
  });

  it('linhas de guardado, alvo, prazo e necessário por mês', async () => {
    montarApp(VIAGEM);

    await screen.findByRole('region', { name: 'Faltam' });
    expect(valorDaLinha('Guardado')).toBe('R$ 6.200,00');
    expect(valorDaLinha('Alvo')).toBe('R$ 12.000,00');
    expect(valorDaLinha('Prazo')).toBe('jul/2027');
    expect(valorDaLinha('Necessário por mês')).toBe('R$ 644,45');
  });

  it('sem prazo omite as linhas de prazo e de necessário por mês', async () => {
    servidor.metas.find((m) => m.id === ID_VIAGEM)!.prazo = null;
    montarApp(VIAGEM);

    await screen.findByRole('region', { name: 'Faltam' });
    expect(screen.queryByText('Prazo', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText('Necessário por mês', { selector: 'dt' })).not.toBeInTheDocument();
  });

  it('"Onde está guardado" lista os locais com o valor de cada um, do maior para o menor', async () => {
    montarApp(VIAGEM);

    const onde = await screen.findByRole('region', { name: 'Onde está guardado' });
    const itens = within(onde).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    // Caixinha: 3.000 + 500 + 500 + 500 − 300 = 4.200. CDB: 1.300 + 700 = 2.000.
    expect(itens[0]).toHaveTextContent('Caixinha Nubank');
    expect(itens[0]).toHaveTextContent('R$ 4.200,00');
    expect(itens[1]).toHaveTextContent('CDB Banco Inter');
    expect(itens[1]).toHaveTextContent('R$ 2.000,00');
  });
});

describe('Meta: ações', () => {
  it('Aportar e Retirar abrem a folha pela URL; Editar leva ao formulário', async () => {
    montarApp(VIAGEM);

    const resumo = await screen.findByRole('region', { name: 'Faltam' });
    expect(within(resumo).getByRole('link', { name: 'Aportar' })).toHaveAttribute(
      'href',
      `/app/metas/${ID_VIAGEM}?movimentar=aporte`,
    );
    expect(within(resumo).getByRole('link', { name: 'Retirar' })).toHaveAttribute(
      'href',
      `/app/metas/${ID_VIAGEM}?movimentar=retirada`,
    );
    expect(screen.getByRole('link', { name: 'Editar meta' })).toHaveAttribute('href', `/app/metas/${ID_VIAGEM}/editar`);
  });

  it('o botão voltar leva à lista em /app/metas', async () => {
    montarApp(VIAGEM);

    await screen.findByRole('region', { name: 'Faltam' });
    expect(screen.getByRole('link', { name: 'Voltar para Metas' })).toHaveAttribute('href', '/app/metas');
  });
});

describe('Meta: histórico', () => {
  it('lista os 7 movimentos do mais recente ao mais antigo, com autor, data e local', async () => {
    montarApp(VIAGEM);

    const historico = await screen.findByRole('region', { name: 'Histórico' });
    const itens = within(historico).getAllByRole('listitem');
    expect(itens).toHaveLength(7);
    expect(itens[0]).toHaveTextContent('Aporte · Ana');
    expect(itens[0]).toHaveTextContent('05/10/2026');
    expect(itens[0]).toHaveTextContent('Caixinha Nubank');
    expect(itens[1]).toHaveTextContent('Aporte · Beatriz');
    expect(itens[1]).toHaveTextContent('20/09/2026');
    expect(itens[1]).toHaveTextContent('CDB Banco Inter');
    expect(itens[5]).toHaveTextContent('Retirada · Beatriz');
    expect(itens[6]).toHaveTextContent('+ R$ 3.000,00');
    expect(
      within(historico).getByText('A conta de origem ou destino aparece só nos seus movimentos.'),
    ).toBeInTheDocument();
  });

  it('CA-08.5: "da conta Nubank" só nas 4 linhas da própria pessoa; as da outra não têm conta', async () => {
    montarApp(VIAGEM);

    const historico = await screen.findByRole('region', { name: 'Histórico' });
    const itens = within(historico).getAllByRole('listitem');
    const comConta = itens.filter((li) => /da conta Nubank/.test(li.textContent ?? ''));
    expect(comConta).toHaveLength(4);
    for (const li of comConta) expect(li).toHaveTextContent('Ana');
    for (const li of itens.filter((l) => /Beatriz/.test(l.textContent ?? ''))) {
      expect(li).not.toHaveTextContent('da conta');
    }
  });

  it('aporte com "+" e cor de receita; retirada com "−" sem cor de receita', async () => {
    montarApp(VIAGEM);

    const historico = await screen.findByRole('region', { name: 'Histórico' });
    expect(within(historico).getByText('− R$ 300,00').className).not.toMatch(/valor-receita/);
    expect(within(historico).getByText('+ R$ 3.000,00').className).toMatch(/valor-receita/);
  });
});

describe('Meta: vazio', () => {
  it('meta individual sem movimentos: "Minha meta", estado vazio com Aportar e sem Retirar', async () => {
    adicionarCarro();
    montarApp(CARRO);

    expect(await screen.findByRole('heading', { level: 1, name: 'Carro novo' })).toBeInTheDocument();
    expect(screen.getByText('Minha meta')).toBeInTheDocument();
    expect(screen.getByText(/só você vê/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Carro novo' }).className).toMatch(/barra-eu/);
    expect(await screen.findByRole('heading', { name: 'Nenhum aporte ainda' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aportar' })).toHaveAttribute(
      'href',
      `/app/metas/${ID_CARRO}?movimentar=aporte`,
    );
    expect(screen.queryByRole('link', { name: 'Retirar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Onde está guardado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Histórico' })).not.toBeInTheDocument();
  });

  it('meta nova nasce com guardado 0 e percentual 0 (CA-08.1)', async () => {
    adicionarCarro();
    montarApp(CARRO);

    await screen.findByRole('region', { name: 'Faltam' });
    expect(valorDaLinha('Guardado')).toBe('R$ 0,00');
    expect(within(screen.getByRole('region', { name: 'Faltam' })).getByText('0%')).toBeInTheDocument();
  });
});

describe('Meta: carregando e erro', () => {
  it('carregando: título "Meta", aviso para leitor de tela e sem "Editar meta"', async () => {
    servidor.atrasos.set(`GET /api/metas/:id`, 600);
    montarApp(VIAGEM);

    expect(await screen.findByText('Carregando a meta…')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Meta' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar meta' })).not.toBeInTheDocument();
  });

  it('meta inexistente ou alheia mostra "Esta meta não existe mais" com o voltar para /app/metas', async () => {
    montarApp(`/app/metas/${ID_CARRO}`);

    const alerta = await alertaNaoExiste();
    expect(within(alerta).getByText('Ela pode ter sido excluída.')).toBeInTheDocument();
    expect(within(alerta).getByRole('link', { name: 'Voltar para Metas' })).toHaveAttribute('href', '/app/metas');
    expect(screen.queryByRole('link', { name: 'Editar meta' })).not.toBeInTheDocument();
  });

  it('id de rota que não é uuid não chama a API e mostra "Esta meta não existe mais"', async () => {
    montarApp('/app/metas/abc');

    await alertaNaoExiste();
    expect(chamadasA(servidor, 'GET', '/api/metas/abc')).toEqual([]);
  });

  it('erro do servidor sem dado mostra o erro padrão, não "não existe mais"', async () => {
    servidor.falhas.set('GET /api/metas/:id', { status: 500, code: 'erro_interno' });
    montarApp(VIAGEM);

    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument();
    expect(screen.queryByText('Esta meta não existe mais')).not.toBeInTheDocument();
  });
});
