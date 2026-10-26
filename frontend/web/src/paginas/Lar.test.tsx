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
