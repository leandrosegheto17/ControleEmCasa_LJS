import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { escritas, limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  criarServidorMetas,
  ID_CONVITE,
  instalarApiMetas,
  preAquecerMetas,
  type ServidorMetas,
} from '../../test/apoio/apiMetas';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { ligarPerdaDeSessao } from '../sessaoGlobal';

/**
 * Membros e convite do lar (etapa 12, lote 4). Critérios: RN-22 (lar com titular, no máximo dois membros), RN-23 e
 * CA-23.1, CA-23.2 (só o titular convida), CA-23.7 (o titular não convida o próprio e-mail), CA-23.8 (convite no Free),
 * `lar_cheio` e `convite_pendente` (409). `GET /api/lar` devolve o convite pendente só ao titular; a tela nunca recebe nem
 * mostra o token.
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

const LAR = '/app/ajustes/lar';

/**
 * Segura a resposta do `fetch` simulado para `metodo url` até `soltar()`, para o estado "em andamento" ser observado
 * sem depender de tempo (um atraso fixo fica curto quando a suíte inteira roda em paralelo).
 */
function segurar(metodo: string, url: string): () => void {
  let soltar = () => {};
  const portao = new Promise<void>((resolver) => (soltar = resolver));
  const original = globalThis.fetch;
  vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, init?: RequestInit) => {
    if (String(entrada) === url && (init?.method ?? 'GET') === metodo) await portao;
    return original(entrada, init);
  });
  return soltar;
}

const campo = () => screen.findByLabelText('E-mail de quem vai participar');

function comoSozinha() {
  servidor.lar = lerResposta('lar-sozinha.json');
}

describe('Lar: membros', () => {
  it('lista os dois membros com papel e marca quem é você; o convite fica de fora quando o lar está cheio', async () => {
    montarApp(LAR);

    expect(await screen.findByRole('heading', { level: 1, name: 'Casa e membros' })).toBeInTheDocument();
    const membros = await screen.findByRole('region', { name: 'Membros' });
    const itens = within(membros).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('Ana');
    expect(itens[0]).toHaveTextContent('Titular · você');
    expect(itens[1]).toHaveTextContent('Beatriz');
    expect(itens[1]).toHaveTextContent('Membro');
    expect(screen.getByText(/A casa já tem os dois membros/)).toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail de quem vai participar')).not.toBeInTheDocument();
  });

  it('o voltar leva a Ajustes', async () => {
    montarApp(LAR);

    await screen.findByRole('region', { name: 'Membros' });
    expect(screen.getByRole('link', { name: 'Voltar para Ajustes' })).toHaveAttribute('href', '/app/ajustes');
  });

  it('quem não é titular não vê o formulário nem o convite (CA-23.2)', async () => {
    servidor.lar = lerResposta('lar-como-membro.json');
    montarApp(LAR);

    const membros = await screen.findByRole('region', { name: 'Membros' });
    expect(within(membros).getAllByRole('listitem')[1]).toHaveTextContent('Membro · você');
    expect(screen.getByText(/Só o titular do lar convida/)).toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail de quem vai participar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar convite' })).not.toBeInTheDocument();
  });

  it('erro do servidor sem dado mostra o erro padrão e "Tentar de novo" recarrega', async () => {
    servidor.falhas.set('GET /api/lar', { status: 500, code: 'erro_interno' });
    montarApp(LAR);

    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar' })).toBeInTheDocument();
    servidor.falhas.clear();
    await userEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));

    expect(await screen.findByRole('region', { name: 'Membros' })).toBeInTheDocument();
  });
});

