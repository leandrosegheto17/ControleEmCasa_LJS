import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../../comum/versoes';
import { Privacidade, Termos } from '../PaginaLegal';
import { AceitarTermos } from './AceitarTermos';
import { BemVindo } from './BemVindo';

const simulados = vi.hoisted(() => ({ criarLar: vi.fn(), aceitarTermos: vi.fn() }));

vi.mock('../../dados/sessao', () => ({
  obterSessao: vi.fn(async () => null),
  donoLembrado: vi.fn(() => undefined),
}));
vi.mock('../../dados/lar', () => ({ criarLar: simulados.criarLar, aceitarTermos: simulados.aceitarTermos }));

function montar(tela: React.ReactNode) {
  const consulta = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const resultado = render(
    <QueryClientProvider client={consulta}>
      <MemoryRouter>{tela}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { consulta, ...resultado };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Aceitar termos (CA-19.7)', () => {
  it('registra o aceite com as versões vigentes e relê a sessão', async () => {
    simulados.aceitarTermos.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { consulta } = montar(<AceitarTermos />);
    const invalidar = vi.spyOn(consulta, 'invalidateQueries');

    await user.click(screen.getByRole('button', { name: 'Li e aceito' }));

    await waitFor(() =>
      expect(simulados.aceitarTermos).toHaveBeenCalledWith({ termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE }),
    );
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['sessao'] }));
  });

  it('liga aos textos legais e mostra erro de rede', async () => {
    simulados.aceitarTermos.mockRejectedValue({ tipo: 'rede' });
    const user = userEvent.setup();
    montar(<AceitarTermos />);
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos');

    await user.click(screen.getByRole('button', { name: 'Li e aceito' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão.');
  });
});

describe('Bem-vindo (primeiro acesso, sessão sem lar)', () => {
  it('cria o lar sem nome quando o campo fica vazio', async () => {
    simulados.criarLar.mockResolvedValue({ id: 'x', nome: 'Lar de Ana' });
    const user = userEvent.setup();
    montar(<BemVindo />);

    await user.click(screen.getByRole('button', { name: 'Criar meu lar' }));

    await waitFor(() => expect(simulados.criarLar).toHaveBeenCalledWith(undefined));
  });

  it('cria o lar com o nome informado e relê a sessão', async () => {
    simulados.criarLar.mockResolvedValue({ id: 'x', nome: 'Casa' });
    const user = userEvent.setup();
    const { consulta } = montar(<BemVindo />);
    const invalidar = vi.spyOn(consulta, 'invalidateQueries');

    await user.type(screen.getByLabelText('Nome do lar (opcional)'), '  Casa ');
    await user.click(screen.getByRole('button', { name: 'Criar meu lar' }));

    await waitFor(() => expect(simulados.criarLar).toHaveBeenCalledWith('Casa'));
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['sessao'] }));
  });

  it('explica como entrar num lar por convite e mostra o erro de regra com texto próprio', async () => {
    simulados.criarLar.mockRejectedValue({ tipo: 'regra', codigo: 'ja_tem_lar' });
    const user = userEvent.setup();
    montar(<BemVindo />);
    expect(screen.getByText(/Recebeu um convite\? Abra o link/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Criar meu lar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você já faz parte de um lar.');
  });
});

describe('Páginas legais', () => {
  it('Termos e Privacidade mostram a versão e avisam que o texto é provisório', () => {
    const { unmount } = montar(<Termos />);
    expect(screen.getByRole('heading', { level: 1, name: 'Termos de uso' })).toBeInTheDocument();
    expect(screen.getByText(/Texto provisório/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(VERSAO_TERMOS))).toBeInTheDocument();
    unmount();

    montar(<Privacidade />);
    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeInTheDocument();
    expect(screen.getByText(/Texto provisório/)).toBeInTheDocument();
  });
});
