import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { DADOS_COLETADOS_SENTRY } from '@controle/contrato';
import * as Sentry from '@sentry/cloudflare';
import { describe, expect, it } from 'vitest';
import { criarApp } from './app';
import { executarAgendada } from './entrada/agendadas';
import type { Bindings } from './env';
import { comSentry, opcoesSentry } from './observabilidade';
import { ESCRITA } from './testes-suporte';

/**
 * Sentry no Worker (PLANO etapa 16; SDD 11.2; G-45; TM-OBS-01, TM-ASA-05): inerte sem DSN, release = SHA do commit,
 * e o evento que sai do SDK (capturado por um transporte falso, sem rede) não leva e-mail, senha, token, cookie
 * `__Host-sid`, cabeçalhos `Authorization`/`asaas-access-token`, CPF/CNPJ, corpo nem valores ou descrições financeiras.
 */

const DSN = 'https://chavepublica@o1.ingest.sentry.io/1';
const SHA = '0123456789abcdef0123456789abcdef01234567';
const EMAIL = 'ana.souza@exemplo.com';
const SENHA = 'senha-bem-longa-1';
const TOKEN = 'Zm9vYmFyLXRva2VuLWRlLXNlc3Nhby1jb20tMzItYnl0ZXM';
const CPF = '529.982.247-25';
const DESCRICAO = 'Mercado do mês com a sogra';
const ASAAS = 'token-do-webhook-do-asaas-com-mais-de-32-caracteres';

const base = env as unknown as Bindings;

/**
 * Transporte falso ÚNICO para o arquivo: o SDK guarda o cliente no isolate (como em produção) e o primeiro `init` decide
 * o transporte; cada teste esvazia a lista antes de começar.
 */
const enviadosDoArquivo: string[] = [];
const transporteDoArquivo = (opcoes: Parameters<typeof Sentry.createTransport>[0]) =>
  Sentry.createTransport(opcoes, async (pedido) => {
    enviadosDoArquivo.push(typeof pedido.body === 'string' ? pedido.body : new TextDecoder().decode(pedido.body));
    return { statusCode: 200 };
  });

function transporteFalso() {
  enviadosDoArquivo.length = 0;
  return { enviados: enviadosDoArquivo, transport: transporteDoArquivo };
}

/** O app real com uma rota que falha levando dado proibido na mensagem do erro. */
function workerQueFalha(extra: Parameters<typeof comSentry>[1]) {
  const app = criarApp({
    resolverSessao: async () => null,
    rotas: (a) =>
      a.post('/api/teste/falha', async (c) => {
        await c.req.json();
        throw new Error(`falhou para ${EMAIL} cpf ${CPF} {"valor_centavos":4590,"descricao":"${DESCRICAO}"}`);
      }),
  });
  return comSentry({ fetch: app.fetch }, extra);
}

const pedidoSujo = () =>
  new Request(`https://teste.exemplo.local/api/teste/falha?email=${EMAIL}&token=${TOKEN}`, {
    method: 'POST',
    headers: {
      ...ESCRITA,
      'Content-Type': 'application/json',
      Cookie: `__Host-sid=${TOKEN}`,
      Authorization: `Bearer ${TOKEN}`,
      'asaas-access-token': ASAAS,
    },
    body: JSON.stringify({ email: EMAIL, senha: SENHA, cpf_cnpj: CPF, valor_centavos: 4590, descricao: DESCRICAO }),
  });

describe('opcoesSentry', () => {
  it('sem DSN (ausente, vazio ou só espaço) não há opções: o Sentry fica desligado', () => {
    expect(opcoesSentry({ ...base, SENTRY_DSN: undefined })).toBeUndefined();
    expect(opcoesSentry({ ...base, SENTRY_DSN: '' })).toBeUndefined();
    expect(opcoesSentry({ ...base, SENTRY_DSN: '  ' })).toBeUndefined();
  });

  it('com DSN: release = SHA injetado no deploy, ambiente do Worker, coleta desligada e sem transações', () => {
    const o = opcoesSentry({ ...base, SENTRY_DSN: DSN, SENTRY_RELEASE: SHA })!;
    expect(o.dsn).toBe(DSN);
    expect(o.release).toBe(SHA);
    expect(o.environment).toBe('teste');
    expect(o.dataCollection).toMatchObject({ ...DADOS_COLETADOS_SENTRY, httpBodies: [] });
    expect(o.tracesSampleRate).toBeUndefined();
    expect(o.beforeSendTransaction!({ type: 'transaction' } as never, {})).toBeNull();
  });

  it('o wrangler.jsonc não traz DSN (só segredo)', async () => {
    const { default: wrangler } = await import('../../../wrangler.jsonc?raw');
    expect(wrangler).not.toMatch(/SENTRY_DSN"\s*:/);
    expect(wrangler).not.toMatch(/ingest\.sentry\.io/);
  });
});

describe('Worker com Sentry', () => {
  it('sem DSN: responde normalmente e nada é enviado', async () => {
    const { enviados, ...falso } = transporteFalso();
    const worker = workerQueFalha(falso);
    const ctx = createExecutionContext();
    const resposta = await worker.fetch!(pedidoSujo() as never, { ...base, SENTRY_DSN: '' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(resposta.status).toBe(500);
    expect(enviados).toEqual([]);
  });

  it('com DSN: o erro interno vira evento com release = SHA e sem nenhum dado proibido', async () => {
    const { enviados, ...falso } = transporteFalso();
    const worker = workerQueFalha(falso);
    const ctx = createExecutionContext();
    const resposta = await worker.fetch!(pedidoSujo() as never, { ...base, SENTRY_DSN: DSN, SENTRY_RELEASE: SHA }, ctx);
    await waitOnExecutionContext(ctx);
    await Sentry.flush(2000);

    expect(resposta.status).toBe(500);
    const corpo = (await resposta.json()) as { code: string; id: string };
    expect(corpo.code).toBe('erro_interno');
    const tudo = enviados.join('\n');
    expect(tudo).toContain('"type":"event"');
    expect(tudo).toContain(`"release":"${SHA}"`);
    expect(tudo).toContain(corpo.id);
    expect(tudo).toContain('/api/teste/falha');
    for (const proibido of [EMAIL, SENHA, TOKEN, CPF, '52998224725', DESCRICAO, '4590', ASAAS, '__Host-sid=Zm']) {
      expect(tudo, proibido).not.toContain(proibido);
    }
    expect(tudo).not.toMatch(/"(cookies|data|query_string|user)":/);
  });

  it('cron que falha é relatado ao Sentry (com DSN) e continua sem derrubar o Worker', async () => {
    const { enviados, ...falso } = transporteFalso();
    const ambiente: Bindings = {
      ...base,
      SENTRY_DSN: DSN,
      SENTRY_RELEASE: SHA,
      HYPERDRIVE: { connectionString: 'postgres://x:x@127.0.0.1:1/x' } as Hyperdrive,
    };
    const worker = comSentry({ scheduled: (c, e, ctx) => ctx.waitUntil(executarAgendada(c.cron, e)) }, falso);
    const ctx = createExecutionContext();
    await worker.scheduled!({ cron: '0 * * * *', scheduledTime: 0, noRetry: () => {} }, ambiente, ctx);
    await waitOnExecutionContext(ctx);
    await Sentry.flush(2000);
    expect(enviados.join('\n')).toContain('"type":"event"');
    expect(enviados.join('\n')).toContain(`"release":"${SHA}"`);
  });
});
