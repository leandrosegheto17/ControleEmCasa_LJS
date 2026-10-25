import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { ErroApi } from '../erros';

export const CABECALHO_CSRF = 'X-Controle-Em-Casa';
const METODOS_SEM_EFEITO = new Set(['GET', 'HEAD']);
/** O webhook se autentica por token (G-28) e é a única exceção ao CSRF. */
const PREFIXO_WEBHOOK = '/api/webhooks/';

/**
 * CSRF por cabeçalho (G-21; THREAT-MODEL TM-NAV-03): toda escrita exige `X-Controle-Em-Casa: 1`
 * (que força preflight, e a API não responde CORS) e `Origin` igual a `URL_PUBLICA`. Vale até para o login.
 */
export const protecaoCsrf = createMiddleware<AppEnv>(async (c, next) => {
  if (METODOS_SEM_EFEITO.has(c.req.method) || c.req.path.startsWith(PREFIXO_WEBHOOK)) {
    return next();
  }
  const cabecalhoOk = c.req.header(CABECALHO_CSRF) === '1';
  const origemOk = c.req.header('Origin') === c.env.URL_PUBLICA;
  if (!cabecalhoOk || !origemOk) {
    throw new ErroApi(403, 'origem_invalida', 'Requisição recusada.');
  }
  return next();
});
