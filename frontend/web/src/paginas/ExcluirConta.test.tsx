import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fila } from '../../test/apoio/apoioFila';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  chamadasDeExclusao,
  criarServidorConta,
  instalarApiConta,
  type ServidorConta,
} from '../../test/apoio/apiConta';
import { TEXTO_SEM_REDE_EXCLUSAO } from '../rotulos/conta';

/**
 * Ajustes, Conta, "Excluir minha conta" (etapa 14, lote 2). Critérios: RN-26 e CA-26.1 (pedir não exclui nada; o link do
 * e-mail confirma), CA-26.2 (bloqueio por 30 dias, apagamento depois), CA-26.7 (titular com convidado encerra o lar dela
 * também). O pedido exige a senha e a rede, não entra na fila offline, e a senha nunca vai a armazenamento local nem à URL.
 */

let servidor: ServidorConta;

configure({ asyncUtilTimeout: 5000 });
beforeAll(preAquecerPaginas, 30_000);
beforeEach(async () => {
  servidor = criarServidorConta();
  instalarApiConta(servidor);
  await limparAparelho();
});
afterEach(() => vi.unstubAllGlobals());

const CONTA = '/app/ajustes/conta';
/** Itens guardados na fila offline do usuário da sessão. */
const itensDaFila = () => fila.listar();
const SENHA = 'senha-secreta-12345';
const campo = () => screen.findByLabelText('Sua senha atual');
const botao = () => screen.getByRole('button', { name: 'Enviar link de exclusão' });

describe('Ajustes leva à exclusão', () => {
  it('o grupo Conta tem "Excluir minha conta", que abre /app/ajustes/conta', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    const grupo = await screen.findByRole('region', { name: 'Conta' });
    const link = within(grupo).getByRole('link', { name: /Excluir minha conta/ });
    expect(link).toHaveAttribute('href', CONTA);
    await usuario.click(link);

    expect(await screen.findByRole('heading', { level: 1, name: 'Conta' })).toBeInTheDocument();
    expect(local()).toBe(CONTA);
  });
});

describe('a explicação antes de pedir', () => {
  it('diz o que acontece: link por e-mail, bloqueio por 30 dias, apagamento e assinatura cancelada', async () => {
    montarApp(CONTA);

    const secao = await screen.findByRole('region', { name: 'Excluir minha conta' });
    expect(secao).toHaveTextContent('link por e-mail');
    expect(secao).toHaveTextContent('nada é excluído');
    expect(secao).toHaveTextContent('bloqueada por 30 dias');
    expect(secao).toHaveTextContent('tudo é apagado');
    expect(secao).toHaveTextContent('assinatura, que é cancelada');
  });

  it('o titular é avisado de que o lar da outra pessoa também é encerrado (CA-26.7)', async () => {
    montarApp(CONTA);

    expect(await screen.findByText(/o lar dela também será encerrado/)).toBeInTheDocument();
    expect(screen.queryByText(/Como você usa o lar de outra pessoa/)).not.toBeInTheDocument();
  });

  it('o convidado vê o aviso próprio: individual apagado, o pago em conjunto fica como Ex-membro', async () => {
    servidor.papel = 'membro';
    montarApp(CONTA);

    expect(await screen.findByText(/Como você usa o lar de outra pessoa/)).toBeInTheDocument();
    expect(screen.getByText(/Ex-membro/)).toBeInTheDocument();
    expect(screen.queryByText(/o lar dela também será encerrado/)).not.toBeInTheDocument();
  });

  it('o campo da senha tem rótulo, é de senha e o formulário tem nome (acessibilidade)', async () => {
    montarApp(CONTA);

    const senha = await campo();
    expect(senha).toHaveAttribute('type', 'password');
    expect(senha).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('form', { name: 'Pedir a exclusão da conta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para Ajustes' })).toHaveAttribute('href', '/app/ajustes');
  });
});

