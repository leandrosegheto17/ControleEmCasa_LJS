import { afterEach, describe, expect, it, vi } from 'vitest';
import { lerConfig, type Config } from './config';
import { criarEnviadorDeEmail, criarTransporteResend, montarConteudo, URL_RESEND } from './infraestrutura/email';
import { transporteDoAmbiente } from './infraestrutura/transporte-email-ambiente';

/**
 * Módulo isolado de e-mail (SDD 2.2; decisão 4 do PLANO; G-34, G-36; TM-RES-02) e escolha do transporte.
 */
afterEach(() => vi.restoreAllMocks());

const fontesEmail = import.meta.glob('./infraestrutura/email/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('fronteira do módulo de e-mail', () => {
  it('não importa nada fora da própria pasta (nem banco, nem Hono, nem o resto da API)', () => {
    const arquivos = Object.entries(fontesEmail).filter(([c]) => !c.endsWith('.test.ts'));
    expect(arquivos.length).toBeGreaterThanOrEqual(3);
    for (const [caminho, codigo] of arquivos) {
      const imports = [...codigo.matchAll(/(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const alvo of imports) expect(alvo, `${caminho} importa ${alvo}`).toMatch(/^\.\/[^/]+$/);
    }
  });
});

describe('modelos', () => {
  it('escapa o nome no HTML e não deixa o texto do usuário virar link (G-36)', () => {
    const nome = '<script>alert(1)</script> visite https://golpe.exemplo';
    const c = montarConteudo('confirmacao', { nome, link: 'https://app.exemplo/confirmar#t=abc' });
    expect(c.html).not.toContain('<script>');
    expect(c.html).toContain('&lt;script&gt;');
    expect(c.html).not.toContain('https://golpe.exemplo');
    expect(c.texto).not.toContain('https://golpe.exemplo');
    // só os links da API são clicáveis
    expect([...c.html.matchAll(/<a /g)]).toHaveLength(1);
    expect(c.html).toContain('href="https://app.exemplo/confirmar#t=abc"');
  });

  it('recuperação e "você já tem conta" têm assunto próprio e o link certo', () => {
    expect(montarConteudo('recuperacao', { nome: 'Ana', link: 'https://x/redefinir-senha#t=1' }).texto).toContain(
      'https://x/redefinir-senha#t=1',
    );
    const existente = montarConteudo('conta_existente', {
      linkEntrar: 'https://x/entrar',
      linkRecuperar: 'https://x/redefinir-senha',
    });
    expect(existente.assunto).toMatch(/já tem conta/);
    expect(existente.texto).not.toContain('#t=');
  });
});

describe('transporte Resend via fetch', () => {
  it('faz POST no endpoint do Resend com a chave no Authorization e o remetente configurado', async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const fetchFalso = (async (url: string, init: RequestInit) => {
      chamadas.push({ url, init });
      return new Response('{"id":"x"}', { status: 200 });
    }) as unknown as typeof fetch;
    const enviador = criarEnviadorDeEmail(
      criarTransporteResend({ chaveApi: 're_teste', remetente: 'App <nao-responda@x.exemplo>', fetch: fetchFalso }),
    );
    const r = await enviador.enviarEmail({
      para: 'ana@exemplo.com',
      modelo: 'recuperacao',
      dados: { nome: 'Ana', link: 'https://x/redefinir-senha#t=1' },
    });
    expect(r).toEqual({ ok: true });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe(URL_RESEND);
    expect(chamadas[0]?.init.method).toBe('POST');
    expect((chamadas[0]?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer re_teste');
    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as Record<string, unknown>;
    expect(corpo).toMatchObject({ from: 'App <nao-responda@x.exemplo>', to: ['ana@exemplo.com'] });
    expect(corpo['subject']).toMatch(/Redefinir/);
  });

  it('erro HTTP ou de rede vira resultado, nunca exceção, e não repassa o corpo da resposta', async () => {
    const http = criarTransporteResend({
      chaveApi: 're_x',
      remetente: 'a <b@c.d>',
      fetch: (async () =>
        new Response('{"message":"ana@exemplo.com inválido"}', { status: 422 })) as unknown as typeof fetch,
    });
    const rede = criarTransporteResend({
      chaveApi: 're_x',
      remetente: 'a <b@c.d>',
      fetch: (async () => {
        throw new TypeError('network');
      }) as unknown as typeof fetch,
    });
    const msg = { para: 'ana@exemplo.com', assunto: 'a', texto: 'b', html: 'c' };
    expect(await http(msg)).toEqual({ ok: false, motivo: 'http', status: 422 });
    expect(await rede(msg)).toEqual({ ok: false, motivo: 'rede' });
  });
});

describe('transporte por ambiente (SDD 11.2)', () => {
  const base: Config = {
    urlPublica: 'https://x.exemplo',
    ambiente: 'teste',
    remetente: 'a <b@c.d>',
    chaveHmac: 'A'.repeat(43),
    resendApiKey: undefined,
  };

  it('em teste, nunca usa o Resend nem o console, mesmo com chave', async () => {
    const espiao = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const fetchEspiao = vi.spyOn(globalThis, 'fetch');
    const t = transporteDoAmbiente({ ...base, resendApiKey: 're_real' });
    await t({ para: 'ana@exemplo.com', assunto: 'a', texto: 'https://x/confirmar#t=segredo', html: '' });
    expect(fetchEspiao).not.toHaveBeenCalled();
    expect(espiao).not.toHaveBeenCalled();
  });

  it('em local sem chave, mostra só o assunto e os links (nunca o destinatário)', async () => {
    const linhas: string[] = [];
    vi.spyOn(console, 'info').mockImplementation((l: string) => void linhas.push(l));
    const t = transporteDoAmbiente({ ...base, ambiente: 'local' });
    await t({ para: 'ana@exemplo.com', assunto: 'Assunto', texto: 'Abra: https://x/confirmar#t=abc\nfim', html: '' });
    expect(linhas.join('')).toContain('https://x/confirmar#t=abc');
    expect(linhas.join('')).not.toContain('ana@exemplo.com');
  });

  it('produção sem RESEND_API_KEY: a config falha fechada (ConfigInvalida), sem o valor das variáveis', () => {
    const env = {
      URL_PUBLICA: 'https://controleemcasa.exemplo',
      AMBIENTE: 'producao',
      MAIL_FROM: 'App <a@b.c>',
      CHAVE_HMAC: 'B'.repeat(43),
    };
    expect(() => lerConfig(env)).toThrow(/RESEND_API_KEY/);
    expect(() => lerConfig({ ...env, RESEND_API_KEY: 're_ok' })).not.toThrow();
  });

  it('config: CHAVE_HMAC ausente ou fora do formato, URL com barra final ou http em produção falham', () => {
    const ok = {
      URL_PUBLICA: 'https://a.exemplo',
      AMBIENTE: 'local',
      MAIL_FROM: 'App <a@b.c>',
      CHAVE_HMAC: 'C'.repeat(43),
    };
    expect(() => lerConfig(ok)).not.toThrow();
    expect(() => lerConfig({ ...ok, CHAVE_HMAC: undefined })).toThrow(/CHAVE_HMAC/);
    expect(() => lerConfig({ ...ok, CHAVE_HMAC: 'curta' })).toThrow(/CHAVE_HMAC/);
    expect(() => lerConfig({ ...ok, URL_PUBLICA: 'https://a.exemplo/' })).toThrow(/URL_PUBLICA/);
    expect(() =>
      lerConfig({ ...ok, AMBIENTE: 'producao', RESEND_API_KEY: 're_x', URL_PUBLICA: 'http://a.exemplo' }),
    ).toThrow(/URL_PUBLICA/);
    try {
      lerConfig({ ...ok, CHAVE_HMAC: 'valor-secreto' });
    } catch (e) {
      expect(String((e as Error).message)).not.toContain('valor-secreto');
    }
  });
});
