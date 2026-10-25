import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cabeçalhos dos arquivos estáticos (GUARDRAILS G-35; PLANO etapa 3): o Cloudflare Assets os lê de `public/_headers`.
 * A CSP da API (respostas JSON) é testada no pacote da API.
 */
const cabecalhos = readFileSync(join(import.meta.dirname, '../public/_headers'), 'utf8');
const csp = cabecalhos.split('\n').find((linha) => linha.includes('Content-Security-Policy')) ?? '';

describe('public/_headers', () => {
  it.each([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ])('a CSP traz a diretiva %s', (diretiva) => {
    expect(csp).toContain(diretiva);
  });

  it('a CSP não libera unsafe-inline nem unsafe-eval em script', () => {
    expect(csp).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/);
  });

  it('traz HSTS, nosniff, Referrer-Policy e Permissions-Policy', () => {
    expect(cabecalhos).toMatch(/Strict-Transport-Security: max-age=\d{7,}/);
    expect(cabecalhos).toMatch(/X-Content-Type-Options: nosniff/);
    expect(cabecalhos).toMatch(/Referrer-Policy: no-referrer/);
    expect(cabecalhos).toMatch(/Permissions-Policy: .*camera=\(\)/);
  });
});
