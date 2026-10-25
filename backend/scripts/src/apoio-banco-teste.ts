import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';

/**
 * Apoio dos testes de banco (só testes): banco descartável migrado do zero e conexões por role.
 * Sem DATABASE_URL_OWNER/APP/BACKUP, os testes pulam com aviso; com EXIGIR_BANCO=1 (CI) falham.
 */
try {
  process.loadEnvFile(join(import.meta.dirname, '../../../.env'));
} catch {
  // sem .env: vale o ambiente do processo
}

export const URL_OWNER = process.env['DATABASE_URL_OWNER'];
export const URL_APP = process.env['DATABASE_URL_APP'];
export const URL_BACKUP = process.env['DATABASE_URL_BACKUP'];
export const temBanco = Boolean(URL_OWNER && URL_APP && URL_BACKUP);

export function avisarSemBanco(): void {
  if (temBanco) return;
  const msg =
    'Testes de banco PULADOS: defina DATABASE_URL_OWNER, DATABASE_URL_APP e DATABASE_URL_BACKUP (veja .env.example e suba o docker compose).';
  if (process.env['EXIGIR_BANCO'] === '1') throw new Error(msg);
  console.warn(msg);
}

const BIN_MIGRATE = join(import.meta.dirname, '../node_modules/node-pg-migrate/bin/node-pg-migrate.js');
const PASTA_MIGRACOES = join(import.meta.dirname, '../migracoes');

export function urlDoBanco(base: string, banco: string): string {
  const u = new URL(base);
  u.pathname = `/${banco}`;
  return u.toString();
}

export interface BancoDescartavel {
  owner: string;
  app: string;
  backup: string;
  apagar(): Promise<void>;
}

/** Cria um banco novo, aplica todas as migrations como owner e devolve as URLs por role. */
export async function criarBancoDescartavel(prefixo: string): Promise<BancoDescartavel> {
  const nome = `${prefixo}_${randomBytes(4).toString('hex')}`;
  await comCliente(URL_OWNER as string, (c) => c.query(`create database ${nome}`));
  const owner = urlDoBanco(URL_OWNER as string, nome);
  execFileSync(
    process.execPath,
    [BIN_MIGRATE, 'up', '-m', PASTA_MIGRACOES, '--database-url-var', 'DATABASE_URL_TESTE', '--no-single-transaction'],
    { env: { ...process.env, DATABASE_URL_TESTE: owner }, encoding: 'utf8' },
  );
  return {
    owner,
    app: urlDoBanco(URL_APP as string, nome),
    backup: urlDoBanco(URL_BACKUP as string, nome),
    apagar: async () => {
      await comCliente(URL_OWNER as string, (c) => c.query(`drop database if exists ${nome} with (force)`));
    },
  };
}

export async function comCliente<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Identidade gravada como GUC local (como a API faz; ADR-005). Campos ausentes ficam vazios. */
export interface Identidade {
  usuario?: string;
  email?: string;
  lar?: string;
  membro?: string;
  papel?: string;
}

export async function definirGuc(c: pg.Client, id: Identidade): Promise<void> {
  await c.query(
    `select set_config('app.usuario_id', $1, true), set_config('app.email', $2, true),
            set_config('app.lar_id', $3, true), set_config('app.membro_id', $4, true),
            set_config('app.papel', $5, true)`,
    [id.usuario ?? '', id.email ?? '', id.lar ?? '', id.membro ?? '', id.papel ?? ''],
  );
}

/** Roda `fn` numa transação com a identidade e confirma (COMMIT). */
export async function emTransacao<T>(c: pg.Client, id: Identidade, fn: () => Promise<T>): Promise<T> {
  await c.query('begin');
  try {
    await definirGuc(c, id);
    const r = await fn();
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  }
}

/** Roda o SQL numa transação descartada, com a identidade, e devolve o SQLSTATE do erro (ou null). */
export async function codigoDoErro(
  c: pg.Client,
  sql: string,
  id: Identidade = {},
  params: unknown[] = [],
): Promise<string | null> {
  await c.query('begin');
  try {
    await definirGuc(c, id);
    await c.query(sql, params);
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? 'sem-codigo';
  } finally {
    await c.query('rollback');
  }
}

/** Linhas afetadas pelo SQL numa transação descartada, com a identidade. */
export async function linhasAfetadas(
  c: pg.Client,
  sql: string,
  id: Identidade,
  params: unknown[] = [],
): Promise<number> {
  await c.query('begin');
  try {
    await definirGuc(c, id);
    return (await c.query(sql, params)).rowCount ?? 0;
  } finally {
    await c.query('rollback');
  }
}

/** Primeira linha do SELECT feito com a identidade (transação descartada). */
export async function consultar<T extends pg.QueryResultRow>(
  c: pg.Client,
  sql: string,
  id: Identidade,
  params: unknown[] = [],
): Promise<T[]> {
  await c.query('begin');
  try {
    await definirGuc(c, id);
    return (await c.query<T>(sql, params)).rows;
  } finally {
    await c.query('rollback');
  }
}
