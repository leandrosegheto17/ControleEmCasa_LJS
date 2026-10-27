import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Lighthouse PWA ≥ 90 (PLANO etapa 16): mede o front construído (`dist/`) servido pelo Worker de verdade
 * (`wrangler dev`, com os cabeçalhos de `public/_headers` e o fallback de SPA), na configuração padrão (celular).
 *
 * A categoria PWA saiu do Lighthouse na versão 12.0.0 (changelog oficial, 2024-04-22, "PWA Category Removal").
 * Por isso a medição usa a 11.7.1, a última com a categoria, fixada sem `^` (o teste confere). As outras categorias
 * são medidas e mostradas, mas a meta do PLANO é só a de PWA. Sem banco: a API responde `indisponivel` e as páginas
 * medidas (landing e o início do app, que leva a Entrar) não dependem dela.
 *
 * Uso: `pnpm --filter @controle/web build && pnpm --filter @controle/web lighthouse`. Sai 1 se a PWA ficar abaixo de
 * 90 em algum caminho. O resumo vai para `test-results/lighthouse.json`.
 */

export const META_PWA = 90;
export const CAMINHOS_MEDIDOS = ['/', '/app/'];
const CATEGORIAS = ['pwa', 'performance', 'accessibility', 'best-practices', 'seo'];

/** Notas de 0 a 100 de um relatório (lhr); categoria sem nota vira null. */
export function notasDoRelatorio(lhr) {
  return Object.fromEntries(
    Object.entries(lhr.categories).map(([id, c]) => [
      id,
      typeof c.score === 'number' ? Math.round(c.score * 100) : null,
    ]),
  );
}

/** A meta: PWA ≥ 90 em todos os caminhos medidos. */
export function avaliarNotas(medicoes, minimo = META_PWA) {
  const falhas = [];
  if (medicoes.length === 0) falhas.push('nenhuma medição');
  for (const { caminho, notas } of medicoes) {
    const pwa = notas.pwa;
    if (typeof pwa !== 'number') falhas.push(`${caminho}: PWA sem nota`);
    else if (pwa < minimo) falhas.push(`${caminho}: PWA ${pwa} (meta ${minimo})`);
  }
  return { ok: falhas.length === 0, falhas };
}

const WEB = join(import.meta.dirname, '..');
const RAIZ = join(WEB, '../..');

function encerrar(processo) {
  if (processo.pid === undefined || processo.exitCode !== null) return;
  try {
    if (process.platform === 'win32')
      execFileSync('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-processo.pid, 'SIGTERM');
  } catch {
    // já saiu
  }
}

async function esperarSaude(url, processo, limiteMs = 120_000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (processo.exitCode !== null) throw new Error(`wrangler dev saiu com código ${processo.exitCode}`);
    try {
      if ((await fetch(`${url}/api/health`)).ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('wrangler dev não respondeu /api/health a tempo');
}

export async function main() {
  if (!existsSync(join(WEB, 'dist/index.html'))) {
    console.error('Construa o front antes: pnpm --filter @controle/web build');
    return 1;
  }
  const porta = Number(process.env.PORTA_LIGHTHOUSE ?? 8789);
  const url = `http://localhost:${porta}`;
  const wranglerJs = join(
    dirname(createRequire(join(RAIZ, 'backend/api/package.json')).resolve('wrangler/package.json')),
    'bin/wrangler.js',
  );
  const pasta = mkdtempSync(join(tmpdir(), 'controle-lighthouse-'));
  const wrangler = spawn(
    process.execPath,
    [
      wranglerJs,
      'dev',
      '-c',
      join(RAIZ, 'wrangler.jsonc'),
      '--ip',
      '127.0.0.1',
      '--port',
      String(porta),
      '--persist-to',
      join(pasta, 'estado'),
      '--show-interactive-dev-session=false',
      '--var',
      `URL_PUBLICA:${url}`,
      '--var',
      `CHAVE_HMAC:${randomBytes(32).toString('base64url')}`,
      '--var',
      'SENTRY_DSN:',
    ],
    {
      cwd: join(RAIZ, 'backend/api'),
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
        // Sem banco (e sem tocar em outro Postgres da máquina): a API responde `indisponivel`.
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: 'postgres://x:x@127.0.0.1:1/x',
        WRANGLER_SEND_METRICS: 'false',
        CI: 'true',
      },
      stdio: 'ignore',
    },
  );

  const { default: lighthouse } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');
  const { chromium } = await import('@playwright/test');
  let chrome;
  try {
    await esperarSaude(url, wrangler);
    chrome = await chromeLauncher.launch({
      chromePath: process.env.CHROME_PATH || chromium.executablePath(),
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    });
    const medicoes = [];
    for (const caminho of CAMINHOS_MEDIDOS) {
      const r = await lighthouse(`${url}${caminho}`, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: CATEGORIAS,
      });
      medicoes.push({ caminho, notas: notasDoRelatorio(r.lhr), lighthouse: r.lhr.lighthouseVersion });
    }
    for (const m of medicoes) {
      console.info(`${m.caminho.padEnd(8)} ${CATEGORIAS.map((c) => `${c} ${m.notas[c] ?? '-'}`).join(' | ')}`);
    }
    mkdirSync(join(WEB, 'test-results'), { recursive: true });
    writeFileSync(
      join(WEB, 'test-results/lighthouse.json'),
      JSON.stringify({ medidoEm: new Date().toISOString(), meta: { pwa: META_PWA }, medicoes }, null, 2),
    );
    const { ok, falhas } = avaliarNotas(medicoes);
    if (!ok) {
      for (const f of falhas) console.error(`Lighthouse abaixo da meta: ${f}`);
      return 1;
    }
    console.info(`Lighthouse PWA ≥ ${META_PWA} em ${medicoes.length} caminhos.`);
    return 0;
  } finally {
    await chrome?.kill();
    encerrar(wrangler);
    try {
      rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch {
      // pasta temporária
    }
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
