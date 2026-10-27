import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { iniciarAsaasFalso } from './apoio/asaasFalso';
import { PORTA_PILHA, URL_PILHA } from './apoio/pilha';

/**
 * Pilha real dos e2e críticos (PLANO etapa 16; SDD 12.1): Postgres 17 (banco descartável, migrations do zero), o Worker
 * de verdade no `wrangler dev` servindo o front construído (`dist/`) e a API, e o Asaas simulado por um servidor local.
 * O e-mail usa o transporte de console de `AMBIENTE=local`: o link de confirmação sai no log do wrangler, que vai para
 * um arquivo lido pelos testes. Nenhum segredo real: chave HMAC, chave e token do Asaas são aleatórios a cada execução.
 */

const RAIZ = join(import.meta.dirname, '../../..');
const BIN_MIGRATE = join(RAIZ, 'backend/scripts/node_modules/node-pg-migrate/bin/node-pg-migrate.js');
const PASTA_MIGRACOES = join(RAIZ, 'backend/scripts/migracoes');
const WRANGLER = join(
  dirname(createRequire(join(RAIZ, 'backend/api/package.json')).resolve('wrangler/package.json')),
  'bin/wrangler.js',
);

function trocarBanco(base: string, banco: string): string {
  const u = new URL(base);
  u.pathname = `/${banco}`;
  if (u.hostname === 'localhost') u.hostname = '127.0.0.1';
  return u.toString();
}

function encerrar(processo: ChildProcess): void {
  if (processo.pid === undefined || processo.exitCode !== null) return;
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    process.kill(-processo.pid, 'SIGTERM');
  }
}

async function esperarSaude(processo: ChildProcess, limiteMs = 120_000): Promise<void> {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (processo.exitCode !== null) throw new Error(`wrangler dev saiu com código ${processo.exitCode}`);
    try {
      const r = await fetch(`${URL_PILHA}/api/health`);
      if (r.ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('wrangler dev não respondeu /api/health a tempo');
}

export default async function setup(): Promise<() => Promise<void>> {
  try {
    process.loadEnvFile(join(RAIZ, '.env'));
  } catch {
    // sem .env: vale o ambiente do processo (CI)
  }
  const base = process.env['DATABASE_URL_OWNER'];
  const baseApp = process.env['DATABASE_URL_APP'];
  if (!base || !baseApp) throw new Error('e2e da pilha: defina DATABASE_URL_OWNER e DATABASE_URL_APP (.env.example).');
  if (!existsSync(join(RAIZ, 'frontend/web/dist/index.html'))) {
    throw new Error('e2e da pilha: construa o front antes (pnpm --filter @controle/web build).');
  }

  const nome = `controle_e2e_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: trocarBanco(base, 'postgres') });
  await admin.connect();
  await admin.query(`create database ${nome}`);
  await admin.end();
  const urlOwner = trocarBanco(base, nome);
  execFileSync(
    process.execPath,
    [BIN_MIGRATE, 'up', '-m', PASTA_MIGRACOES, '--database-url-var', 'DATABASE_URL_E2E', '--no-single-transaction'],
    { env: { ...process.env, DATABASE_URL_E2E: urlOwner }, stdio: 'pipe' },
  );

  const asaas = await iniciarAsaasFalso();
  const pasta = mkdtempSync(join(tmpdir(), 'controle-e2e-pilha-'));
  const log = join(pasta, 'wrangler.log');
  const tokenWebhook = randomBytes(32).toString('base64url');
  const vars = {
    URL_PUBLICA: URL_PILHA,
    AMBIENTE: 'local',
    CHAVE_HMAC: randomBytes(32).toString('base64url'),
    RESEND_API_KEY: '',
    ASAAS_API_URL: `${asaas.url}/v3`,
    ASAAS_API_KEY: `e2e_${randomBytes(16).toString('hex')}`,
    ASAAS_WEBHOOK_TOKEN: tokenWebhook,
    SENTRY_DSN: '',
  };
  const urlApp = trocarBanco(baseApp, nome);
  const wrangler = spawn(
    process.execPath,
    [
      WRANGLER,
      'dev',
      '-c',
      join(RAIZ, 'wrangler.jsonc'),
      '--ip',
      '127.0.0.1',
      '--port',
      String(PORTA_PILHA),
      '--persist-to',
      join(pasta, 'estado'),
      '--show-interactive-dev-session=false',
      ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`]),
    ],
    {
      cwd: join(RAIZ, 'backend/api'),
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: urlApp,
        WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: urlApp,
        WRANGLER_SEND_METRICS: 'false',
        CI: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const arquivo = createWriteStream(log);
  wrangler.stdout!.pipe(arquivo);
  wrangler.stderr!.pipe(arquivo);

  process.env['E2E_PILHA_LOG'] = log;
  process.env['E2E_PILHA_ASAAS'] = asaas.url;
  process.env['E2E_PILHA_TOKEN_WEBHOOK'] = tokenWebhook;
  process.env['E2E_PILHA_BANCO'] = urlOwner;

  try {
    await esperarSaude(wrangler);
  } catch (erro) {
    encerrar(wrangler);
    asaas.servidor.close();
    throw erro;
  }

  return async () => {
    encerrar(wrangler);
    asaas.servidor.close();
    arquivo.close();
    const fim = new pg.Client({ connectionString: trocarBanco(base, 'postgres') });
    await fim.connect();
    await fim.query(`drop database if exists ${nome} with (force)`);
    await fim.end();
    try {
      // O workerd pode segurar arquivos por alguns instantes depois de encerrado (Windows).
      rmSync(pasta, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch {
      // pasta temporária do sistema: sobra só o log, sem segredo real
    }
  };
}
