import * as Sentry from '@sentry/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  aoErroCapturado,
  desligarSentryParaTeste,
  iniciarSentry,
  lerConfigSentry,
  opcoesSentryWeb,
  relatarErroWeb,
} from './observabilidade';

/**
 * Sentry no front (PLANO etapa 16; G-45; TM-OBS-01): inerte sem DSN (o SDK nem carrega), release = SHA do build, e o
 * envelope que o SDK real monta (capturado por um transporte falso, sem rede) não leva e-mail, senha, token do link,
 * cookie, CPF/CNPJ nem valores ou descrições financeiras, nem no evento nem nas migalhas (breadcrumbs).
 */

const DSN = 'https://chavepublica@o1.ingest.sentry.io/1';
const SHA = '0123456789abcdef0123456789abcdef01234567';
const EMAIL = 'ana.souza@exemplo.com';
const SENHA = 'senha-bem-longa-1';
const TOKEN = 'Zm9vYmFyLXRva2VuLWRlLXNlc3Nhby1jb20tMzItYnl0ZXM';
const CPF = '529.982.247-25';
const DESCRICAO = 'Mercado do mês com a sogra';

afterEach(() => {
  desligarSentryParaTeste();
  vi.restoreAllMocks();
});

describe('lerConfigSentry', () => {
  it('sem DSN (ausente, vazio ou só espaço) fica desligado', () => {
    expect(lerConfigSentry({})).toBeNull();
    expect(lerConfigSentry({ VITE_SENTRY_DSN: '' })).toBeNull();
    expect(lerConfigSentry({ VITE_SENTRY_DSN: ' ' })).toBeNull();
  });

  it('com DSN: release = SHA do build e ambiente pelo modo', () => {
    expect(lerConfigSentry({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_RELEASE: SHA, PROD: true })).toEqual({
      dsn: DSN,
      release: SHA,
      environment: 'producao',
    });
    expect(lerConfigSentry({ VITE_SENTRY_DSN: DSN })).toMatchObject({ release: undefined, environment: 'local' });
  });
});

describe('iniciarSentry', () => {
  it('sem DSN não carrega o SDK e relatar não faz nada', async () => {
    const carregar = vi.fn();
    expect(await iniciarSentry({}, carregar)).toBe(false);
    expect(carregar).not.toHaveBeenCalled();
    expect(() => relatarErroWeb(new Error('x'))).not.toThrow();
  });

  it('opções: sem tracing, coleta desligada, transações descartadas', () => {
    const o = opcoesSentryWeb({ dsn: DSN, release: SHA, environment: 'producao' });
    expect(o.tracesSampleRate).toBeUndefined();
    expect(o.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] });
    expect(o.beforeSendTransaction!({ type: 'transaction' } as never, {})).toBeNull();
  });

  it('com DSN: o evento real do SDK sai com release = SHA e sem dado proibido, nem nas migalhas', async () => {
    const enviados: string[] = [];
    const transport = (opcoes: Parameters<typeof Sentry.makeFetchTransport>[0]) =>
      Sentry.createTransport(opcoes, async (pedido) => {
        enviados.push(typeof pedido.body === 'string' ? pedido.body : new TextDecoder().decode(pedido.body));
        return { statusCode: 200 };
      });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    document.cookie = `controle_teste=${TOKEN}`;
    window.history.pushState({}, '', `/confirmar?email=${EMAIL}#t=${TOKEN}`);

    expect(
      await iniciarSentry({ VITE_SENTRY_DSN: DSN, VITE_SENTRY_RELEASE: SHA }, () => import('@sentry/react'), {
        transport,
      }),
    ).toBe(true);

    console.log(`lançou R$ 1.234,56 ${DESCRICAO} para ${EMAIL}`);
    window.history.pushState({}, '', `/app/lancamentos?busca=${DESCRICAO}`);
    aoErroCapturado(
      new Error(`falhou ${EMAIL} ${CPF} {"senha":"${SENHA}","valor_centavos":4590,"descricao":"${DESCRICAO}"}`),
    );
    await Sentry.flush(2000);

    const tudo = enviados.join('\n');
    expect(tudo).toContain('"type":"event"');
    expect(tudo).toContain(`"release":"${SHA}"`);
    expect(tudo).toContain('"category":"navigation"');
    for (const proibido of [EMAIL, SENHA, TOKEN, CPF, '52998224725', DESCRICAO, '1.234,56', '4590']) {
      expect(tudo, proibido).not.toContain(proibido);
    }
    expect(tudo).not.toContain('"category":"console"');
    expect(tudo).not.toMatch(/"(cookies|query_string|user|headers)":/);
    // A requisição fica só com a URL da página, sem query nem fragmento (o token do link vem no fragmento).
    expect(tudo).toContain('"request":{"url":"http://localhost:3000/app/lancamentos"}');
    await Sentry.close();
  });
});
