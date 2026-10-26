import { z } from 'zod';

/**
 * Configuração do Worker validada com Zod (SDD 11.2): falha fechada se faltar variável, sem logar o valor.
 * É lida pelas rotas que precisam de segredo (acesso); o `GET /api/health` não depende dela.
 */
export class ConfigInvalida extends Error {
  constructor(readonly variaveis: string[]) {
    // Só os NOMES das variáveis; nunca o valor.
    super(`Configuração inválida: ${variaveis.join(', ')}`);
    this.name = 'ConfigInvalida';
  }
}

const CHAVE_32_BYTES_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const PONTO_P256_BASE64URL = /^[A-Za-z0-9_-]{87}$/;

const Esquema = z
  .object({
    URL_PUBLICA: z.url().refine((u) => !u.endsWith('/')),
    AMBIENTE: z.enum(['local', 'teste', 'producao']),
    MAIL_FROM: z.string().min(3).max(200),
    CHAVE_HMAC: z.string().regex(CHAVE_32_BYTES_BASE64URL),
    RESEND_API_KEY: z
      .string()
      .optional()
      .transform((v) => (v === '' ? undefined : v)),
  })
  .superRefine((c, ctx) => {
    if (c.AMBIENTE === 'producao' && !c.URL_PUBLICA.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['URL_PUBLICA'], message: 'https' });
    }
    // Em produção o e-mail é obrigatório; em local, o transporte de console basta (SDD 11.2).
    if (c.AMBIENTE === 'producao' && !c.RESEND_API_KEY?.startsWith('re_')) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'obrigatoria' });
    }
  });

export interface Config {
  urlPublica: string;
  ambiente: 'local' | 'teste' | 'producao';
  remetente: string;
  chaveHmac: string;
  resendApiKey: string | undefined;
}

export function lerConfig(env: Record<string, unknown>): Config {
  const r = Esquema.safeParse({
    URL_PUBLICA: env['URL_PUBLICA'],
    AMBIENTE: env['AMBIENTE'],
    MAIL_FROM: env['MAIL_FROM'],
    CHAVE_HMAC: env['CHAVE_HMAC'],
    RESEND_API_KEY: env['RESEND_API_KEY'],
  });
  if (!r.success) {
    throw new ConfigInvalida([...new Set(r.error.issues.map((i) => String(i.path[0] ?? '?')))]);
  }
  return {
    urlPublica: r.data.URL_PUBLICA,
    ambiente: r.data.AMBIENTE,
    remetente: r.data.MAIL_FROM,
    chaveHmac: r.data.CHAVE_HMAC,
    resendApiKey: r.data.RESEND_API_KEY,
  };
}

const EsquemaAsaas = z
  .object({
    AMBIENTE: z.enum(['local', 'teste', 'producao']),
    ASAAS_API_URL: z.url().refine((u) => !u.endsWith('/')),
    ASAAS_API_KEY: z.string().min(1).max(500),
    ASAAS_WEBHOOK_TOKEN: z.string().min(32).max(255),
  })
  .superRefine((c, ctx) => {
    if (c.AMBIENTE === 'producao' && !c.ASAAS_API_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['ASAAS_API_URL'], message: 'https' });
    }
  });

export interface ConfigAsaas {
  apiUrl: string;
  apiKey: string;
  webhookToken: string;
}

/**
 * Configuração do Asaas (SDD 11.2; etapa 13), lida só pelas rotas de plano e pelo webhook: falha fechada sem os
 * segredos (o webhook nunca aceita token com o segredo ausente). Só os NOMES das variáveis vão para o erro.
 */
export function lerConfigAsaas(env: Record<string, unknown>): ConfigAsaas {
  const r = EsquemaAsaas.safeParse({
    AMBIENTE: env['AMBIENTE'],
    ASAAS_API_URL: env['ASAAS_API_URL'],
    ASAAS_API_KEY: env['ASAAS_API_KEY'],
    ASAAS_WEBHOOK_TOKEN: env['ASAAS_WEBHOOK_TOKEN'],
  });
  if (!r.success) {
    throw new ConfigInvalida([...new Set(r.error.issues.map((i) => String(i.path[0] ?? '?')))]);
  }
  return { apiUrl: r.data.ASAAS_API_URL, apiKey: r.data.ASAAS_API_KEY, webhookToken: r.data.ASAAS_WEBHOOK_TOKEN };
}

export interface ConfigPush {
  chavePublica: string;
  chavePrivada: string;
  assunto: string;
}

const EsquemaPush = z.object({
  VAPID_PUBLIC_KEY: z.string().regex(PONTO_P256_BASE64URL),
  VAPID_PRIVATE_KEY: z.string().regex(CHAVE_32_BYTES_BASE64URL),
  VAPID_SUBJECT: z.string().regex(/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/),
});

/**
 * Configuração VAPID (SDD 11.2; etapa 15). Sem as três variáveis, ou malformadas, devolve nulo: a rota da chave responde
 * `indisponivel` e o cron não envia nada (registra só o NOME do problema, nunca o valor).
 */
export function lerConfigPush(env: Record<string, unknown>): ConfigPush | null {
  const r = EsquemaPush.safeParse({
    VAPID_PUBLIC_KEY: env['VAPID_PUBLIC_KEY'],
    VAPID_PRIVATE_KEY: env['VAPID_PRIVATE_KEY'],
    VAPID_SUBJECT: env['VAPID_SUBJECT'],
  });
  if (!r.success) return null;
  return {
    chavePublica: r.data.VAPID_PUBLIC_KEY,
    chavePrivada: r.data.VAPID_PRIVATE_KEY,
    assunto: r.data.VAPID_SUBJECT,
  };
}
