import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarApp } from './app';
import { limparTexto, logar } from './log';
import { bancoDisponivel, chamar, ESCRITA } from './testes-suporte';
import {
  ACEITE,
  appDeAcesso,
  cookieSid,
  emailAleatorio,
  entrarComo,
  obter,
  postar,
  SENHA_BOA,
} from './testes-suporte-acesso';

/**
 * Scrubbing (G-46, CA-20.8, TM-OBS-02): e-mail, senha e tokens nunca aparecem no log.
 * Espia todo o console durante fluxos completos de acesso, inclusive falhas.
 */
afterEach(() => vi.restoreAllMocks());

function espiarConsole() {
  const linhas: string[] = [];
  for (const nivel of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, nivel).mockImplementation((...args: unknown[]) => {
      linhas.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
  return linhas;
}

describe('limpeza do logger', () => {
  it('remove e-mails e sequências com cara de token; mantém o id de correlação (UUID)', () => {
    const id = crypto.randomUUID();
    const texto = `falha para ana.souza+x@exemplo.com.br token=${'a1B2_c3-'.repeat(6)} id=${id}`;
    const limpo = limparTexto(texto);
    expect(limpo).not.toContain('ana.souza');
    expect(limpo).not.toContain('a1B2_c3-a1B2');
    expect(limpo).toContain(id);
  });

  it('logar aplica a limpeza a todos os campos de texto', () => {
    const linhas = espiarConsole();
    logar('warn', 'evento', { detalhe: 'contato: pessoa@exemplo.com', n: 3 });
    expect(linhas.join('\n')).not.toContain('pessoa@exemplo.com');
    expect(linhas.join('\n')).toContain('"n":3');
  });
});

describe.skipIf(!bancoDisponivel)('fluxos de acesso não registram dado pessoal', () => {
  it('cadastro, confirmação, entrar (certo, errado, bloqueado), sessão, sair, esqueci e redefinir: nada vaza', async () => {
    const linhas = espiarConsole();
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio('segredo');
    const senhaErrada = 'senha-errada-secreta-1';
    await postar(app, '/api/cadastro', { nome: 'Nome Secreto', email, senha: SENHA_BOA, aceite: ACEITE });
    const tokenConfirmacao = caixa.ultimoToken(email);
    // de novo, com o mesmo e-mail: caminho "você já tem conta"
    await postar(app, '/api/cadastro', { nome: 'Nome Secreto', email, senha: SENHA_BOA, aceite: ACEITE });
    await postar(app, '/api/cadastro/confirmar', { token: tokenConfirmacao });
    await postar(app, '/api/cadastro/confirmar', { token: tokenConfirmacao });
    const sessao = await entrarComo(app, email);
    await obter(app, '/api/sessao', { cookie: cookieSid(sessao) });
    for (let i = 0; i < 6; i += 1)
      await postar(app, '/api/sessao/entrar', { email, senha: senhaErrada }, { ip: '198.51.100.23' });
    await postar(app, '/api/senha/esqueci', { email });
    const tokenRecuperacao = caixa.ultimoToken(email);
    await postar(app, '/api/senha/redefinir', { token: tokenRecuperacao, senha: 'curta' });
    await postar(app, '/api/senha/redefinir', { token: tokenRecuperacao, senha: 'nova-senha-secreta-9' });
    await postar(app, '/api/sessao/sair', {}, { cookie: cookieSid(sessao) });

    const log = linhas.join('\n');
    for (const segredo of [
      email,
      email.split('@')[0] ?? email,
      SENHA_BOA,
      senhaErrada,
      'nova-senha-secreta-9',
      tokenConfirmacao,
      tokenRecuperacao,
      sessao,
      '198.51.100.23',
      'Nome Secreto',
    ]) {
      expect(log).not.toContain(segredo);
    }
  });

  it('erro inesperado numa rota de acesso com e-mail e senha no corpo: o log tem só o nome do erro', async () => {
    const linhas = espiarConsole();
    const email = emailAleatorio('corpo');
    // banco fora do ar no meio do cadastro: o corpo tinha e-mail e senha
    const r = await chamar(
      criarApp(),
      '/api/cadastro',
      {
        method: 'POST',
        headers: { ...ESCRITA, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Ana', email, senha: SENHA_BOA, aceite: ACEITE }),
      },
      { HYPERDRIVE: { connectionString: 'postgres://x:x@127.0.0.1:1/x' } as Hyperdrive, LIMITE_PUBLICO: undefined },
    );
    expect(r.status).toBe(503);
    const corpo = await r.text();
    const log = linhas.join('\n');
    for (const segredo of [email, SENHA_BOA]) {
      expect(corpo).not.toContain(segredo);
      expect(log).not.toContain(segredo);
    }
  });

  it('config inválida falha fechada (500) sem logar o valor da variável', async () => {
    const linhas = espiarConsole();
    const valorSecreto = 'valor-secreto-da-chave-hmac-que-nao-tem-o-formato';
    const r = await postar(
      appDeAcesso().app,
      '/api/senha/esqueci',
      { email: emailAleatorio() },
      { ajustes: { CHAVE_HMAC: valorSecreto } },
    );
    expect(r.status).toBe(500);
    const log = linhas.join('\n');
    expect(log).toContain('ConfigInvalida');
    expect(log).not.toContain(valorSecreto);
    expect(await r.text()).not.toContain(valorSecreto);
  });
});
