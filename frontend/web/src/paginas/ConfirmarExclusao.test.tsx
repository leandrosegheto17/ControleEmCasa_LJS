import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmarExclusao } from './ConfirmarExclusao';

const simulados = vi.hoisted(() => ({ confirmarExclusao: vi.fn(), pedirExclusao: vi.fn() }));
vi.mock('../dados/conta', () => ({
  confirmarExclusao: simulados.confirmarExclusao,
  pedirExclusao: simulados.pedirExclusao,
}));

/**
 * `/confirmar-exclusao` (RN-26; CA-26.2, CA-26.9). O token vem no fragmento, sai do endereço ao ser lido, e a exclusão só
 * acontece depois de uma confirmação explícita.
 */

const TOKEN = 'token-de-exclusao-de-teste';

function montar() {
  const consulta = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const tela = render(
    <StrictMode>
      <QueryClientProvider client={consulta}>
        <MemoryRouter>
          <ConfirmarExclusao />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
  return { consulta, ...tela };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', `/confirmar-exclusao#t=${TOKEN}`);
});
afterEach(() => window.history.replaceState(null, '', '/'));

const botaoConfirmar = () => screen.getByRole('button', { name: 'Sim, excluir minha conta' });

describe('abrir o link', () => {
  it('não exclui nada ao abrir: pede a confirmação e tira o token do endereço', async () => {
    montar();

    expect(await screen.findByRole('heading', { level: 1, name: 'Excluir minha conta' })).toBeInTheDocument();
    expect(botaoConfirmar()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Não, manter minha conta' })).toHaveAttribute('href', '/');
    expect(simulados.confirmarExclusao).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(TOKEN);
  });

  it('o texto lembra o bloqueio de 30 dias e que não dá para desfazer', async () => {
    montar();

    expect(await screen.findByText(/bloqueada por 30 dias/)).toBeInTheDocument();
    expect(screen.getByText(/não pode ser desfeito/)).toBeInTheDocument();
  });

  it('sem token: estado de erro, sem chamada, com o caminho para pedir de novo', async () => {
    window.history.replaceState(null, '', '/confirmar-exclusao');
    montar();

    expect(await screen.findByRole('heading', { level: 1, name: 'Link inválido' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('incompleto');
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/app/ajustes/conta');
    expect(screen.queryByRole('button', { name: 'Sim, excluir minha conta' })).not.toBeInTheDocument();
    expect(simulados.confirmarExclusao).not.toHaveBeenCalled();
  });
});

describe('confirmar', () => {
  it('envia o token uma única vez e mostra a mensagem final com o caminho para a landing', async () => {
    simulados.confirmarExclusao.mockResolvedValue(undefined);
    const usuario = userEvent.setup();
    const { consulta } = montar();
    consulta.setQueryData(['sessao'], { usuario: { id: 'x' } });

    await usuario.click(await screen.findByRole('button', { name: 'Sim, excluir minha conta' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Conta excluída' })).toBeInTheDocument();
    expect(simulados.confirmarExclusao).toHaveBeenCalledTimes(1);
    expect(simulados.confirmarExclusao).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByText(/Em 30 dias os seus dados serão apagados/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para a página inicial' })).toHaveAttribute('href', '/');
    // O cache em memória e a sessão ficam vazios: o aparelho deixa de mostrar dado da conta.
    expect(consulta.getQueryData(['sessao'])).toBeNull();
  });

  it('um segundo clique durante o envio não repete a confirmação', async () => {
    simulados.confirmarExclusao.mockImplementation(() => new Promise((r) => setTimeout(r, 30)));
    const usuario = userEvent.setup();
    montar();

    await usuario.dblClick(await screen.findByRole('button', { name: 'Sim, excluir minha conta' }));

    await screen.findByRole('heading', { name: 'Conta excluída' });
    expect(simulados.confirmarExclusao).toHaveBeenCalledTimes(1);
  });

  it('link expirado ou já usado: explica e leva a pedir de novo', async () => {
    simulados.confirmarExclusao.mockRejectedValue({ tipo: 'regra', codigo: 'link_expirado' });
    const usuario = userEvent.setup();
    montar();

    await usuario.click(await screen.findByRole('button', { name: 'Sim, excluir minha conta' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Link inválido' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Este link expirou ou já foi usado');
    expect(screen.getByRole('link', { name: 'Pedir um novo link' })).toHaveAttribute('href', '/app/ajustes/conta');
  });

  it('sem conexão: avisa, mantém o token em memória e deixa tentar de novo', async () => {
    simulados.confirmarExclusao.mockRejectedValueOnce({ tipo: 'rede' }).mockResolvedValueOnce(undefined);
    const usuario = userEvent.setup();
    montar();

    await usuario.click(await screen.findByRole('button', { name: 'Sim, excluir minha conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { name: 'Conta excluída' })).toBeInTheDocument();
    expect(simulados.confirmarExclusao).toHaveBeenNthCalledWith(2, TOKEN);
    expect(window.location.hash).toBe('');
  });

  it('servidor indisponível: aviso e o botão continua disponível', async () => {
    simulados.confirmarExclusao.mockRejectedValue({ tipo: 'indisponivel' });
    const usuario = userEvent.setup();
    montar();

    await usuario.click(await screen.findByRole('button', { name: 'Sim, excluir minha conta' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Serviço indisponível'));
    expect(botaoConfirmar()).toBeInTheDocument();
  });
});