describe('Lar: convidar', () => {
  it('titular sozinho vê o formulário; enviar faz POST /api/lar/convites e passa a mostrar o convite pendente', async () => {
    comoSozinha();
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.type(await campo(), '  Beatriz@Exemplo.com ');
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('Convite enviado para beatriz@exemplo.com')).toBeInTheDocument();
    const envio = escritas(servidor)[0]!;
    expect(envio).toMatchObject({ url: '/api/lar/convites', metodo: 'POST' });
    expect(envio.corpo).toEqual({ email: 'Beatriz@Exemplo.com' });
    expect(envio.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    const pendente = await screen.findByRole('region', { name: 'Convite pendente' });
    expect(pendente).toHaveTextContent('beatriz@exemplo.com');
    // Convite de 7 dias: de 09/10/2026 a 16/10/2026.
    expect(pendente).toHaveTextContent('válido até 16/10/2026');
    expect(screen.queryByLabelText('E-mail de quem vai participar')).not.toBeInTheDocument();
  });

  it('e-mail sem formato válido mostra o erro no campo, sem enviar', async () => {
    comoSozinha();
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.type(await campo(), 'sem-arroba');
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(await campo()).toHaveAttribute('aria-invalid', 'true');
    expect(escritas(servidor)).toHaveLength(0);
  });

  it('CA-23.7: convidar o próprio e-mail é recusado e o erro aparece no campo', async () => {
    comoSozinha();
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.type(await campo(), 'ana@exemplo.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('Confira o e-mail. Não vale o seu próprio endereço.')).toBeInTheDocument();
    expect(servidor.lar.convite_pendente).toBeUndefined();
  });

  it('editar o campo limpa o erro do servidor', async () => {
    comoSozinha();
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.type(await campo(), 'ana@exemplo.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));
    await screen.findByText('Confira o e-mail. Não vale o seu próprio endereço.');
    await usuario.type(await campo(), 'x');

    await waitFor(() =>
      expect(screen.queryByText('Confira o e-mail. Não vale o seu próprio endereço.')).not.toBeInTheDocument(),
    );
  });

  it('lar_cheio (409) aparece no topo do formulário, em texto da tela', async () => {
    comoSozinha();
    servidor.falhas.set('POST /api/lar/convites', { status: 409, code: 'lar_cheio' });
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.type(await campo(), 'beatriz@exemplo.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('Este lar já tem o número máximo de membros.')).toBeInTheDocument();
    expect(await campo()).toHaveValue('beatriz@exemplo.com');
  });

  it('convite_pendente (409) aparece no topo do formulário', async () => {
    comoSozinha();
    servidor.falhas.set('POST /api/lar/convites', { status: 409, code: 'convite_pendente' });
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.type(await campo(), 'beatriz@exemplo.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText('Já existe um convite pendente.')).toBeInTheDocument();
  });

  it('sem rede avisa no topo e mantém o e-mail digitado', async () => {
    comoSozinha();
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.type(await campo(), 'beatriz@exemplo.com');
    servidor.semRede = true;
    await usuario.click(screen.getByRole('button', { name: 'Enviar convite' }));

    expect(await screen.findByText(/Sem conexão/)).toBeInTheDocument();
    expect(await campo()).toHaveValue('beatriz@exemplo.com');
  });
});

describe('Lar: convite pendente', () => {
  beforeEach(() => {
    servidor.lar = lerResposta('lar-convite-pendente.json');
  });

  it('mostra para quem foi enviado e até quando vale, e não mostra o formulário; nunca expõe o token', async () => {
    montarApp(LAR);

    const pendente = await screen.findByRole('region', { name: 'Convite pendente' });
    expect(pendente).toHaveTextContent('Convite enviado para beatriz@exemplo.com');
    expect(pendente).toHaveTextContent('válido até 16/10/2026');
    expect(screen.queryByLabelText('E-mail de quem vai participar')).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/token/i);
  });

  it('cancelar pede confirmação; manter o convite não chama a API', async () => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.click(await screen.findByRole('button', { name: 'Cancelar convite' }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText('Cancelar o convite?')).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Manter convite' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(escritas(servidor)).toHaveLength(0);
    expect(servidor.lar.convite_pendente).toBeDefined();
  });

  it('confirmar faz DELETE /api/lar/convites/:id, avisa e volta ao formulário', async () => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    await usuario.click(await screen.findByRole('button', { name: 'Cancelar convite' }));
    const dialogo = await screen.findByRole('alertdialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar convite' }));

    expect(await screen.findByText('Convite cancelado')).toBeInTheDocument();
    expect(escritas(servidor)[0]).toMatchObject({ url: `/api/lar/convites/${ID_CONVITE}`, metodo: 'DELETE' });
    expect(servidor.lar.convite_pendente).toBeUndefined();
    expect(await campo()).toBeInTheDocument();
  });
});

