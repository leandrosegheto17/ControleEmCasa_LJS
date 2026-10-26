import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Confirmar } from './Confirmar';

const simulados = vi.hoisted(() => ({ confirmar: vi.fn(), reenviar: vi.fn() }));

vi.mock('../dados/sessao', () => ({
  confirmar: simulados.confirmar,
  reenviar: simulados.reenviar,
  obterSessao: vi.fn(async () => null),
  donoLembrado: vi.fn(() => undefined),
}));

const TOKEN = 'token-de-confirmacao-de-teste';

function montar() {
  const consulta = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={consulta}>
        <MemoryRouter>
          <Confirmar />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', `/confirmar#t=${TOKEN}`);
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('Confirmar e-mail (CA-19.2)', () => {
  it('envia o token do fragmento uma única vez, mesmo no StrictMode, e confirma', async () => {
    simulados.confirmar.mockResolvedValue(undefined);
    montar();

    expect(await screen.findByRole('heading', { name: 'E-mail confirmado' })).toBeInTheDocument();
    expect(simulados.confirmar).toHaveBeenCalledTimes(1);
    expect(simulados.confirmar).toHaveBeenCalledWith(TOKEN);
    expect(screen.getByRole('link', { name: 'Ir para Entrar' })).toHaveAttribute('href', '/entrar');
  });

  it('o token sai do endereço e não aparece em nenhum texto da tela', async () => {
    simulados.confirmar.mockResolvedValue(undefined);
    const { container } = montar();

    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(window.location.href).not.toContain(TOKEN);
    expect(container.innerHTML).not.toContain(TOKEN);
  });

  it('o token nunca é escrito no console', async () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    simulados.confirmar.mockRejectedValue({ tipo: 'regra', codigo: 'link_expirado' });
    montar();
    await screen.findByRole('alert');

    for (const e of espioes) {
      expect(JSON.stringify(e.mock.calls)).not.toContain(TOKEN);
      e.mockRestore();
    }
  });

  it('link expirado ou já usado: aviso e pedido de novo link, sem revelar nada', async () => {
    simulados.confirmar.mockRejectedValue({ tipo: 'regra', codigo: 'link_expirado' });
    simulados.reenviar.mockResolvedValue(undefined);
    const user = userEvent.setup();
    montar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/expirou ou já foi usado/);
    await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await user.click(screen.getByRole('button', { name: 'Reenviar link de confirmação' }));

    await waitFor(() => expect(simulados.reenviar).toHaveBeenCalledWith('ana@exemplo.com'));
    expect(await screen.findByText(/Se o e-mail tiver um cadastro pendente/)).toBeInTheDocument();
  });

  it('sem token no endereço: link expirado e nada é enviado', async () => {
    window.history.replaceState(null, '', '/confirmar');
    montar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/expirou/);
    expect(simulados.confirmar).not.toHaveBeenCalled();
  });

  it('sem rede: "Sem conexão."', async () => {
    simulados.confirmar.mockRejectedValue({ tipo: 'rede' });
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
  });
});
