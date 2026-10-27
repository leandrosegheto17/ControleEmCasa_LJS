import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';

/** CSP da API (G-35): respostas JSON não carregam nada. A CSP do app (assets) fica em frontend/web/public/_headers. */
const CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * Host de ingestão do Sentry, tirado do `SENTRY_DSN` (exceção registrada no Log do GUARDRAILS, 2026-10-27): só o host
 * exato, só https. Sem DSN ou com DSN malformado devolve `undefined` e a CSP não muda (nunca derruba a resposta).
 */
function hostDoSentry(dsn: string | undefined): string | undefined {
  if (!dsn?.trim()) return undefined;
  try {
    const url = new URL(dsn.trim());
    if (url.protocol !== 'https:' || !/^[a-z0-9.-]+(:\d+)?$/i.test(url.host)) return undefined;
    return url.host;
  } catch {
    return undefined;
  }
}

/**
 * Cabeçalhos de toda resposta de /api/* (SDD 5.1 passo 1; G-35, G-47; THREAT-MODEL TM-API-12).
 * Roda por fora de tudo: pega também 404, 403, 413 e 500 gerados pelo onError.
 */
export const cabecalhosDeSeguranca = createMiddleware<AppEnv>(async (c, next) => {
  const id = crypto.randomUUID();
  c.set('idRequisicao', id);
  await next();
  const host = hostDoSentry(c.env?.SENTRY_DSN);
  const csp = host
    ? CSP_API.replace("default-src 'none';", `default-src 'none'; connect-src https://${host};`)
    : CSP_API;
  c.header('Cache-Control', 'no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', csp);
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  c.header('X-Request-Id', id);
});