/**
 * Remover o membro (etapa 18; spec "Titular remove o membro", critérios 1 a 8, e os casos limite). O titular é Ana e
 * o membro é Beatriz (`lar-dois-membros.json`).
 */
describe('Lar: remover o membro', () => {
  type Usuario = ReturnType<typeof userEvent.setup>;
  const ID_BEATRIZ = '00000000-0000-4000-8000-000000000102';
  const remocoes = () =>
    escritas(servidor).filter((c) => c.metodo === 'DELETE' && c.url.startsWith('/api/lar/membros/'));
  const membros = async () => within(await screen.findByRole('region', { name: 'Membros' })).getAllByRole('listitem');

  async function abrirConfirmacao(usuario: Usuario) {
    await usuario.click(await screen.findByRole('button', { name: 'Remover' }));
    return screen.findByRole('alertdialog');
  }

  it('o titular vê "Remover" ao lado do membro, que abre a confirmação com o nome e os efeitos', async () => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    const itens = await membros();
    expect(within(itens[1]!).getByRole('button', { name: 'Remover' })).toBeInTheDocument();
    expect(within(itens[0]!).queryByRole('button')).not.toBeInTheDocument();
    const dialogo = await abrirConfirmacao(usuario);

    expect(dialogo).toHaveAccessibleName('Remover Beatriz da casa?');
    expect(dialogo).toHaveAccessibleDescription(
      'Beatriz perde o acesso ao que é do conjunto da casa. O que é só de Beatriz some em 30 dias. ' +
        'As despesas conjuntas que Beatriz pagou ficam como "Ex-membro". Para voltar, só com um novo convite.',
    );
    expect(remocoes()).toHaveLength(0);
  });

  it.each([
    ['Cancelar', (u: Usuario, d: HTMLElement) => u.click(within(d).getByRole('button', { name: 'Cancelar' }))],
    ['Esc', (u: Usuario) => u.keyboard('{Escape}')],
    // O véu do diálogo é o irmão logo antes dele (a folha de lançar tem o seu, por baixo).
    ['o véu', (u: Usuario, d: HTMLElement) => u.click(d.previousElementSibling as HTMLElement)],
  ] as const)('%s fecha a confirmação sem chamar a API', async (_, fechar) => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    await fechar(usuario, dialogo);

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(remocoes()).toHaveLength(0);
    expect(await membros()).toHaveLength(2);
  });

  it('confirmar chama DELETE uma vez; durante a chamada o confirmar fica inerte e não há segundo envio', async () => {
    const soltar = segurar('DELETE', `/api/lar/membros/${ID_BEATRIZ}`);
    const usuario = userEvent.setup();
    montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    const confirmar = within(dialogo).getByRole('button', { name: 'Remover' });
    await usuario.click(confirmar);

    await waitFor(() => expect(confirmar).toHaveAttribute('aria-disabled', 'true'));
    await usuario.click(confirmar);
    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    soltar();

    expect(await screen.findByText('Membro removido')).toBeInTheDocument();
    expect(remocoes()).toEqual([expect.objectContaining({ url: `/api/lar/membros/${ID_BEATRIZ}`, metodo: 'DELETE' })]);
    expect(remocoes()[0]!.corpo).toBeUndefined();
  });

  it('sucesso: confirmação fechada, aviso "Membro removido", lista relida só com o titular e o convite de volta', async () => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover' }));

    expect(await screen.findByText('Membro removido')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(async () => expect(await membros()).toHaveLength(1));
    expect((await membros())[0]).toHaveTextContent('Ana');
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    expect(await campo()).toBeInTheDocument();
  });

  it('registro_invalido (o membro já saiu): lista relida e aviso "Este membro já não está na casa", sem erro', async () => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    // Beatriz saiu por conta própria enquanto a confirmação estava aberta.
    servidor.lar = lerResposta('lar-sozinha.json');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover' }));

    expect(await screen.findByText('Este membro já não está na casa')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(async () => expect(await membros()).toHaveLength(1));
    expect(screen.queryByText('Membro removido')).not.toBeInTheDocument();
    expect(screen.queryByText(/Não encontramos este item/)).not.toBeInTheDocument();
  });

  it.each([
    ['rede', () => (servidor.semRede = true), 'Sem conexão. Tente de novo'],
    [
      'servidor',
      () => servidor.falhas.set('DELETE /api/lar/membros/:id', { status: 500, code: 'erro_interno' }),
      'Serviço indisponível no momento. Tente de novo em instantes',
    ],
  ] as const)('falha de %s: confirmação aberta com a mensagem, lista inalterada', async (_, falhar, mensagem) => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    falhar();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Remover' })).not.toHaveAttribute('aria-disabled');
    expect(await membros()).toHaveLength(2);
    expect(servidor.lar.membros).toHaveLength(2);
    expect(screen.queryByText('Membro removido')).not.toBeInTheDocument();
  });

  it('o erro some ao reabrir a confirmação depois de cancelar', async () => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    let dialogo = await abrirConfirmacao(usuario);
    servidor.semRede = true;
    await usuario.click(within(dialogo).getByRole('button', { name: 'Remover' }));
    await within(dialogo).findByRole('alert');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    dialogo = await abrirConfirmacao(usuario);
    expect(within(dialogo).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('quem não é titular não vê "Remover"', async () => {
    servidor.lar = lerResposta('lar-como-membro.json');
    montarApp(LAR);

    await membros();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
  });

  it('titular sozinho na casa não vê botão de remover nem de sair', async () => {
    comoSozinha();
    montarApp(LAR);

    await membros();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair da casa' })).not.toBeInTheDocument();
  });

  it('sem conexão "Remover" fica desativado, com o aviso, e nada é enviado', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const usuario = userEvent.setup();
      montarApp(LAR);

      const remover = await screen.findByRole('button', { name: 'Remover' });
      expect(remover).toBeDisabled();
      expect(screen.getByText('Precisa de conexão para esta ação')).toBeInTheDocument();
      await usuario.click(remover);

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(remocoes()).toHaveLength(0);
    } finally {
      online.mockRestore();
    }
  });

  it('sessão expirada no meio da remoção: segue para o login sem repetir a chamada', async () => {
    servidor.falhas.set('DELETE /api/lar/membros/:id', { status: 401, code: 'sessao_expirada' });
    const usuario = userEvent.setup();
    const { cliente, roteador, local } = montarApp(LAR);
    const desligar = ligarPerdaDeSessao(cliente, roteador);

    try {
      const dialogo = await abrirConfirmacao(usuario);
      await usuario.click(within(dialogo).getByRole('button', { name: 'Remover' }));

      await waitFor(() => expect(local()).toMatch(/^\/entrar\?volta=/));
      expect(remocoes()).toHaveLength(1);
    } finally {
      desligar();
    }
  });
});

