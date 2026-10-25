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
