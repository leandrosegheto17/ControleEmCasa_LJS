import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cartao,
  conta,
  criarServidor,
  escritas,
  forma,
  ID_INTER,
  ID_NUBANK,
  ID_NUBANK_CREDITO,
  ID_PIX,
  instalarApi,
  limparAparelho,
  preAquecerPaginas,
  montarApp,
  UUID_V4,
  type Servidor,
} from '../../test/apoio/apiCadastros';
import { hojeEmSaoPaulo } from '../formatacao/data';

/**
 * Formas de pagamento (RN-03, RN-13): lista, cadastro, edição, preferida, arquivar, excluir e pagamento do cartão
 * contra a API simulada (`/api/formas`). Critérios do PRD-TECNICO e do SDD 6.1 (#9 a #15).
 */

let servidor: Servidor;

beforeAll(preAquecerPaginas, 30_000);

beforeEach(async () => {
  servidor = criarServidor();
  instalarApi(servidor);
  await limparAparelho();
});
afterEach(() => vi.unstubAllGlobals());

const alertaCom = (texto: string | RegExp) =>
  screen
    .queryAllByRole('alert')
    .find((el) => (typeof texto === 'string' ? el.textContent?.includes(texto) : texto.test(el.textContent ?? '')));

describe('lista de Formas de pagamento', () => {
  it('mostra Pix com a conta e o cartão com o vencimento e os totais devolvidos pela API (RN-13)', async () => {
    montarApp('/app/ajustes/formas');

    expect(await screen.findByText('Pix Nubank')).toBeInTheDocument();
    expect(screen.getByText('conta Nubank')).toBeInTheDocument();
    expect(screen.getByText('Nubank Crédito')).toBeInTheDocument();
    expect(screen.getByText('vence dia 10')).toBeInTheDocument();
    expect(screen.getByText('Neste mês R$ 1.234,56')).toBeInTheDocument();
    expect(screen.getByText('Próximos meses R$ 400,00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pix Nubank/ })).toHaveAttribute('href', `/app/ajustes/formas/${ID_PIX}`);
  });

  it('a preferida leva a marca e as arquivadas não aparecem', async () => {
    servidor.formas = [
      forma({ preferida: true }),
      forma({ id: '00000000-0000-4000-8000-000000000399', nome: 'Velha', arquivada: true }),
    ];
    montarApp('/app/ajustes/formas');

    await screen.findByText('Pix Nubank');
    expect(screen.getByText('Preferida')).toBeInTheDocument();
    expect(screen.queryByText('Velha')).not.toBeInTheDocument();
  });

  it('sem formas mostra o estado vazio com o atalho "Nova forma"', async () => {
    servidor.formas = [];
    montarApp('/app/ajustes/formas');

    expect(await screen.findByText('Nenhuma forma de pagamento')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova forma' })).toHaveAttribute('href', '/app/ajustes/formas/nova');
  });
});

describe('forma nova', () => {
  it('Pix sem conta é recusado na tela (CA-03.1) e não chama a API', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/formas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Pix Inter');
    await usuario.click(screen.getByRole('button', { name: 'Criar forma' }));

    expect(screen.getByText('Escolha a conta de origem.')).toBeInTheDocument();
    expect(escritas(servidor)).toHaveLength(0);
  });

  it('Pix com conta faz PUT no id do cliente com a conta e sem dia de vencimento (RN-03)', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/formas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Pix Inter');
    await usuario.selectOptions(screen.getByLabelText('Conta de origem'), 'Inter');
    await usuario.click(screen.getByRole('button', { name: 'Criar forma' }));

    expect(await screen.findByText('Forma salva')).toBeInTheDocument();
    const [escrita] = escritas(servidor);
    expect(escrita?.metodo).toBe('PUT');
    expect(escrita?.url).toMatch(new RegExp(`^/api/formas/${UUID_V4.source.slice(1, -1)}$`, 'i'));
    expect(escrita?.corpo).toEqual({ nome: 'Pix Inter', tipo: 'pix', conta_id: ID_INTER, dia_vencimento: null });
    expect(await screen.findByText('Pix Inter')).toBeInTheDocument();
  });

  it('Crédito exige o dia de vencimento de 1 a 31 (RN-03)', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/formas/nova');

    await usuario.click(await screen.findByRole('radio', { name: 'Crédito' }));
    await usuario.type(screen.getByLabelText('Nome'), 'Inter Crédito');
    await usuario.type(screen.getByLabelText('Dia de vencimento'), '32');
    await usuario.click(screen.getByRole('button', { name: 'Criar forma' }));

    expect(screen.getByText('Informe o dia de vencimento do cartão (1 a 31).')).toBeInTheDocument();
    expect(escritas(servidor)).toHaveLength(0);
  });

  it('Crédito com dia e sem conta (opcional) envia conta_id nulo', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/formas/nova');

    await usuario.click(await screen.findByRole('radio', { name: 'Crédito' }));
    await usuario.type(screen.getByLabelText('Nome'), 'Inter Crédito');
    await usuario.type(screen.getByLabelText('Dia de vencimento'), '15');
    await usuario.click(screen.getByRole('button', { name: 'Criar forma' }));

    expect(await screen.findByText('Forma salva')).toBeInTheDocument();
    expect(escritas(servidor)[0]?.corpo).toEqual({
      nome: 'Inter Crédito',
      tipo: 'credito',
      conta_id: null,
      dia_vencimento: 15,
    });
  });

  it('marcar "Preferida" salva a forma e depois chama PUT /preferida', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/formas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Pix Inter');
    await usuario.selectOptions(screen.getByLabelText('Conta de origem'), 'Inter');
    await usuario.click(screen.getByLabelText('Preferida no lançamento rápido'));
    await usuario.click(screen.getByRole('button', { name: 'Criar forma' }));

    await screen.findByText('Forma salva');
    const [salvar, preferida] = escritas(servidor);
    expect(salvar?.metodo).toBe('PUT');
    expect(preferida).toMatchObject({ metodo: 'PUT', corpo: { preferida: true } });
    expect(preferida?.url).toBe(`${salvar?.url}/preferida`);
  });

  it('sem rede mantém os campos e o reenvio usa o MESMO id (CA-T3.4)', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/formas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Pix Inter');
    await usuario.selectOptions(screen.getByLabelText('Conta de origem'), 'Inter');
    servidor.semRede = true;
    await usuario.click(screen.getByRole('button', { name: 'Criar forma' }));
    await waitFor(() => expect(alertaCom('Sem conexão')).toBeDefined());
    expect(screen.getByLabelText('Nome')).toHaveValue('Pix Inter');

    servidor.semRede = false;
    await usuario.click(screen.getByRole('button', { name: 'Criar forma' }));
    expect(await screen.findByText('Pix Inter')).toBeInTheDocument();

    const urls = escritas(servidor).map((c) => c.url);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toBe(urls[0]);
  });
});

