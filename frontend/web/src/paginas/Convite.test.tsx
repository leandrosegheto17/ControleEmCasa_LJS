import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Convite } from './Convite';

const simulados = vi.hoisted(() => ({
  sessao: { atual: null as unknown },
  conviteAtual: vi.fn(),
  aceitarConvite: vi.fn(),
  recusarConvite: vi.fn(),
}));

vi.mock('../dados/sessao', () => ({
  obterSessao: vi.fn(async () => simulados.sessao.atual),
  donoLembrado: vi.fn(() => undefined),
}));
vi.mock('../dados/lar', () => ({
  conviteAtual: simulados.conviteAtual,
  aceitarConvite: simulados.aceitarConvite,
  recusarConvite: simulados.recusarConvite,
}));

const TOKEN = 'token-do-convite-de-teste';
const SESSAO = {
  usuario: { id: '00000000-0000-4000-8000-0000000000a1', nome: 'Bia', email: 'bia@exemplo.com' },
  membro: null,
  lar: null,
  plano: null,
  termos_pendentes: false,
};
const CONVITE = { lar_nome: 'Casa da Ana', convidado_por_nome: 'Ana', expira_em: '2026-11-01T00:00:00.000Z' };

function montar() {
  const consulta = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={consulta}>
      <MemoryRouter initialEntries={['/convite']}>
        <Routes>
          <Route path="/convite" element={<Convite />} />
          <Route path="/app" element={<p>Página App</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', `/convite#t=${TOKEN}`);
  simulados.sessao.atual = SESSAO;
  simulados.conviteAtual.mockResolvedValue(CONVITE);
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.sessionStorage.clear();
});

describe('Convite (CA-23.3 a CA-23.5, CA-23.11)', () => {
  it('com sessão mostra quem convidou e o lar, consultando com o token do link', async () => {
    montar();
    expect(await screen.findByText(/Ana convidou você para o lar “Casa da Ana”/)).toBeInTheDocument();
    expect(simulados.conviteAtual).toHaveBeenCalledWith(TOKEN);
  });

  it('o token sai do endereço e não aparece na tela', async () => {
    const { container } = montar();
    await screen.findByText(/Ana convidou/);

    expect(window.location.href).not.toContain(TOKEN);
    expect(container.innerHTML).not.toContain(TOKEN);
  });

  it('aceitar envia o token, apaga-o da aba e leva ao app', async () => {
    simulados.aceitarConvite.mockResolvedValue(undefined);
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Aceitar convite' }));

    expect(await screen.findByText('Página App')).toBeInTheDocument();
    expect(simulados.aceitarConvite).toHaveBeenCalledWith(TOKEN);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('recusar envia o token e leva ao app', async () => {
    simulados.recusarConvite.mockResolvedValue(undefined);
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Recusar' }));

    expect(await screen.findByText('Página App')).toBeInTheDocument();
    expect(simulados.recusarConvite).toHaveBeenCalledWith(TOKEN);
  });

  it.each([
    ['convite_invalido', /não é mais válido/],
    ['lar_cheio', /número máximo de membros/],
    ['ja_tem_lar', /já faz parte de um lar/],
  ] as const)('o aceite recusado com %s mostra o texto próprio, sem o código', async (codigo, texto) => {
    simulados.aceitarConvite.mockRejectedValue({ tipo: 'regra', codigo });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Aceitar convite' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(texto);
    expect(alerta.textContent).not.toContain(codigo);
    expect(screen.queryByText('Página App')).toBeNull();
  });

  it('convite inválido na consulta (token errado, de outro e-mail, usado): mesmo texto, sem botões', async () => {
    simulados.conviteAtual.mockRejectedValue({ tipo: 'regra', codigo: 'convite_invalido' });
    montar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não é mais válido/);
    expect(screen.queryByRole('button', { name: 'Aceitar convite' })).toBeNull();
  });

  it('sem sessão manda entrar ou criar conta e guarda o token só na aba (não no endereço)', async () => {
    simulados.sessao.atual = null;
    montar();

    const entrar = await screen.findByRole('link', { name: 'Entrar' });
    expect(entrar).toHaveAttribute('href', '/entrar?volta=%2Fconvite');
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/cadastro');
    expect(simulados.conviteAtual).not.toHaveBeenCalled();
    expect(window.location.href).not.toContain(TOKEN);
    expect(window.sessionStorage.getItem('controle.convite-em-espera')).toBe(TOKEN);
  });

  it('ao voltar do login o convite continua disponível (token da aba, endereço sem fragmento)', async () => {
    window.history.replaceState(null, '', '/convite');
    window.sessionStorage.setItem('controle.convite-em-espera', TOKEN);
    montar();

    await screen.findByText(/Ana convidou/);
    expect(simulados.conviteAtual).toHaveBeenCalledWith(TOKEN);
  });

  it('sem token nenhum: convite inválido', async () => {
    window.history.replaceState(null, '', '/convite');
    montar();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não é mais válido/));
    expect(simulados.conviteAtual).not.toHaveBeenCalled();
  });

  it('o token nunca é escrito no console', async () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    simulados.aceitarConvite.mockRejectedValue({ tipo: 'regra', codigo: 'lar_cheio' });
    const user = userEvent.setup();
    montar();
    await user.click(await screen.findByRole('button', { name: 'Aceitar convite' }));
    await screen.findByRole('alert');

    for (const e of espioes) {
      expect(JSON.stringify(e.mock.calls)).not.toContain(TOKEN);
      e.mockRestore();
    }
  });
});
