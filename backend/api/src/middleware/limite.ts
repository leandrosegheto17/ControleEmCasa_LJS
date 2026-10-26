import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { ErroApi } from '../erros';
import { logar } from '../log';

/**
 * IP do cliente: só `CF-Connecting-IP`, que a Cloudflare define e o cliente não forja (G-20).
 * `X-Forwarded-For` e afins são ignorados. Fora da Cloudflare (local), não há IP.
 */
export function ipDoCliente(c: Context<AppEnv>): string | null {
  const ip = c.req.header('CF-Connecting-IP')?.trim();
  return ip ? ip : null;
}

/**
 * Limite de taxa por IP com os bindings `LIMITE_*` (SDD 5.1 passo 3; G-20): 429 `muitas_requisicoes`.
 * Fica por cima do bloqueio por tentativas (RN-21), que é a fonte de verdade do login.
 */
export function limitarPor(nome: 'LIMITE_ENTRAR' | 'LIMITE_PUBLICO' | 'LIMITE_WEBHOOK') {
  return createMiddleware<AppEnv>(async (c, next) => {
    const limite = c.env[nome];
    if (!limite) {
      if (c.env.URL_PUBLICA.startsWith('https://')) logar('warn', 'limite_ausente', { limite: nome });
      return next();
    }
    const { success } = await limite.limit({ key: ipDoCliente(c) ?? 'sem-ip' });
    if (!success) throw new ErroApi(429, 'muitas_requisicoes', 'Muitas requisições. Aguarde um pouco.');
    return next();
  });
}
