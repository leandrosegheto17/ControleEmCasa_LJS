import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  conta,
  criarServidor,
  escritas,
  ID_INTER,
  ID_NUBANK,
  instalarApi,
  limparAparelho,
  preAquecerPaginas,
  montarApp,
  UUID_V4,
  type Servidor,
} from '../../test/apoio/apiCadastros';

/**
 * Contas (RN-03, RN-12): lista, cadastro, edição, ajuste de saldo e exclusão contra a API simulada (`/api/contas`).
 * Os critérios vêm do PRD-TECNICO (RN-03, RN-12, CA-T3.4) e do SDD 6.1; nada vem do código das telas.
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

describe('lista de Contas', () => {
  it('mostra cada conta com o saldo que a API devolveu (RN-12) e só as não arquivadas', async () => {
    servidor.contas.push(conta({ id: '00000000-0000-4000-8000-000000000209', nome: 'Antiga', arquivada: true }));
    montarApp('/app/ajustes/contas');

    expect(await screen.findByText('Nubank')).toBeInTheDocument();
    expect(screen.getByText('R$ 3.214,85')).toBeInTheDocument();
    expect(screen.getByText('Inter')).toBeInTheDocument();
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
    expect(screen.queryByText('Antiga')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nubank/ })).toHaveAttribute('href', `/app/ajustes/contas/${ID_NUBANK}`);
  });

  it('"Mostrar arquivadas" revela as arquivadas com a marca "Arquivada"', async () => {
    servidor.contas.push(conta({ id: '00000000-0000-4000-8000-000000000209', nome: 'Antiga', arquivada: true }));
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/contas');

    await usuario.click(await screen.findByLabelText('Mostrar arquivadas'));

    expect(screen.getByText('Antiga')).toBeInTheDocument();
    expect(screen.getByText('Arquivada')).toBeInTheDocument();
  });

  it('sem contas mostra o estado vazio com o atalho "Nova conta"', async () => {
    servidor.contas = [];
    montarApp('/app/ajustes/contas');

    expect(await screen.findByText('Nenhuma conta cadastrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova conta' })).toHaveAttribute('href', '/app/ajustes/contas/nova');
  });

  it('falha ao carregar mostra o erro com "Tentar de novo", que refaz a consulta', async () => {
    servidor.erros.set('GET /api/contas', { status: 503, code: 'indisponivel' });
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/contas');

    expect(await screen.findByText('Não foi possível carregar')).toBeInTheDocument();
    servidor.erros.clear();
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByText('Nubank')).toBeInTheDocument();
  });
});

describe('conta nova', () => {
  it('salva com PUT no id gerado no cliente, avisa e volta à lista já com a conta', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/contas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Caixa');
    await usuario.type(screen.getByLabelText('Saldo inicial'), '10000');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Conta salva')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Contas' })).toBeInTheDocument();
    expect(await screen.findByText('Caixa')).toBeInTheDocument();
    const [escrita] = escritas(servidor);
    expect(escrita?.metodo).toBe('PUT');
    expect(escrita?.url).toMatch(new RegExp(`^/api/contas/${UUID_V4.source.slice(1, -1)}$`, 'i'));
    expect(escrita?.corpo).toEqual({ nome: 'Caixa', saldo_inicial_centavos: 10000 });
    expect(escrita?.cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('nome vazio mostra o erro no campo e não chama a API (RN-18)', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/contas/nova');

    await usuario.click(await screen.findByRole('button', { name: 'Salvar' }));

    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    expect(escritas(servidor)).toHaveLength(0);
  });

  it('sem rede avisa, mantém os campos e o reenvio usa o MESMO id (escrita idempotente, CA-T3.4)', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/contas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Inter 2');
    servidor.semRede = true;
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(alertaCom('Sem conexão')).toBeDefined());
    expect(screen.getByLabelText('Nome')).toHaveValue('Inter 2');

    servidor.semRede = false;
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    // Os avisos entram um por vez: o "Sem conexão" ainda está na tela; o resultado se vê na lista.
    expect(await screen.findByText('Inter 2')).toBeInTheDocument();

    const urls = escritas(servidor).map((c) => c.url);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toBe(urls[0]);
  });

  it('saldo_inicial recusado pela API (valor_invalido) aparece no campo Saldo inicial', async () => {
    servidor.erros.set('PUT /api/contas/:id', { status: 400, code: 'valor_invalido' });
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/contas/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Caixa');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.getByLabelText('Saldo inicial')).toHaveAttribute('aria-invalid', 'true'));
  });
});

describe('edição de conta', () => {
  it('mostra nome e saldo inicial editáveis e o saldo atual só leitura', async () => {
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);

    expect(await screen.findByLabelText('Nome')).toHaveValue('Nubank');
    expect(screen.getByLabelText('Saldo inicial')).toHaveValue('R$ 2.500,00');
    expect(screen.getByRole('heading', { name: 'Saldo atual' })).toBeInTheDocument();
    expect(screen.getByText('R$ 3.214,85').closest('input')).toBeNull();
  });

  it('salvar envia PUT no id da conta com o nome novo', async () => {
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);

    const nome = await screen.findByLabelText('Nome');
    await usuario.clear(nome);
    await usuario.type(nome, 'Nubank PJ');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Conta salva')).toBeInTheDocument();
    expect(escritas(servidor)[0]).toMatchObject({
      metodo: 'PUT',
      url: `/api/contas/${ID_NUBANK}`,
      corpo: { nome: 'Nubank PJ', saldo_inicial_centavos: 250000 },
    });
  });

  it('id que não é da pessoa (ou não existe) mostra "Esta conta não existe mais" (CA-T1.2)', async () => {
    montarApp('/app/ajustes/contas/00000000-0000-4000-8000-0000000009ff');

    expect(await screen.findByText(/Esta conta não existe mais/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument();
  });

  it('id malformado vale como inexistente, sem consultar a API', async () => {
    montarApp('/app/ajustes/contas/abc');

    expect(await screen.findByText(/Esta conta não existe mais/)).toBeInTheDocument();
    expect(servidor.chamadas.filter((c) => c.url === '/api/contas')).toHaveLength(0);
  });

  it('"Arquivar" faz POST em /arquivar, avisa e volta à lista sem a conta (RN-03)', async () => {
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_INTER}`);

    await usuario.click(await screen.findByRole('button', { name: 'Arquivar' }));

    expect(await screen.findByText('Conta arquivada')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Inter')).not.toBeInTheDocument());
    expect(escritas(servidor)[0]).toMatchObject({ metodo: 'POST', url: `/api/contas/${ID_INTER}/arquivar` });
  });
});

describe('ajuste de saldo (RN-12)', () => {
  it('ao digitar o saldo real pede a diferença com simular=true e a mostra, sem gravar', async () => {
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);

    await usuario.type(await screen.findByLabelText('Saldo que aparece no banco'), '320255');

    const nota = await screen.findByText(/Não conta como receita nem despesa/);
    expect(nota.closest('[role="status"]')).toHaveTextContent('Ajuste de − R$ 12,30');
    const ultima = escritas(servidor).at(-1);
    expect(ultima).toMatchObject({ url: `/api/contas/${ID_NUBANK}/ajuste`, corpo: { simular: true } });
    expect(servidor.contas[0]?.saldo_centavos).toBe(321485);
  });

  it('"Ajustar saldo" grava (simular=false), avisa e o saldo atual passa a ser o real', async () => {
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);

    await usuario.type(await screen.findByLabelText('Saldo que aparece no banco'), '320255');
    await usuario.click(screen.getByRole('button', { name: 'Ajustar saldo' }));

    expect(await screen.findByText('Saldo ajustado')).toBeInTheDocument();
    const gravacao = escritas(servidor).find((c) => c.corpo?.simular === false);
    expect(gravacao).toMatchObject({ metodo: 'POST', corpo: { saldo_real_centavos: 320255, simular: false } });
    expect(await screen.findAllByText('R$ 3.202,55')).not.toHaveLength(0);
  });

  it('?saldo_real=<centavos> na URL já abre o campo preenchido e a prévia', async () => {
    montarApp(`/app/ajustes/contas/${ID_NUBANK}?saldo_real=320255`);

    expect(await screen.findByLabelText('Saldo que aparece no banco')).toHaveValue('R$ 3.202,55');
    expect(await screen.findByText(/Não conta como receita nem despesa/)).toBeInTheDocument();
  });
});

describe('excluir conta (CA-03.5)', () => {
  const confirmarExclusao = async (usuario: ReturnType<typeof userEvent.setup>) => {
    await usuario.click(await screen.findByRole('button', { name: /Excluir/ }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(
      within(dialogo)
        .getAllByRole('button')
        .find((b) => !/Cancelar/.test(b.textContent ?? ''))!,
    );
  };

  it('sem vínculos (pode_excluir) o botão existe; com vínculos ele não aparece', async () => {
    servidor.contas[1] = conta({ id: ID_INTER, nome: 'Inter', pode_excluir: true });
    const { unmount } = montarApp(`/app/ajustes/contas/${ID_NUBANK}`);
    await screen.findByLabelText('Nome');
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
    unmount();

    montarApp(`/app/ajustes/contas/${ID_INTER}`);
    expect(await screen.findByRole('button', { name: /Excluir/ })).toBeInTheDocument();
  });

  it('cancelar no diálogo não exclui', async () => {
    servidor.contas[0] = conta({ pode_excluir: true });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);

    await usuario.click(await screen.findByRole('button', { name: /Excluir/ }));
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));

    expect(escritas(servidor)).toHaveLength(0);
  });

  it('confirmando, faz DELETE, avisa e a conta some da lista', async () => {
    servidor.contas[0] = conta({ pode_excluir: true });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);

    await confirmarExclusao(usuario);

    expect(await screen.findByText('Conta excluída')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Nubank')).not.toBeInTheDocument());
    expect(escritas(servidor)[0]).toMatchObject({ metodo: 'DELETE', url: `/api/contas/${ID_NUBANK}` });
  });

  it('em_uso da API mostra o aviso e oferece "Arquivar conta"; "Cancelar" volta ao formulário', async () => {
    servidor.contas[0] = conta({ pode_excluir: true });
    servidor.erros.set('DELETE /api/contas/:id', { status: 409, code: 'em_uso' });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);

    await confirmarExclusao(usuario);

    await waitFor(() => expect(alertaCom(/Esta conta tem lançamentos/)).toBeDefined());
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(alertaCom(/Esta conta tem lançamentos/)).toBeUndefined();
  });

  it('em_uso e depois "Arquivar conta" arquiva pela API', async () => {
    servidor.contas[0] = conta({ pode_excluir: true });
    servidor.erros.set('DELETE /api/contas/:id', { status: 409, code: 'em_uso' });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);

    await confirmarExclusao(usuario);
    await usuario.click(await screen.findByRole('button', { name: 'Arquivar conta' }));

    expect(await screen.findByText('Conta arquivada')).toBeInTheDocument();
    expect(escritas(servidor).at(-1)).toMatchObject({ url: `/api/contas/${ID_NUBANK}/arquivar` });
  });

  it('excluir sem rede avisa e mantém a tela', async () => {
    servidor.contas[0] = conta({ pode_excluir: true });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/contas/${ID_NUBANK}`);
    await screen.findByLabelText('Nome');
    servidor.semRede = true;

    await confirmarExclusao(usuario);

    await waitFor(() => expect(alertaCom('Sem conexão')).toBeDefined());
    expect(screen.getByLabelText('Nome')).toHaveValue('Nubank');
  });
});
