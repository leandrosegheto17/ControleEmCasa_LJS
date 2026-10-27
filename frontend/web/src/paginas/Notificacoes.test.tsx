import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  ENDPOINT,
  chamadasDePush,
  recalcularInstalacao,
  criarServidorPush,
  instalarApiPush,
  simularNavegadorPush,
  type NavegadorPush,
  type ServidorPush,
} from '../../test/apoio/apiPush';
import { ROTULO_ERRO } from '../rotulos/erros';
import {
  TEXTO_ATIVA,
  TEXTO_INDISPONIVEL_PUSH,
  TEXTO_NEGADA,
  TEXTO_PERMISSAO_IGNORADA,
  TEXTO_SEM_REDE_PUSH,
  TEXTO_SEM_SUPORTE,
} from '../rotulos/push';

/**
 * Ajustes, Notificações (etapa 15, lote 2). Critérios: RN-27 (CA-27.5: ativar neste aparelho pede a permissão só no
 * clique e registra a inscrição; CA-27.8: desativar remove; as preferências por tipo, com o objeto completo), SDD 9.3
 * (estados do navegador; iOS fora da Tela de Início só com instrução; exige rede, fora da fila offline). Não afirma
 * entrega real de push: o navegador e o serviço de push são simulados.
 */

let servidor: ServidorPush;
let navegador: NavegadorPush | null = null;

configure({ asyncUtilTimeout: 5000 });
beforeAll(preAquecerPaginas, 30_000);
beforeEach(async () => {
  servidor = criarServidorPush();
  instalarApiPush(servidor);
  await limparAparelho();
});
afterEach(() => {
  navegador?.desfazer();
  navegador = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  recalcularInstalacao();
});

const TELA = '/app/ajustes/notificacoes';
const ativar = () => screen.findByRole('button', { name: 'Ativar neste aparelho' });

describe('Ajustes leva às notificações', () => {
  it('o grupo Avisos tem "Notificações", que abre /app/ajustes/notificacoes', async () => {
    navegador = simularNavegadorPush();
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/ajustes');

    const link = within(await screen.findByRole('region', { name: 'Avisos' })).getByRole('link', {
      name: /Notificações/,
    });
    expect(link).toHaveAttribute('href', TELA);
    await usuario.click(link);

    expect(await screen.findByRole('heading', { level: 1, name: 'Notificações' })).toBeInTheDocument();
    expect(local()).toBe(TELA);
  });
});

describe('estados do navegador', () => {
  it('sem suporte: explica e não oferece ativar', async () => {
    montarApp(TELA);
    expect(await screen.findByText(TEXTO_SEM_SUPORTE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ativar neste aparelho' })).not.toBeInTheDocument();
  });

  it('permissão negada: explica como liberar nas configurações e não oferece ativar', async () => {
    navegador = simularNavegadorPush({ permissao: 'denied' });
    montarApp(TELA);
    expect(await screen.findByText(TEXTO_NEGADA)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ativar neste aparelho' })).not.toBeInTheDocument();
  });

  it('não pedida: oferece ativar e NÃO pede a permissão ao abrir a tela', async () => {
    navegador = simularNavegadorPush();
    montarApp(TELA);
    await ativar();
    expect(navegador.pedidos).toBe(0);
    expect(chamadasDePush(servidor).some((c) => c.url === '/api/push/chave')).toBe(false);
  });

  it('ativa neste aparelho: mostra o estado e oferece desativar', async () => {
    navegador = simularNavegadorPush({ permissao: 'granted', inscrito: true });
    montarApp(TELA);
    expect(await screen.findByText(TEXTO_ATIVA)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desativar neste aparelho' })).toBeInTheDocument();
  });
});

describe('iOS fora da Tela de Início', () => {
  it('mostra só a instrução de instalação, em português, sem imagem e sem botão de ativar', async () => {
    navegador = simularNavegadorPush();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    );
    recalcularInstalacao();
    montarApp(TELA);

    const secao = await screen.findByRole('region', { name: 'Instale o app para receber avisos' });
    expect(secao).toHaveTextContent('iOS 16.4');
    expect(secao).toHaveTextContent('Compartilhar');
    expect(secao).toHaveTextContent('Adicionar à Tela de Início');
    expect(secao.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ativar neste aparelho' })).not.toBeInTheDocument();
  });
});

describe('ativar neste aparelho (CA-27.5)', () => {
  it('pede a permissão no clique, busca a chave, assina com userVisibleOnly e envia só endpoint e keys', async () => {
    navegador = simularNavegadorPush();
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await ativar());

    expect(await screen.findByText(TEXTO_ATIVA)).toBeInTheDocument();
    expect(navegador.pedidos).toBe(1);
    const opcoes = navegador.subscribe.mock.calls[0]?.[0] as {
      userVisibleOnly: boolean;
      applicationServerKey: Uint8Array;
    };
    expect(opcoes.userVisibleOnly).toBe(true);
    expect(opcoes.applicationServerKey).toHaveLength(65);
    const envio = chamadasDePush(servidor).find((c) => c.url === '/api/push/assinaturas');
    expect(envio).toMatchObject({
      metodo: 'POST',
      corpo: { endpoint: ENDPOINT, keys: { p256dh: 'p256dh-x', auth: 'auth-x' } },
    });
    expect(envio?.corpo).not.toHaveProperty('expirationTime');
    expect(servidor.assinaturas).toEqual([ENDPOINT]);
  });

  it('permissão recusada no pedido: não busca chave nem assina, e a tela passa a explicar o bloqueio', async () => {
    navegador = simularNavegadorPush({ respostaDoPedido: 'denied' });
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await ativar());

    expect(await screen.findByText(TEXTO_NEGADA)).toBeInTheDocument();
    expect(navegador.subscribe).not.toHaveBeenCalled();
    expect(servidor.assinaturas).toEqual([]);
  });

  it('pedido fechado sem resposta: avisa e deixa tentar de novo', async () => {
    navegador = simularNavegadorPush({ respostaDoPedido: 'default' });
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await ativar());

    expect(await screen.findByText(TEXTO_PERMISSAO_IGNORADA)).toHaveAttribute('role', 'alert');
    expect(await ativar()).toBeEnabled();
  });

  it('503 na chave: "avisos indisponíveis agora" e nada é assinado', async () => {
    navegador = simularNavegadorPush();
    servidor.falhas.chave = { status: 503, code: 'indisponivel' };
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await ativar());

    expect(await screen.findByText(TEXTO_INDISPONIVEL_PUSH)).toHaveAttribute('role', 'alert');
    expect(navegador.subscribe).not.toHaveBeenCalled();
  });

  it('sem rede: mensagem clara, sem fila offline', async () => {
    navegador = simularNavegadorPush();
    servidor.falhas.chave = 'rede';
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await ativar());

    expect(await screen.findByText(TEXTO_SEM_REDE_PUSH)).toHaveAttribute('role', 'alert');
  });

  it('o servidor recusar a inscrição desfaz a inscrição criada no navegador', async () => {
    navegador = simularNavegadorPush();
    servidor.falhas.assinar = { status: 409, code: 'sem_lar' };
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await ativar());

    expect(await screen.findByText(ROTULO_ERRO.sem_lar.texto)).toHaveAttribute('role', 'alert');
    const criada = (await navegador.subscribe.mock.results[0]?.value) as { unsubscribe: ReturnType<typeof vi.fn> };
    expect(criada.unsubscribe).toHaveBeenCalled();
  });
});

