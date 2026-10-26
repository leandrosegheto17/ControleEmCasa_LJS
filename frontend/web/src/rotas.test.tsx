import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registrarLimpeza } from './dados/aparelho';
import { encerrarNoAparelho } from './dados/sessao';
import { rotas } from './rotas';

/**
 * Rotas e guardas contra a API simulada no `fetch` (SDD 9.3): o transporte, a camada de sessão, os ganchos e
 * as páginas são os de verdade; só a rede é simulada.
 */

const ID = '00000000-0000-4000-8000-0000000000a1';
const LAR = { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' };

type Estado = { sessao: null | { termos_pendentes: boolean; lar: typeof LAR | null }; semRede: boolean };
const servidor: Estado = { sessao: null, semRede: false };
const chamadas: Array<{ metodo: string; url: string; corpo?: unknown }> = [];

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

function sessaoJson() {
  const s = servidor.sessao!;
  return {
    usuario: { id: ID, nome: 'Ana', email: 'ana@exemplo.com' },
    membro: s.lar ? { id: ID, nome: 'Ana', papel: 'titular' } : null,
    lar: s.lar,
    plano: null,
    termos_pendentes: s.termos_pendentes,
  };
}

const fetchSimulado = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = String(entrada);
  const metodo = init?.method ?? 'GET';
  chamadas.push({ metodo, url, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
  if (servidor.semRede) throw new TypeError('Failed to fetch');
  if (url === '/api/sessao' && metodo === 'GET') {
    return servidor.sessao ? json(sessaoJson()) : json({ code: 'sessao_expirada', message: 'x' }, 401);
  }
  if (url === '/api/sessao/entrar') {
    const corpo = JSON.parse(String(init?.body)) as { senha: string };
    if (corpo.senha !== 'senha-correta-123') return json({ code: 'credenciais_invalidas', message: 'x' }, 400);
    servidor.sessao = { termos_pendentes: false, lar: LAR };
    return new Response(null, { status: 204 });
  }
  if (url === '/api/sessao/sair') {
    servidor.sessao = null;
    return new Response(null, { status: 204 });
  }
  return json({ code: 'rota_inexistente', message: 'x' }, 404);
});

function montar(caminho: string) {
  const consulta = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const roteador = createMemoryRouter(rotas, { initialEntries: [caminho] });
  const tela = render(
    <QueryClientProvider client={consulta}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>,
  );
  return { roteador, consulta, ...tela };
}

const local = (roteador: ReturnType<typeof montar>['roteador']) =>
  `${roteador.state.location.pathname}${roteador.state.location.search}`;

const limpeza = vi.fn();
let desregistrar: () => void;

beforeEach(async () => {
  servidor.sessao = null;
  servidor.semRede = false;
  chamadas.length = 0;
  fetchSimulado.mockClear();
  vi.stubGlobal('fetch', fetchSimulado);
  await encerrarNoAparelho();
  limpeza.mockReset();
  desregistrar = registrarLimpeza(limpeza);
});

afterEach(() => {
  desregistrar();
  vi.unstubAllGlobals();
});

describe('guarda de /app/*', () => {
  it('sem sessão, abrir uma tela do app leva a /entrar?volta= com o caminho', async () => {
    const { roteador } = montar('/app/lancamentos?mes=2026-10-01');

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(local(roteador)).toBe('/entrar?volta=%2Fapp%2Flancamentos%3Fmes%3D2026-10-01');
  });

  it('com sessão e lar, /app mostra o início', async () => {
    servidor.sessao = { termos_pendentes: false, lar: LAR };
    const { roteador } = montar('/app');

    // SPEC_DEVIATION (lote 2): o início provisório ("Olá, Ana.") deu lugar ao Início real; o marcador é o seletor de mês.
    expect(await screen.findByRole('heading', { level: 1, name: /\d{4}$/ })).toBeInTheDocument();
    expect(local(roteador)).toBe('/app');
  });

  it('com termos pendentes, qualquer tela do app leva ao aceite', async () => {
    servidor.sessao = { termos_pendentes: true, lar: LAR };
    const { roteador } = montar('/app');

    await waitFor(() => expect(local(roteador)).toBe('/app/aceitar-termos'));
  });

  it('com sessão sem lar, o app leva a /app/bem-vindo', async () => {
    servidor.sessao = { termos_pendentes: false, lar: null };
    const { roteador } = montar('/app');

    await waitFor(() => expect(local(roteador)).toBe('/app/bem-vindo'));
  });

  it('sem rede mas com usuário lembrado neste aparelho, o app abre mesmo assim (lançar offline)', async () => {
    servidor.sessao = { termos_pendentes: false, lar: LAR };
    const primeira = montar('/app');
    expect(await screen.findByRole('heading', { level: 1, name: /\d{4}$/ })).toBeInTheDocument();
    primeira.unmount();

    servidor.semRede = true;
    const { roteador } = montar('/app');

    expect(await screen.findByRole('heading', { level: 1, name: /\d{4}$/ })).toBeInTheDocument();
    expect(local(roteador)).toBe('/app');
  });

  it('sem rede e sem usuário lembrado, vai para /entrar', async () => {
    servidor.semRede = true;
    const { roteador } = montar('/app');

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(local(roteador)).toContain('/entrar?volta=');
  });
});

describe('telas de acesso', () => {
  it('quem já entrou não vê /entrar: vai para o app', async () => {
    servidor.sessao = { termos_pendentes: false, lar: LAR };
    const { roteador } = montar('/entrar');

    await waitFor(() => expect(local(roteador)).toBe('/app'));
  });

  it('login certo volta para a tela onde a pessoa estava', async () => {
    const user = userEvent.setup();
    const { roteador } = montar('/app/lancamentos');
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });

    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-correta-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(roteador.state.location.pathname).toBe('/app/lancamentos'));
    const entrada = chamadas.find((c) => c.url === '/api/sessao/entrar');
    expect(entrada?.corpo).toEqual({ email: 'ana@exemplo.com', senha: 'senha-correta-123' });
  });

  it('login com destino de fora do app ignora o volta e vai para /app', async () => {
    const user = userEvent.setup();
    const { roteador } = montar('/entrar?volta=https%3A%2F%2Fmau.exemplo%2Fapp');
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });

    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'senha-correta-123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(local(roteador)).toBe('/app'));
  });

  it('login errado mostra o alerta genérico e continua em /entrar', async () => {
    const user = userEvent.setup();
    const { roteador } = montar('/entrar');
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });

    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'errada');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail ou senha incorretos.')).toBeInTheDocument();
    expect(local(roteador)).toBe('/entrar');
  });

  it('a redefinição de senha abre mesmo com sessão (o link com token não pode se perder)', async () => {
    servidor.sessao = { termos_pendentes: false, lar: LAR };
    const { roteador } = montar('/redefinir-senha');

    expect(await screen.findByRole('heading', { level: 1, name: 'Nova senha' })).toBeInTheDocument();
    expect(local(roteador)).toBe('/redefinir-senha');
  });

  it('a raiz leva ao app', async () => {
    servidor.sessao = { termos_pendentes: false, lar: LAR };
    const { roteador } = montar('/');

    await waitFor(() => expect(local(roteador)).toBe('/app'));
  });

  it('endereço desconhecido mostra "Página não encontrada"', async () => {
    montar('/nada-por-aqui');
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toBeInTheDocument();
  });
});

describe('sair (G-39)', () => {
  it('chama POST /api/sessao/sair, limpa o aparelho e volta para /entrar', async () => {
    servidor.sessao = { termos_pendentes: false, lar: LAR };
    const user = userEvent.setup();
    // O botão de sair mora em Ajustes (o início provisório tinha um "Sair" próprio; SPEC_DEVIATION do lote 2).
    const { roteador, consulta } = montar('/app/ajustes');

    await user.click(await screen.findByRole('button', { name: /Sair deste aparelho/ }));

    await waitFor(() => expect(local(roteador)).toContain('/entrar'));
    expect(chamadas.some((c) => c.url === '/api/sessao/sair' && c.metodo === 'POST')).toBe(true);
    expect(limpeza).toHaveBeenCalledTimes(1);
    expect(consulta.getQueryData(['sessao'])).toBeNull();
  });
});
