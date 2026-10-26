import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../comum/versoes';
import { Cadastro, TEXTO_CADASTRO_ENVIADO } from './Cadastro';

const simulados = vi.hoisted(() => ({ cadastrar: vi.fn(), reenviar: vi.fn() }));

vi.mock('../dados/sessao', () => ({
  cadastrar: simulados.cadastrar,
  reenviar: simulados.reenviar,
  entrar: vi.fn(),
  obterSessao: vi.fn(async () => null),
  donoLembrado: vi.fn(() => undefined),
}));

const SENHA = 'senha-bem-longa-1';

function montar() {
  const consulta = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={consulta}>
      <MemoryRouter>
        <Cadastro />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function preencher(user: ReturnType<typeof userEvent.setup>, o: { senha?: string; aceitar?: boolean } = {}) {
  await user.type(screen.getByLabelText('Nome'), 'Ana Souza');
  await user.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
  await user.type(screen.getByLabelText('Senha'), o.senha ?? SENHA);
  if (o.aceitar !== false) await user.click(screen.getByRole('checkbox'));
}

const criar = () => screen.getByRole('button', { name: 'Criar conta' });

beforeEach(() => {
  vi.clearAllMocks();
  simulados.cadastrar.mockResolvedValue(undefined);
  simulados.reenviar.mockResolvedValue(undefined);
});

describe('Cadastro (CA-19.1, CA-19.3, CA-19.4, CA-19.7)', () => {
  it('campos com rótulo e autocomplete, regra da senha e links dos termos', () => {
    montar();
    expect(screen.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByText('Pelo menos 12 caracteres.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos');
    expect(screen.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '/privacidade');
  });

  it('envia nome, e-mail, senha e as versões vigentes dos termos e da privacidade', async () => {
    const user = userEvent.setup();
    montar();
    await preencher(user);
    await user.click(criar());

    await waitFor(() => expect(simulados.cadastrar).toHaveBeenCalledTimes(1));
    expect(simulados.cadastrar).toHaveBeenCalledWith({
      nome: 'Ana Souza',
      email: 'ana@exemplo.com',
      senha: SENHA,
      aceite: { termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE },
    });
  });

  it('sem aceitar os termos não envia e foca o aceite', async () => {
    const user = userEvent.setup();
    montar();
    await preencher(user, { aceitar: false });
    await user.click(criar());

    expect(simulados.cadastrar).not.toHaveBeenCalled();
    expect(screen.getByText(/Aceite os Termos de uso/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toHaveFocus();
  });

  it('senha de 11 caracteres: erro no campo e nada enviado (CA-19.4)', async () => {
    const user = userEvent.setup();
    montar();
    await preencher(user, { senha: '12345678901' });
    await user.click(criar());

    expect(simulados.cadastrar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription('Use pelo menos 12 caracteres.');
  });

  it('senha acima de 72 bytes é recusada no campo', async () => {
    const user = userEvent.setup();
    montar();
    await preencher(user, { senha: 'a'.repeat(73) });
    await user.click(criar());

    expect(simulados.cadastrar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
  });

  it('nome e e-mail inválidos são recusados antes de enviar', async () => {
    const user = userEvent.setup();
    montar();
    await user.type(screen.getByLabelText('E-mail'), 'sem-arroba');
    await user.type(screen.getByLabelText('Senha'), SENHA);
    await user.click(screen.getByRole('checkbox'));
    await user.click(criar());

    expect(simulados.cadastrar).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
  });

  it('a resposta neutra mostra o mesmo texto, qualquer que seja o e-mail (CA-19.3)', async () => {
    const user = userEvent.setup();
    const primeiro = montar();
    await preencher(user);
    await user.click(criar());
    await screen.findByText(TEXTO_CADASTRO_ENVIADO);
    const textoA = primeiro.container.textContent?.replace('ana@exemplo.com', '');
    primeiro.unmount();

    const segundo = montar();
    await user.type(screen.getByLabelText('Nome'), 'Outra Pessoa');
    await user.type(screen.getByLabelText('E-mail'), 'existente@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), SENHA);
    await user.click(screen.getByRole('checkbox'));
    await user.click(criar());
    await screen.findByText(TEXTO_CADASTRO_ENVIADO);

    expect(segundo.container.textContent?.replace('existente@exemplo.com', '')).toBe(textoA);
    expect(screen.queryByText(/já (existe|tem|possui)/i)).toBeNull();
  });

  it('o servidor recusa por senha_fraca: o erro aparece no campo da senha', async () => {
    simulados.cadastrar.mockRejectedValue({ tipo: 'regra', codigo: 'senha_fraca' });
    const user = userEvent.setup();
    montar();
    await preencher(user);
    await user.click(criar());

    await waitFor(() => expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true'));
  });

  it('sem rede: "Sem conexão." no topo e dados mantidos', async () => {
    simulados.cadastrar.mockRejectedValue({ tipo: 'rede' });
    const user = userEvent.setup();
    montar();
    await preencher(user);
    await user.click(criar());

    expect(await screen.findByText('Sem conexão.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana Souza');
  });

  it('reenviar o link usa o e-mail do cadastro e responde igual (neutro)', async () => {
    const user = userEvent.setup();
    montar();
    await preencher(user);
    await user.click(criar());
    await screen.findByText(TEXTO_CADASTRO_ENVIADO);

    await user.click(screen.getByRole('button', { name: 'Reenviar link de confirmação' }));

    await waitFor(() => expect(simulados.reenviar).toHaveBeenCalledWith('ana@exemplo.com'));
    expect(await screen.findByText(/Se o e-mail tiver um cadastro pendente/)).toBeInTheDocument();
  });
});
