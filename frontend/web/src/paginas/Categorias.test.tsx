import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  categoria,
  criarServidor,
  escritas,
  ID_MERCADO,
  ID_SALARIO,
  instalarApi,
  limparAparelho,
  preAquecerPaginas,
  montarApp,
  UUID_V4,
  type Servidor,
} from '../../test/apoio/apiCadastros';

/**
 * Categorias (RN-17): lista por tipo e escopo, cadastro, edição, arquivar e excluir contra a API simulada
 * (`/api/categorias`). Critérios do PRD-TECNICO RN-17 e do SDD 6.1 (#16 a #19).
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

describe('lista de Categorias', () => {
  it('mostra as despesas agrupadas por escopo e com a marca "variável"', async () => {
    servidor.categorias.push(
      categoria({
        id: '00000000-0000-4000-8000-000000000410',
        nome: 'Academia',
        escopo: 'individual',
        variavel: false,
      }),
    );
    montarApp('/app/ajustes/categorias');

    expect(await screen.findByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('variável')).toBeInTheDocument();
    expect(screen.getByText(/Da casa · os dois veem/)).toBeInTheDocument();
    expect(screen.getByText(/Minhas · só você vê/)).toBeInTheDocument();
    expect(screen.getByText('Academia')).toBeInTheDocument();
    expect(screen.queryByText('Salário')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mercado/ })).toHaveAttribute(
      'href',
      `/app/ajustes/categorias/${ID_MERCADO}`,
    );
  });

  it('o seletor de tipo troca para as receitas e guarda o tipo na URL', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes/categorias');
    await screen.findByText('Mercado');

    await usuario.click(screen.getByRole('radio', { name: 'Receitas' }));

    expect(await screen.findByText('Salário')).toBeInTheDocument();
    expect(screen.queryByText('Mercado')).not.toBeInTheDocument();
    expect(local()).toBe('/app/ajustes/categorias?tipo=receita');
  });

  it('arquivadas ficam escondidas até ligar "Mostrar arquivadas"', async () => {
    servidor.categorias.push(
      categoria({ id: '00000000-0000-4000-8000-000000000411', nome: 'Antiga', arquivada: true }),
    );
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/categorias');

    await screen.findByText('Mercado');
    expect(screen.queryByText('Antiga')).not.toBeInTheDocument();
    await usuario.click(screen.getByLabelText('Mostrar arquivadas'));

    expect(screen.getByText('Antiga')).toBeInTheDocument();
    expect(screen.getByText('Arquivada')).toBeInTheDocument();
  });

  it('sem categorias do tipo mostra o estado vazio com "Nova categoria"', async () => {
    servidor.categorias = [];
    montarApp('/app/ajustes/categorias');

    expect(await screen.findByText('Nenhuma categoria de despesa ativa')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nova categoria' })).toHaveAttribute(
      'href',
      '/app/ajustes/categorias/nova',
    );
  });
});

describe('categoria nova', () => {
  it('nome vazio mostra erro no campo e não chama a API', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/categorias/nova');

    await usuario.click(await screen.findByRole('button', { name: 'Criar categoria' }));

    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    expect(escritas(servidor)).toHaveLength(0);
  });

  it('despesa da casa, variável: PUT no id do cliente e volta à lista do tipo com a nova categoria', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/categorias/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Pet');
    await usuario.click(screen.getByRole('button', { name: 'Criar categoria' }));

    expect(await screen.findByText('Categoria salva')).toBeInTheDocument();
    expect(await screen.findByText('Pet')).toBeInTheDocument();
    const [escrita] = escritas(servidor);
    expect(escrita?.metodo).toBe('PUT');
    expect(escrita?.url).toMatch(new RegExp(`^/api/categorias/${UUID_V4.source.slice(1, -1)}$`, 'i'));
    expect(escrita?.corpo).toEqual({ nome: 'Pet', tipo: 'despesa', escopo: 'conjunto', variavel: true });
  });

  it('receita é sempre "Minha" (escopo da casa fica desabilitado) e não leva a marca de variável', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/categorias/nova');

    await usuario.click(await screen.findByRole('radio', { name: 'Receita' }));

    expect(screen.getByRole('radio', { name: 'Da casa' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Minha' })).toBeChecked();
    expect(screen.queryByLabelText(/Gasto variável/)).not.toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Nome'), 'Freela');
    await usuario.click(screen.getByRole('button', { name: 'Criar categoria' }));

    await screen.findByText('Categoria salva');
    expect(escritas(servidor)[0]?.corpo).toEqual({ nome: 'Freela', tipo: 'receita', escopo: 'individual' });
    expect(await screen.findByText('Freela')).toBeInTheDocument();
  });

  it('nome_repetido da API aparece no campo, com o texto do escopo', async () => {
    servidor.erros.set('PUT /api/categorias/:id', { status: 409, code: 'nome_repetido' });
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/categorias/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Mercado');
    await usuario.click(screen.getByRole('button', { name: 'Criar categoria' }));

    expect(await screen.findByText('Já existe uma categoria da casa com esse nome.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sem rede mantém os campos e o reenvio usa o MESMO id (CA-T3.4)', async () => {
    const usuario = userEvent.setup();
    montarApp('/app/ajustes/categorias/nova');

    await usuario.type(await screen.findByLabelText('Nome'), 'Pet');
    servidor.semRede = true;
    await usuario.click(screen.getByRole('button', { name: 'Criar categoria' }));
    await waitFor(() => expect(alertaCom('Sem conexão')).toBeDefined());
    expect(screen.getByLabelText('Nome')).toHaveValue('Pet');

    servidor.semRede = false;
    await usuario.click(screen.getByRole('button', { name: 'Criar categoria' }));
    expect(await screen.findByText('Pet')).toBeInTheDocument();

    const urls = escritas(servidor).map((c) => c.url);
    expect(urls).toHaveLength(2);
    expect(urls[1]).toBe(urls[0]);
  });
});

describe('edição de categoria', () => {
  it('tipo e escopo são só leitura e o nome é editável', async () => {
    montarApp(`/app/ajustes/categorias/${ID_MERCADO}`);

    expect(await screen.findByLabelText('Nome')).toHaveValue('Mercado');
    expect(screen.getByText('Escolhidos na criação. Mudanças no nome valem para os dois.')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Receita' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Gasto variável/)).toBeChecked();
  });

  it('salvar envia PUT no id da categoria e volta à lista do tipo', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(`/app/ajustes/categorias/${ID_SALARIO}`);

    const nome = await screen.findByLabelText('Nome');
    await usuario.clear(nome);
    await usuario.type(nome, 'Salário CLT');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Categoria salva')).toBeInTheDocument();
    expect(escritas(servidor)[0]).toMatchObject({
      metodo: 'PUT',
      url: `/api/categorias/${ID_SALARIO}`,
      corpo: { nome: 'Salário CLT', tipo: 'receita', escopo: 'individual' },
    });
    await waitFor(() => expect(local()).toBe('/app/ajustes/categorias?tipo=receita'));
  });

  it('categoria inexistente ou individual do outro membro mostra "não existe mais" (CA-T1.2)', async () => {
    montarApp('/app/ajustes/categorias/00000000-0000-4000-8000-0000000009ff');

    expect(await screen.findByText('Esta categoria não existe mais')).toBeInTheDocument();
  });

  it('"Arquivar" faz POST em /arquivar e a categoria sai da lista', async () => {
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/categorias/${ID_MERCADO}`);

    await usuario.click(await screen.findByRole('button', { name: 'Arquivar' }));

    expect(await screen.findByText('Categoria arquivada')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Mercado')).not.toBeInTheDocument());
    expect(escritas(servidor)[0]).toMatchObject({ metodo: 'POST', url: `/api/categorias/${ID_MERCADO}/arquivar` });
  });

  it('excluir com vínculos (categoria_em_uso) mostra o aviso e oferece "Arquivar categoria"', async () => {
    servidor.categorias[0] = categoria({ pode_excluir: true });
    servidor.erros.set('DELETE /api/categorias/:id', { status: 409, code: 'categoria_em_uso' });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/categorias/${ID_MERCADO}`);

    await usuario.click(await screen.findByRole('button', { name: /Excluir/ }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(
      within(dialogo)
        .getAllByRole('button')
        .find((b) => !/Cancelar/.test(b.textContent ?? ''))!,
    );

    await waitFor(() => expect(alertaCom(/Esta categoria tem lançamentos/)).toBeDefined());
    await usuario.click(screen.getByRole('button', { name: 'Arquivar categoria' }));
    expect(await screen.findByText('Categoria arquivada')).toBeInTheDocument();
  });

  it('excluir sem vínculos faz DELETE e a categoria some', async () => {
    servidor.categorias[0] = categoria({ pode_excluir: true });
    const usuario = userEvent.setup();
    montarApp(`/app/ajustes/categorias/${ID_MERCADO}`);

    await usuario.click(await screen.findByRole('button', { name: /Excluir/ }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(
      within(dialogo)
        .getAllByRole('button')
        .find((b) => !/Cancelar/.test(b.textContent ?? ''))!,
    );

    expect(await screen.findByText('Categoria excluída')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Mercado')).not.toBeInTheDocument());
    expect(escritas(servidor)[0]).toMatchObject({ metodo: 'DELETE', url: `/api/categorias/${ID_MERCADO}` });
  });

  it('sem vínculos o botão Excluir só aparece quando a API diz que pode', async () => {
    montarApp(`/app/ajustes/categorias/${ID_MERCADO}`);

    await screen.findByLabelText('Nome');
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
  });
});
