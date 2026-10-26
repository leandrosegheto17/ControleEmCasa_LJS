import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { escritas, limparAparelho, montarApp, preAquecerPaginas, UUID_V4 } from '../../test/apoio/apiCadastros';
import {
  criarServidorMetas,
  ID_VIAGEM,
  instalarApiMetas,
  preAquecerMetas,
  type ServidorMetas,
} from '../../test/apoio/apiMetas';

/**
 * Formulário de meta, criar e editar (etapa 12, lote 4). Critérios: RN-08, CA-08.1 (nasce com guardado 0), CA-08.2 (o
 * escopo só vale na criação; na edição não é enviado), CA-08.4 (reduzir o alvo abaixo do guardado atinge a meta; aumentar
 * desfaz), ADR-010 (id do cliente: a nova meta usa o mesmo id em todas as tentativas). `PUT /api/metas/:id` devolve `{ id }`.
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

const EDITAR = `/app/metas/${ID_VIAGEM}/editar`;
const puts = () => escritas(servidor).filter((c) => c.metodo === 'PUT');

describe('Editar meta', () => {
  it('carrega nome, alvo e prazo e mostra o escopo só como texto', async () => {
    montarApp(EDITAR);

    expect(await screen.findByLabelText('Nome')).toHaveValue('Viagem Nordeste');
    expect(screen.getByRole('heading', { level: 1, name: 'Editar meta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Valor-alvo')).toHaveValue('R$ 12.000,00');
    // O servidor expõe o prazo como AAAA-MM; é o valor do campo de mês.
    expect(screen.getByLabelText('Prazo (opcional)')).toHaveValue('2027-07');
    expect(screen.getByText('Da casa')).toBeInTheDocument();
    expect(
      screen.getByText('O escopo é escolhido na criação e não muda depois, para não expor o histórico.'),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Voltar para a meta' })).toHaveAttribute('href', `/app/metas/${ID_VIAGEM}`);
  });

  it('salvar envia PUT /api/metas/:id com nome, alvo e prazo no dia 1, sem escopo, e volta ao detalhe', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(EDITAR);

    const nome = await screen.findByLabelText('Nome');
    await usuario.clear(nome);
    await usuario.type(nome, 'Viagem Bahia');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Meta salva')).toBeInTheDocument();
    await waitFor(() => expect(local()).toBe(`/app/metas/${ID_VIAGEM}`));
    expect(puts()).toHaveLength(1);
    expect(puts()[0]).toMatchObject({
      url: `/api/metas/${ID_VIAGEM}`,
      corpo: { nome: 'Viagem Bahia', alvo_centavos: 1200000, prazo: '2027-07-01' },
    });
    expect(puts()[0]!.corpo).not.toHaveProperty('escopo');
    expect(puts()[0]!.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    expect(servidor.metas.find((m) => m.id === ID_VIAGEM)?.nome).toBe('Viagem Bahia');
  });

  it('prazo apagado remove o prazo da meta (não envia a chave)', async () => {
    const usuario = userEvent.setup();
    montarApp(EDITAR);

    fireEvent.change(await screen.findByLabelText('Prazo (opcional)'), { target: { value: '' } });
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Meta salva');
    expect(puts()[0]!.corpo).not.toHaveProperty('prazo');
    expect(servidor.metas.find((m) => m.id === ID_VIAGEM)?.prazo).toBeNull();
  });

  it('CA-08.4: reduzir o alvo abaixo do guardado deixa a meta atingida', async () => {
    const usuario = userEvent.setup();
    montarApp(EDITAR);

    const alvo = await screen.findByLabelText('Valor-alvo');
    await usuario.clear(alvo);
    await usuario.type(alvo, '500000');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    // Volta ao detalhe: guardado 6.200,00 contra alvo 5.000,00.
    const resumo = await screen.findByRole('region', { name: 'Faltam' });
    expect(within(resumo).getByText('R$ 0,00')).toBeInTheDocument();
    expect(within(resumo).getByRole('progressbar', { name: 'Viagem Nordeste' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
  });

  it('sem rede avisa, mantém os campos e reenvia com o mesmo id', async () => {
    const usuario = userEvent.setup();
    montarApp(EDITAR);

    const nome = await screen.findByLabelText('Nome');
    await usuario.clear(nome);
    await usuario.type(nome, 'Viagem Bahia');
    servidor.semRede = true;
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText(/Sem conexão/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Viagem Bahia');

    servidor.semRede = false;
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    await screen.findByText('Meta salva');
    expect(servidor.chamadas.filter((c) => c.metodo === 'PUT').map((c) => c.url)).toEqual([
      `/api/metas/${ID_VIAGEM}`,
      `/api/metas/${ID_VIAGEM}`,
    ]);
  });

  it('meta inexistente ou alheia mostra "Esta meta não existe mais"', async () => {
    servidor.metas = servidor.metas.filter((m) => m.id !== ID_VIAGEM);
    montarApp(EDITAR);

    expect(await screen.findByRole('heading', { name: 'Esta meta não existe mais' })).toBeInTheDocument();
    expect(screen.getByText('Ela pode ter sido excluída.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });
});

describe('Nova meta', () => {
  it('mostra o escopo como escolha, com "Minha" marcada por padrão, e o texto de ajuda', async () => {
    montarApp('/app/metas/nova');

    expect(await screen.findByRole('heading', { level: 1, name: 'Nova meta' })).toBeInTheDocument();
    const grupo = screen.getByRole('group', { name: 'Escopo' });
    expect(within(grupo).getByRole('radio', { name: 'Minha' })).toBeChecked();
    expect(within(grupo).getByRole('radio', { name: 'Da casa' })).not.toBeChecked();
    expect(
      screen.getByText(
        'Minha: só você vê. Da casa: os dois veem alvo, guardado, aportes e onde está guardado. Não muda depois.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar meta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para Metas' })).toHaveAttribute('href', '/app/metas');
  });

  it('?escopo=casa vem com "Da casa" marcada; ?escopo=eu, com "Minha"', async () => {
    const { unmount } = montarApp('/app/metas/nova?escopo=casa');
    expect(await screen.findByRole('radio', { name: 'Da casa' })).toBeChecked();
    unmount();

    montarApp('/app/metas/nova?escopo=eu');
    expect(await screen.findByRole('radio', { name: 'Minha' })).toBeChecked();
  });

  it('criar envia nome, alvo, prazo e o escopo escolhido, com id novo; vai ao detalhe com guardado 0 (CA-08.1)', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/metas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Carro novo');
    await usuario.type(screen.getByLabelText('Valor-alvo'), '2000000');
    fireEvent.change(screen.getByLabelText('Prazo (opcional)'), { target: { value: '2028-12' } });
    await usuario.click(screen.getByRole('radio', { name: 'Da casa' }));
    await usuario.click(screen.getByRole('button', { name: 'Criar meta' }));

    expect(await screen.findByText('Meta salva')).toBeInTheDocument();
    const put = puts()[0]!;
    expect(put.corpo).toEqual({
      nome: 'Carro novo',
      alvo_centavos: 2000000,
      prazo: '2028-12-01',
      escopo: 'conjunto',
    });
    const id = put.url.replace('/api/metas/', '');
    expect(id).toMatch(UUID_V4);
    await waitFor(() => expect(local()).toBe(`/app/metas/${id}`));
    const resumo = await screen.findByRole('region', { name: 'Faltam' });
    expect(within(resumo).getByText('Guardado').nextElementSibling).toHaveTextContent('R$ 0,00');
    expect(within(resumo).getByText('0%')).toBeInTheDocument();
  });

  it('padrão "Minha" envia escopo individual e, sem prazo, não envia a chave', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/metas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Notebook');
    await usuario.type(screen.getByLabelText('Valor-alvo'), '600000');
    await usuario.click(screen.getByRole('button', { name: 'Criar meta' }));

    await screen.findByText('Meta salva');
    expect(puts()[0]!.corpo).toEqual({ nome: 'Notebook', alvo_centavos: 600000, escopo: 'individual' });
  });

  it('alvo zero mostra o erro no campo e põe o foco nele, sem enviar', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/metas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Carro novo');
    await usuario.click(screen.getByRole('button', { name: 'Criar meta' }));

    const alvo = screen.getByLabelText('Valor-alvo');
    expect(await screen.findByText('Informe um valor-alvo maior que zero.')).toBeInTheDocument();
    expect(alvo).toHaveAttribute('aria-invalid', 'true');
    expect(alvo).toHaveFocus();
    expect(puts()).toHaveLength(0);
  });

  it('nome vazio mostra erro e põe o foco no nome, sem enviar', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/metas/nova');

    await usuario.type(await screen.findByLabelText('Valor-alvo'), '600000');
    await usuario.click(screen.getByRole('button', { name: 'Criar meta' }));

    expect(await screen.findByText('Informe o nome da meta.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveFocus();
    expect(puts()).toHaveLength(0);
  });

  it('ADR-010: duas tentativas da mesma criação usam o mesmo id e criam uma só meta', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/metas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Notebook');
    await usuario.type(screen.getByLabelText('Valor-alvo'), '600000');
    servidor.semRede = true;
    await usuario.click(screen.getByRole('button', { name: 'Criar meta' }));
    expect(await screen.findByText(/Sem conexão/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Notebook');
    expect(screen.getByLabelText('Valor-alvo')).toHaveValue('R$ 6.000,00');

    servidor.semRede = false;
    await usuario.click(screen.getByRole('button', { name: 'Criar meta' }));
    await screen.findByText('Meta salva');

    const ids = servidor.chamadas.filter((c) => c.metodo === 'PUT').map((c) => c.url);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(servidor.metas.filter((m) => m.nome === 'Notebook')).toHaveLength(1);
  });
});