describe('desativar neste aparelho (CA-27.8)', () => {
  it('remove no servidor, cancela a inscrição do navegador e volta a oferecer ativar', async () => {
    navegador = simularNavegadorPush({ permissao: 'granted', inscrito: true });
    servidor.assinaturas = [ENDPOINT];
    const inscricao = navegador.inscricao;
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await screen.findByRole('button', { name: 'Desativar neste aparelho' }));

    await waitFor(() => expect(inscricao?.unsubscribe).toHaveBeenCalled());
    expect(chamadasDePush(servidor).find((c) => c.metodo === 'DELETE')).toMatchObject({
      url: '/api/push/assinaturas',
      corpo: { endpoint: ENDPOINT },
    });
    expect(servidor.assinaturas).toEqual([]);
  });

  it('falha no servidor: avisa e mantém a inscrição para tentar de novo', async () => {
    navegador = simularNavegadorPush({ permissao: 'granted', inscrito: true });
    servidor.falhas.remover = 'rede';
    const inscricao = navegador.inscricao;
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await screen.findByRole('button', { name: 'Desativar neste aparelho' }));

    expect(await screen.findByText(TEXTO_SEM_REDE_PUSH)).toHaveAttribute('role', 'alert');
    expect(inscricao?.unsubscribe).not.toHaveBeenCalled();
  });
});

describe('preferências (RN-27)', () => {
  it('mostra os padrões e salva o objeto completo ao ligar o lembrete e trocar a hora (0 a 23)', async () => {
    navegador = simularNavegadorPush();
    const usuario = userEvent.setup();
    montarApp(TELA);

    const hora = await screen.findByLabelText('Horário do lembrete');
    expect(hora).toBeDisabled();
    expect(hora).toHaveValue('20');
    expect(within(hora).getAllByRole('option')).toHaveLength(24);

    await usuario.click(screen.getByRole('switch', { name: /Lembrete diário/ }));
    await waitFor(() => expect(servidor.preferencias.lembrete_diario).toBe(true));
    expect(chamadasDePush(servidor).find((c) => c.metodo === 'PUT')?.corpo).toEqual({
      fixas: true,
      lembrete_diario: true,
      lembrete_hora: 20,
      metas: true,
    });

    await waitFor(() => expect(hora).toBeEnabled());
    await usuario.selectOptions(hora, '0');
    await waitFor(() => expect(servidor.preferencias.lembrete_hora).toBe(0));
    await usuario.selectOptions(hora, '23');
    await waitFor(() => expect(servidor.preferencias.lembrete_hora).toBe(23));
    expect(servidor.preferencias).toEqual({ fixas: true, lembrete_diario: true, lembrete_hora: 23, metas: true });
  });

  it('desligar "Metas" e "Despesas fixas" mantém os outros campos no PUT', async () => {
    navegador = simularNavegadorPush();
    servidor.preferencias = { fixas: true, lembrete_diario: true, lembrete_hora: 7, metas: true };
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await screen.findByRole('switch', { name: /Metas/ }));
    await waitFor(() => expect(servidor.preferencias.metas).toBe(false));
    await usuario.click(screen.getByRole('switch', { name: /Despesas fixas/ }));
    await waitFor(() => expect(servidor.preferencias.fixas).toBe(false));
    expect(servidor.preferencias).toEqual({ fixas: false, lembrete_diario: true, lembrete_hora: 7, metas: false });
  });

  it('erro ao salvar: mostra o aviso e não finge que salvou', async () => {
    navegador = simularNavegadorPush();
    servidor.falhas.salvar = { status: 503, code: 'indisponivel' };
    const usuario = userEvent.setup();
    montarApp(TELA);

    await usuario.click(await screen.findByRole('switch', { name: /Metas/ }));

    expect(await screen.findByText(TEXTO_INDISPONIVEL_PUSH)).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('switch', { name: /Metas/ })).toBeChecked();
  });
});