/**
 * Sair da casa (etapa 18; spec "Membro sai da casa", critérios 1 a 8, e os casos limite). Beatriz é o membro e a
 * sessão (`lar-como-membro.json`); Ana é a titular.
 */
describe('Lar: sair da casa', () => {
  type Usuario = ReturnType<typeof userEvent.setup>;
  const saidas = () => escritas(servidor).filter((c) => c.url === '/api/lar/sair');
  const membros = async () => within(await screen.findByRole('region', { name: 'Membros' })).getAllByRole('listitem');

  beforeEach(() => {
    servidor.lar = lerResposta('lar-como-membro.json');
  });

  async function abrirConfirmacao(usuario: Usuario) {
    await usuario.click(await screen.findByRole('button', { name: 'Sair da casa' }));
    return screen.findByRole('alertdialog');
  }

  it('o membro vê "Sair da casa" na própria linha, que abre a confirmação com os efeitos', async () => {
    const usuario = userEvent.setup();
    montarApp(LAR);

    const itens = await membros();
    expect(within(itens[1]!).getByRole('button', { name: 'Sair da casa' })).toBeInTheDocument();
    expect(within(itens[0]!).queryByRole('button')).not.toBeInTheDocument();
    const dialogo = await abrirConfirmacao(usuario);

    expect(dialogo).toHaveAccessibleName('Sair da casa?');
    expect(dialogo).toHaveAccessibleDescription(
      'Você perde o acesso ao que é do conjunto da casa. O que é só seu some em 30 dias. ' +
        'As despesas conjuntas que você pagou ficam como "Ex-membro". Para voltar, só com um novo convite.',
    );
    expect(saidas()).toHaveLength(0);
  });

  it.each([
    ['Cancelar', (u: Usuario, d: HTMLElement) => u.click(within(d).getByRole('button', { name: 'Cancelar' }))],
    ['Esc', (u: Usuario) => u.keyboard('{Escape}')],
    // O véu do diálogo é o irmão logo antes dele (a folha de lançar tem o seu, por baixo).
    ['o véu', (u: Usuario, d: HTMLElement) => u.click(d.previousElementSibling as HTMLElement)],
  ] as const)('%s fecha a confirmação sem chamar a API', async (_, fechar) => {
    const usuario = userEvent.setup();
    const { local } = montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    await fechar(usuario, dialogo);

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(saidas()).toHaveLength(0);
    expect(local()).toBe(LAR);
  });

  it('confirmar chama POST /api/lar/sair uma vez, sem corpo; durante a chamada o confirmar fica inerte', async () => {
    const soltar = segurar('POST', '/api/lar/sair');
    const usuario = userEvent.setup();
    const { local } = montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    const confirmar = within(dialogo).getByRole('button', { name: 'Sair da casa' });
    await usuario.click(confirmar);

    await waitFor(() => expect(confirmar).toHaveAttribute('aria-disabled', 'true'));
    await usuario.click(confirmar);
    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    soltar();

    await waitFor(() => expect(local()).toBe('/app/bem-vindo'));
    expect(saidas()).toEqual([expect.objectContaining({ url: '/api/lar/sair', metodo: 'POST' })]);
    expect(saidas()[0]!.corpo).toBeUndefined();
  });

  it('sucesso: sessão relida, o app vai a /app/bem-vindo e o aviso "Você saiu da casa" aparece lá', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    const lidasAntes = servidor.chamadas.filter((c) => c.metodo === 'GET' && c.url === '/api/sessao').length;
    await usuario.click(within(dialogo).getByRole('button', { name: 'Sair da casa' }));

    await waitFor(() => expect(local()).toBe('/app/bem-vindo'));
    expect(await screen.findByText('Você saiu da casa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar meu lar' })).toBeInTheDocument();
    expect(servidor.chamadas.filter((c) => c.metodo === 'GET' && c.url === '/api/sessao').length).toBeGreaterThan(
      lidasAntes,
    );
  });

  it('o aviso "Você saiu da casa" aparece uma vez só: voltar ao primeiro acesso depois não o repete', async () => {
    const usuario = userEvent.setup();
    const { local, roteador } = montarApp(LAR);

    const dialogo = await abrirConfirmacao(usuario);
    await usuario.click(within(dialogo).getByRole('button', { name: 'Sair da casa' }));
    await screen.findByText('Você saiu da casa');
    await waitFor(() => expect(screen.queryByText('Você saiu da casa')).not.toBeInTheDocument(), { timeout: 6000 });

    await roteador.navigate('/app/ajustes/conta');
    await roteador.navigate('/app/bem-vindo');

    await waitFor(() => expect(local()).toBe('/app/bem-vindo'));
    expect(screen.queryByText('Você saiu da casa')).not.toBeInTheDocument();
  }, 15_000);

  it.each([
    ['sem_lar', 403, true, '/app/bem-vindo'],
    ['registro_invalido', 400, false, LAR],
  ] as const)(
    '%s: sessão relida e segue o destino que ela indicar, sem mensagem de erro',
    async (code, status, semLarNaSessao, destino) => {
      servidor.falhas.set('POST /api/lar/sair', { status, code });
      const usuario = userEvent.setup();
      const { local } = montarApp(LAR);

      const dialogo = await abrirConfirmacao(usuario);
      const lidasAntes = servidor.chamadas.filter((c) => c.metodo === 'GET' && c.url === '/api/sessao').length;
      servidor.saiuDoLar = semLarNaSessao;
      await usuario.click(within(dialogo).getByRole('button', { name: 'Sair da casa' }));

      await waitFor(() =>
        expect(servidor.chamadas.filter((c) => c.metodo === 'GET' && c.url === '/api/sessao').length).toBeGreaterThan(
          lidasAntes,
        ),
      );
      await waitFor(() => expect(local()).toBe(destino));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      // A região de avisos assertiva fica sempre montada (vazia); nenhum alerta pode ter texto.
      expect(screen.queryAllByRole('alert').map((e) => e.textContent?.trim())).toEqual(
        screen.queryAllByRole('alert').map(() => ''),
      );
      expect(screen.queryByText(/Não encontramos este item|Algo deu errado/)).not.toBeInTheDocument();
      expect(screen.queryByText('Você saiu da casa')).not.toBeInTheDocument();
    },
  );

  it.each([
    ['rede', () => (servidor.semRede = true), 'Sem conexão. Tente de novo'],
    [
      'servidor',
      () => servidor.falhas.set('POST /api/lar/sair', { status: 500, code: 'erro_interno' }),
      'Serviço indisponível no momento. Tente de novo em instantes',
    ],
  ] as const)(
    'falha de %s: confirmação aberta com a mensagem e o membro continua na casa',
    async (_, falhar, mensagem) => {
      const usuario = userEvent.setup();
      const { local } = montarApp(LAR);

      const dialogo = await abrirConfirmacao(usuario);
      falhar();
      await usuario.click(within(dialogo).getByRole('button', { name: 'Sair da casa' }));

      expect(await within(dialogo).findByRole('alert')).toHaveTextContent(mensagem);
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(within(dialogo).getByRole('button', { name: 'Sair da casa' })).not.toHaveAttribute('aria-disabled');
      expect(local()).toBe(LAR);
      expect(await membros()).toHaveLength(2);
      expect(servidor.saiuDoLar).toBeFalsy();
    },
  );

  it('o titular não vê "Sair da casa"', async () => {
    servidor.lar = lerResposta('lar-dois-membros.json');
    montarApp(LAR);

    await membros();
    expect(screen.queryByRole('button', { name: 'Sair da casa' })).not.toBeInTheDocument();
  });

  it('sem conexão "Sair da casa" fica desativado, com o aviso, e nada é enviado', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const usuario = userEvent.setup();
      montarApp(LAR);

      const sair = await screen.findByRole('button', { name: 'Sair da casa' });
      expect(sair).toBeDisabled();
      expect(screen.getByText('Precisa de conexão para esta ação')).toBeInTheDocument();
      await usuario.click(sair);

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(saidas()).toHaveLength(0);
    } finally {
      online.mockRestore();
    }
  });

  it('sessão expirada no meio da saída: segue para o login sem repetir a chamada', async () => {
    servidor.falhas.set('POST /api/lar/sair', { status: 401, code: 'sessao_expirada' });
    const usuario = userEvent.setup();
    const { cliente, roteador, local } = montarApp(LAR);
    const desligar = ligarPerdaDeSessao(cliente, roteador);

    try {
      const dialogo = await abrirConfirmacao(usuario);
      await usuario.click(within(dialogo).getByRole('button', { name: 'Sair da casa' }));

      await waitFor(() => expect(local()).toMatch(/^\/entrar\?volta=/));
      expect(saidas()).toHaveLength(1);
    } finally {
      desligar();
    }
  });
});
