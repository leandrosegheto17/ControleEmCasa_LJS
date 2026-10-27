// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./gerar-headers.mjs', import.meta.url));
const origemPath = fileURLToPath(new URL('../public/_headers', import.meta.url));
const original = readFileSync(origemPath);

/** Roda a linha de comando em pasta temporária; só as variáveis dadas chegam ao processo filho. */
function rodar(extraEnv) {
  const pasta = mkdtempSync(join(tmpdir(), 'gerar-headers-'));
  try {
    const destino = join(pasta, 'saida_headers');
    const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...extraEnv };
    env.HEADERS_ORIGEM = origemPath;
    env.HEADERS_DESTINO = destino;
    const r = spawnSync(process.execPath, [script], { env, encoding: 'utf8' });
    return { status: r.status, stderr: r.stderr, saida: readFileSync(destino) };
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

describe('linha de comando do gerador de _headers', () => {
  it('DSN válido: grava https://<host> no connect-src, sem aviso', () => {
    const r = rodar({ VITE_SENTRY_DSN: 'https://chave@o1.ingest.us.sentry.io/123' });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.saida.toString('utf8')).toBe(
      original.toString('utf8').replace("connect-src 'self'", "connect-src 'self' https://o1.ingest.us.sentry.io"),
    );
  });

  it('DSN com ponto e vírgula: grava o original byte a byte e avisa no stderr', () => {
    const r = rodar({ VITE_SENTRY_DSN: 'https://x@a.com;script-src/1' });
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('[gerar-headers] VITE_SENTRY_DSN ignorado');
    expect(r.saida.equals(original)).toBe(true);
  });

  it('sem DSN: grava o original byte a byte, sem aviso', () => {
    const r = rodar({});
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.saida.equals(original)).toBe(true);
  });

  it('lê VITE_SENTRY_DSN e não SENTRY_DSN', () => {
    const r = rodar({ SENTRY_DSN: 'https://chave@o1.ingest.us.sentry.io/123' });
    expect(r.saida.equals(original)).toBe(true);
    expect(r.stderr).toBe('');
  });
});
