import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';

/** CSP da API (G-35): respostas JSON não carregam nada. A CSP do app (assets) fica em frontend/web/public/_headers. */
const CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * Cabeçalhos de toda resposta de /api/* (SDD 5.1 passo 1; G-35, G-47; THREAT-MODEL TM-API-12).
 * Roda por fora de tudo: pega também 404, 403, 413 e 500 gerados pelo onError.
 */
export const cabecalhosDeSeguranca = createMiddleware<AppEnv>(async (c, next) => {
  const id = crypto.randomUUID();
  c.set('idRequisicao', id);
  await next();
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', CSP_API);
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  c.header('X-Request-Id', id);
});
