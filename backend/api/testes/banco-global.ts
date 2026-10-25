import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { USUARIO_A, USUARIO_B } from './constantes';

/**
 * Banco descartável para os testes da API (SDD 12.1): cria um banco novo, aplica as migrations como owner,
 * prepara a fixture de RLS usada no teste de vazamento de GUC (R2) e entrega as URLs aos testes.
 * Sem DATABASE_URL_OWNER/APP: pula com aviso; com EXIGIR_BANCO=1 (CI) falha.
 */
try {
  process.loadEnvFile(join(import.meta.dirname, '../../../.env'));
} catch {
  // sem .env: vale o ambiente do processo
}

const BIN_MIGRATE = join(import.meta.dirname, '../../scripts/node_modules/node-pg-migrate/bin/node-pg-migrate.js');
const PASTA_MIGRACOES = join(import.meta.dirname, '../../scripts/migracoes');

function trocarBanco(base: string, banco: string): string {
  const u = new URL(base);
  u.pathname = `/${banco}`;
  // `localhost` pode resolver para ::1 primeiro (Windows), enquanto o Docker escuta só em 127.0.0.1: cada conexão
  // do workerd esperava ~2 s pela tentativa em IPv6.
  if (u.hostname === 'localhost') u.hostname = '127.0.0.1';
  return u.toString();
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const base = process.env['DATABASE_URL_OWNER'];
  const baseApp = process.env['DATABASE_URL_APP'];
  if (!base || !baseApp) {
    const msg = 'Testes da API PULADOS: defina DATABASE_URL_OWNER e DATABASE_URL_APP (veja .env.example).';
    if (process.env['EXIGIR_BANCO'] === '1') throw new Error(msg);
    console.warn(msg);
    project.provide('urlBancoOwner', '');
    project.provide('urlBancoApp', 'postgres://x:x@127.0.0.1:1/x');
    project.provide('bancoDisponivel', false);
    return async () => {};
  }

  const nome = `controle_api_teste_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${nome}`);
  await admin.end();

  const urlOwner = trocarBanco(base, nome);
  const urlApp = trocarBanco(baseApp, nome);

  execFileSync(
    process.execPath,
    [BIN_MIGRATE, 'up', '-m', PASTA_MIGRACOES, '--database-url-var', 'DATABASE_URL_TESTE', '--no-single-transaction'],
    { env: { ...process.env, DATABASE_URL_TESTE: urlOwner }, stdio: 'pipe' },
  );

  // Fixture de RLS: enquanto não há tabela de negócio (etapa 6), uma tabela descartável com a mesma
  // política "dono" prova que GUC vazio ou de outro usuário não enxerga linha alguma (G-02 d).
  const owner = new pg.Client({ connectionString: urlOwner });
  await owner.connect();
  await owner.query(`
    create table app.fixture_rls (
      id uuid primary key default gen_random_uuid(),
      dono_id uuid not null references app.usuario (id),
      segredo text not null
    );
    alter table app.fixture_rls enable row level security;
    alter table app.fixture_rls force row level security;
    create policy dono on app.fixture_rls using (dono_id = app.usuario_atual()) with check (dono_id = app.usuario_atual());
    grant select, insert on app.fixture_rls to controle_app;
  `);
  for (const u of [USUARIO_A, USUARIO_B]) {
    await owner.query(`insert into app.usuario (id, email, nome, senha_hash) values ($1, $2, $3, 'sem-senha')`, [
      u.id,
      u.email,
      `Usuário ${u.email}`,
    ]);
    await owner.query(`insert into app.fixture_rls (dono_id, segredo) values ($1, $2)`, [
      u.id,
      `segredo de ${u.email}`,
    ]);
  }
  await owner.end();

  project.provide('urlBancoOwner', urlOwner);
  project.provide('urlBancoApp', urlApp);
  project.provide('bancoDisponivel', true);

  return async () => {
    const limpeza = new pg.Client({ connectionString: base });
    await limpeza.connect();
    await limpeza.query(`drop database if exists ${nome} with (force)`);
    await limpeza.end();
  };
}