describe('edição de forma', () => {
  it('Pix: nome e conta preenchidos, tipo só leitura (não muda depois)', async () => {
    montarApp(`/app/ajustes/formas/${ID_PIX}`);

    expect(await screen.findByLabelText('Nome')).toHaveValue('Pix Nubank');
    await waitFor(() => expect(screen.getByLabelText('Conta de origem')).toHaveValue(ID_NUBANK));
    expect(screen.getByText('O tipo é escolhido na criação e não muda depois.')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Crédito' })).not.toBeInTheDocument();
  });

  it('Crédito: mostra o quadro do cartão com gasto do mês e próximos meses', async () => {
    montarApp(`/app/ajustes/formas/${ID_NUBANK_CREDITO}`);

    const quadro = (await screen.findByRole('heading', { level: 2, name: 'Nubank Crédito' })).closest('section')!;
    expect(within(quadro).getByText('R$ 1.234,56')).toBeInTheDocument();
    expect(within(quadro).getByText('R$ 400,00')).toBeInTheDocument();
    expect(screen.getByLabelText('Dia de vencimento')).toHaveValue('10');
  });

  it('salvar envia PUT no id da forma; sem mudar a preferida não chama /preferida', async () => {
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/formas/${ID_PIX}`);

    const nome = await screen.findByLabelText('Nome');
    await usuario.clear(nome);
    await usuario.type(nome, 'Pix principal');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Forma salva')).toBeInTheDocument();
    expect(escritas(servidor)).toHaveLength(1);
    expect(escritas(servidor)[0]).toMatchObject({
      metodo: 'PUT',
      url: `/api/formas/${ID_PIX}`,
      corpo: { nome: 'Pix principal', tipo: 'pix', conta_id: ID_NUBANK },
    });
  });

  it('desmarcar a preferida chama PUT /preferida com false', async () => {
    servidor.formas[0] = forma({ preferida: true });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/formas/${ID_PIX}`);

    await usuario.click(await screen.findByLabelText('Preferida no lançamento rápido'));
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('Forma salva');
    expect(escritas(servidor).at(-1)).toMatchObject({
      url: `/api/formas/${ID_PIX}/preferida`,
      corpo: { preferida: false },
    });
  });

  it('forma de outro membro ou inexistente mostra "não existe mais" (CA-T1.2)', async () => {
    montarApp('/app/ajustes/formas/00000000-0000-4000-8000-0000000009ff');

    expect(await screen.findByText(/Esta forma de pagamento não existe mais/)).toBeInTheDocument();
  });

  it('"Arquivar" faz POST em /arquivar e a forma sai da lista', async () => {
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/formas/${ID_PIX}`);

    await usuario.click(await screen.findByRole('button', { name: 'Arquivar' }));

    expect(await screen.findByText('Forma arquivada')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Pix Nubank')).not.toBeInTheDocument());
    expect(escritas(servidor)[0]).toMatchObject({ metodo: 'POST', url: `/api/formas/${ID_PIX}/arquivar` });
  });

  it('excluir: em_uso mostra o aviso e oferece "Arquivar forma"', async () => {
    servidor.formas[0] = forma({ pode_excluir: true });
    servidor.erros.set('DELETE /api/formas/:id', { status: 409, code: 'em_uso' });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/formas/${ID_PIX}`);

    await usuario.click(await screen.findByRole('button', { name: /Excluir/ }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(
      within(dialogo)
        .getAllByRole('button')
        .find((b) => !/Cancelar/.test(b.textContent ?? ''))!,
    );

    await waitFor(() => expect(alertaCom(/Esta forma tem lançamentos/)).toBeDefined());
    expect(screen.getByRole('button', { name: 'Arquivar forma' })).toBeInTheDocument();
  });

  it('excluir sem vínculos faz DELETE e a forma some da lista', async () => {
    servidor.formas[0] = forma({ pode_excluir: true });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/formas/${ID_PIX}`);

    await usuario.click(await screen.findByRole('button', { name: /Excluir/ }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(
      within(dialogo)
        .getAllByRole('button')
        .find((b) => !/Cancelar/.test(b.textContent ?? ''))!,
    );

    expect(await screen.findByText('Forma excluída')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Pix Nubank')).not.toBeInTheDocument());
    expect(escritas(servidor)[0]).toMatchObject({ metodo: 'DELETE', url: `/api/formas/${ID_PIX}` });
  });
});

describe('pagamento do cartão (RN-13)', () => {
  const abrir = `/app/ajustes/formas/${ID_NUBANK_CREDITO}?pagamento=1`;

  it('o link do quadro abre a folha com a conta padrão do cartão e a data de hoje', async () => {
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/formas/${ID_NUBANK_CREDITO}`);

    await usuario.click(await screen.findByRole('link', { name: 'Registrar pagamento do cartão' }));

    const folha = await screen.findByRole('dialog', { name: 'Pagamento do cartão' });
    expect(within(folha).getByLabelText('Conta de origem')).toHaveValue(ID_NUBANK);
    expect(within(folha).getByLabelText('Data')).toHaveValue(hojeEmSaoPaulo());
  });

  it('valor zero é recusado na tela e nada é enviado', async () => {
    const usuario = userEvent.setup();
    montarApp(abrir);

    const folha = await screen.findByRole('dialog', { name: 'Pagamento do cartão' });
    await usuario.click(within(folha).getByRole('button', { name: 'Registrar pagamento' }));

    expect(within(folha).getByText('Informe um valor maior que zero.')).toBeInTheDocument();
    expect(escritas(servidor)).toHaveLength(0);
  });

  it('registrar envia POST /api/formas/:id/pagamentos com id, conta, valor e data; avisa e fecha a folha', async () => {
    servidor.contas.push(conta({ id: '00000000-0000-4000-8000-000000000209', nome: 'Caixa' }));
    const usuario = userEvent.setup();
    montarApp(abrir);

    const folha = await screen.findByRole('dialog', { name: 'Pagamento do cartão' });
    await usuario.type(within(folha).getByLabelText('Valor pago'), '150000');
    await usuario.selectOptions(within(folha).getByLabelText('Conta de origem'), 'Inter');
    await usuario.click(within(folha).getByRole('button', { name: 'Registrar pagamento' }));

    expect(await screen.findByText('Pagamento registrado')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pagamento do cartão' })).not.toBeInTheDocument());
    const [escrita] = escritas(servidor);
    expect(escrita).toMatchObject({ metodo: 'POST', url: `/api/formas/${ID_NUBANK_CREDITO}/pagamentos` });
    expect(escrita?.corpo).toMatchObject({ conta_id: ID_INTER, valor_centavos: 150000 });
    expect(String(escrita?.corpo?.id)).toMatch(UUID_V4);
    expect(String(escrita?.corpo?.data)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sem rede mostra o erro na folha e o reenvio usa o MESMO id (idempotente)', async () => {
    const usuario = userEvent.setup();
    montarApp(abrir);

    const folha = await screen.findByRole('dialog', { name: 'Pagamento do cartão' });
    await usuario.type(within(folha).getByLabelText('Valor pago'), '5000');
    servidor.semRede = true;
    await usuario.click(within(folha).getByRole('button', { name: 'Registrar pagamento' }));
    await waitFor(() => expect(within(folha).getByText(/Sem conexão/)).toBeInTheDocument());

    servidor.semRede = false;
    await usuario.click(within(folha).getByRole('button', { name: 'Registrar pagamento' }));
    expect(await screen.findByText('Pagamento registrado')).toBeInTheDocument();

    const ids = escritas(servidor).map((c) => c.corpo?.id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });

  it('forma que não é crédito ignora ?pagamento=1 e limpa o parâmetro', async () => {
    const { local } = montarApp(`/app/ajustes/formas/${ID_PIX}?pagamento=1`);

    await screen.findByLabelText('Nome');
    await waitFor(() => expect(local()).toBe(`/app/ajustes/formas/${ID_PIX}`));
    expect(screen.queryByRole('dialog', { name: 'Pagamento do cartão' })).not.toBeInTheDocument();
  });

  it('sem conta ativa a folha oferece cadastrar uma conta', async () => {
    servidor.contas = [conta({ arquivada: true })];
    montarApp(abrir);

    const folha = await screen.findByRole('dialog', { name: 'Pagamento do cartão' });
    expect(within(folha).getByText('Cadastre uma conta corrente')).toBeInTheDocument();
    expect(within(folha).getByRole('link', { name: 'Cadastrar conta' })).toHaveAttribute(
      'href',
      '/app/ajustes/contas/nova',
    );
  });
});

describe('cartão sem totais', () => {
  it('lista o crédito sem totais quando a API os devolve nulos', async () => {
    servidor.formas = [cartao({ gasto_mes_centavos: null, comprometido_futuro_centavos: null })];
    montarApp('/app/ajustes/formas');

    expect(await screen.findByText('Nubank Crédito')).toBeInTheDocument();
    expect(screen.queryByText(/Neste mês/)).not.toBeInTheDocument();
  });
});
