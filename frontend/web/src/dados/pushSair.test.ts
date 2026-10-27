import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENDPOINT,
  chamadasDePush,
  criarServidorPush,
  instalarApiPush,
  simularNavegadorPush,
  type NavegadorPush,
  type ServidorPush,
} from '../../test/apoio/apiPush';
import { limparAparelho } from './aparelho';
import { sair, sairDeTodos } from './sessao';

/**
 * Sair com push (etapa 15, lote 2). Critérios: G-39 (ao sair, a inscrição deste aparelho sai do servidor e do navegador
 * ANTES de a sessão ser revogada; falha de rede ali não impede o logout) e RN-27 ("sair de todos" já remove tudo no
 * servidor: o navegador só cancela a inscrição local).
 */

let servidor: ServidorPush;
let navegador: NavegadorPush;

beforeEach(async () => {
  servidor = criarServidorPush();
  instalarApiPush(servidor);
  navegador = simularNavegadorPush({ permissao: 'granted', inscrito: true });
  servidor.assinaturas = [ENDPOINT];
  await limparAparelho();
});
afterEach(() => {
  navegador.desfazer();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sair', () => {
  it('remove a inscrição no servidor e no navegador antes de revogar a sessão', async () => {
    const inscricao = navegador.inscricao;

    await sair();

    expect(servidor.ordem).toEqual(['delete_assinatura', 'sair']);
    expect(chamadasDePush(servidor).find((c) => c.metodo === 'DELETE')?.corpo).toEqual({ endpoint: ENDPOINT });
    expect(inscricao?.unsubscribe).toHaveBeenCalled();
  });

  it('o DELETE falhar por rede não impede o logout, e a inscrição local é cancelada', async () => {
    servidor.falhas.remover = 'rede';
    const inscricao = navegador.inscricao;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(sair()).resolves.toBeUndefined();

    expect(servidor.ordem).toEqual(['delete_assinatura', 'sair']);
    expect(inscricao?.unsubscribe).toHaveBeenCalled();
  });

  it('o DELETE responder erro do servidor também não impede o logout', async () => {
    servidor.falhas.remover = { status: 503, code: 'indisponivel' };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(sair()).resolves.toBeUndefined();
    expect(servidor.ordem).toContain('sair');
  });

  it('sem inscrição neste aparelho, não chama o DELETE', async () => {
    navegador.inscricao = null;
    await sair();
    expect(servidor.ordem).toEqual(['sair']);
  });
});

describe('sair de todos', () => {
  it('cancela a inscrição do navegador sem chamar o DELETE (o servidor já removeu tudo)', async () => {
    const inscricao = navegador.inscricao;

    await sairDeTodos();

    expect(inscricao?.unsubscribe).toHaveBeenCalled();
    expect(servidor.ordem).not.toContain('delete_assinatura');
  });
});