describe('pedir a exclusão', () => {
  it('sem senha não envia e diz o que falta', async () => {
    const usuario = userEvent.setup();
    montarApp(CONTA);
    await campo();

    await usuario.click(botao());

    expect(await screen.findByText('Informe a senha.')).toBeInTheDocument();
    expect(chamadasDeExclusao(servidor)).toHaveLength(0);
  });

  it('envia POST /api/conta/exclusao só com a senha e mostra "enviamos o link" (202); nada é excluído', async () => {
    const usuario = userEvent.setup();
    montarApp(CONTA);

    await usuario.type(await campo(), SENHA);
    await usuario.click(botao());

    expect(await screen.findByText(/Enviamos o link para ana@exemplo.com/)).toBeInTheDocument();
    const envio = chamadasDeExclusao(servidor);
    expect(envio).toHaveLength(1);
    expect(envio[0]).toMatchObject({ metodo: 'POST', url: '/api/conta/exclusao', corpo: { senha: SENHA } });
    expect(envio[0]!.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    // Nada além do pedido: nem confirmar nem sair; a sessão continua valendo.
    expect(servidor.chamadas.filter((c) => c.url.includes('confirmar') || c.url.includes('sair'))).toHaveLength(0);
    expect(screen.queryByLabelText('Sua senha atual')).not.toBeInTheDocument();
  });

  it('a senha nunca vai a localStorage, sessionStorage, fila nem URL', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(CONTA);

    await usuario.type(await campo(), SENHA);
    await usuario.click(botao());
    await screen.findByText(/Enviamos o link/);

    expect(JSON.stringify([{ ...localStorage }, { ...sessionStorage }])).not.toContain(SENHA);
    expect(local()).not.toContain(SENHA);
    expect(JSON.stringify(await itensDaFila())).not.toContain(SENHA);
    expect(servidor.chamadas.every((c) => !c.url.includes(SENHA))).toBe(true);
  });

  it('"Pedir outro link" volta ao formulário, com a senha vazia', async () => {
    const usuario = userEvent.setup();
    montarApp(CONTA);
    await usuario.type(await campo(), SENHA);
    await usuario.click(botao());
    await screen.findByText(/Enviamos o link/);

    await usuario.click(screen.getByRole('button', { name: 'Pedir outro link' }));

    expect(await campo()).toHaveValue('');
  });

  it('senha errada (400 credenciais_invalidas): erro no campo e a senha digitada é apagada', async () => {
    servidor.pedido = { status: 400, code: 'credenciais_invalidas' };
    const usuario = userEvent.setup();
    montarApp(CONTA);

    await usuario.type(await campo(), 'errada-123456789');
    await usuario.click(botao());

    expect(await screen.findByText('Senha incorreta.')).toBeInTheDocument();
    expect(screen.getByLabelText('Sua senha atual')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Sua senha atual')).toHaveValue('');
    expect(screen.queryByText(/Enviamos o link/)).not.toBeInTheDocument();
  });

  it('muitas tentativas (429): aviso de espera, sem dizer que a senha está errada', async () => {
    servidor.pedido = { status: 429, code: 'muitas_tentativas' };
    const usuario = userEvent.setup();
    montarApp(CONTA);

    await usuario.type(await campo(), SENHA);
    await usuario.click(botao());

    expect(await screen.findByText(/Muitas tentativas\. Aguarde alguns minutos/)).toBeInTheDocument();
    expect(screen.queryByText('Senha incorreta.')).not.toBeInTheDocument();
  });

  it('sem rede: avisa que exige internet, não guarda na fila e deixa tentar de novo', async () => {
    servidor.semRedeNaExclusao = true;
    const usuario = userEvent.setup();
    montarApp(CONTA);

    await usuario.type(await campo(), SENHA);
    await usuario.click(botao());

    expect(await screen.findByText(TEXTO_SEM_REDE_EXCLUSAO)).toBeInTheDocument();
    expect(await itensDaFila()).toEqual([]);
    servidor.semRedeNaExclusao = false;
    await usuario.type(screen.getByLabelText('Sua senha atual'), SENHA);
    await usuario.click(botao());
    expect(await screen.findByText(/Enviamos o link/)).toBeInTheDocument();
  });

  it('enquanto envia, um segundo clique não repete o pedido', async () => {
    const usuario = userEvent.setup();
    montarApp(CONTA);
    await usuario.type(await campo(), SENHA);

    await usuario.dblClick(botao());

    await waitFor(() => expect(screen.getByText(/Enviamos o link/)).toBeInTheDocument());
    expect(chamadasDeExclusao(servidor)).toHaveLength(1);
  });
});
