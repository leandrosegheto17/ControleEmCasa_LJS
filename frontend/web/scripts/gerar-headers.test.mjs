// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gerarHeaders } from './gerar-headers.mjs';

const original = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const cspDe = (texto) => texto.split('\n').find((l) => l.includes('Content-Security-Policy')) ?? '';

describe('gerarHeaders', () => {
  it('DSN válido põe https://<host> no connect-src e mais nada muda', () => {
    const { conteudo, aviso } = gerarHeaders(original, 'https://chave@o1.ingest.us.sentry.io/123');
    expect(aviso).toBeUndefined();
    expect(conteudo).toBe(original.replace("connect-src 'self'", "connect-src 'self' https://o1.ingest.us.sentry.io"));
  });

  it.each([undefined, '', '   '])('sem DSN (%j) o arquivo sai idêntico, sem aviso', (dsn) => {
    expect(gerarHeaders(original, dsn)).toEqual({ conteudo: original, aviso: undefined });
  });

  it('mantém HSTS, nosniff e as demais linhas', () => {
    const { conteudo } = gerarHeaders(original, 'https://k@o1.ingest.sentry.io/1');
    for (const l of [
      'Strict-Transport-Security',
      'X-Content-Type-Options: nosniff',
      'Referrer-Policy',
      'Permissions-Policy',
    ]) {
      expect(conteudo).toContain(l);
    }
  });

  it.each([
    ['ponto e vírgula no host', 'https://x@a.com;script-src/1'],
    ['curinga', 'https://x@a*.com/1'],
    ['aspas e ponto e vírgula', "https://x@a.com;'unsafe-inline'/1"],
    ['aspas simples', "https://x@a'.com/1"],
    ['espaço', 'https://x@a.com script-src/1'],
    ['quebra de linha', 'https://x@a.com\n  X-Evil: 1/1'],
    ['tab', 'https://x@a.com\t;x/1'],
    ['http', 'http://x@a.com/1'],
    ['porta com lixo', 'https://x@a.com:8a;x/1'],
    ['sem ponto no host', 'https://x@localhost/1'],
    ['não é URL', 'isso nao e url'],
    ['wss', 'wss://x@a.com/1'],
  ])('recusa %s: ignora o DSN com aviso e a CSP não muda', (_, dsn) => {
    const { conteudo, aviso } = gerarHeaders(original, dsn);
    expect(aviso).toMatch(/VITE_SENTRY_DSN ignorado/);
    expect(conteudo).toBe(original);
    expect(cspDe(conteudo)).toBe(cspDe(original));
  });
});

describe('codificação do public/_headers', () => {
  const bytes = readFileSync(new URL('../public/_headers', import.meta.url));

  it('é UTF-8 válido (decodificação fatal)', () => {
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes)).not.toThrow();
  });

  it.each([undefined, '', 'isso nao e url'])(
    'sem DSN válido (%j) o gerado é idêntico ao original byte a byte',
    (dsn) => {
      const { conteudo } = gerarHeaders(bytes.toString('utf8'), dsn);
      expect(Buffer.from(conteudo, 'utf8').equals(bytes)).toBe(true);
    },
  );
});

describe('integração com o build', () => {
  it('o script build do package.json roda o gerador depois do vite', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.scripts.build).toBe('vite build && node scripts/gerar-headers.mjs');
  });
});
