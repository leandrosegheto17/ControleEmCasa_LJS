import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';
import { avaliar, conferirBanco, resumo, type DadosDoBanco } from './conferir-banco';

/**
 * Migra o banco do Neon confirmando o destino (G-43; TM-DB-05; roteiro `.specs/etapa-17/neon.md`, passos 5 e 6).
 * O `.env` da raiz aponta para o Postgres local do Docker; por isso este comando NÃO carrega `.env`: a
 * `NEON_URL_OWNER` tem de vir do ambiente do terminal. Recusa destino local, fora de `.neon.tech`, host `-pooler`
 * e URL sem TLS; mostra usuário, host e banco (senha nunca) e só migra com o nome do banco digitado (ou `--sim`).
 * Nunca imprime a URL nem o texto bruto de erro do driver.
 */

export type Destino = { ok: true; usuario: string; host: string; banco: string } | { ok: false; motivo: string };

export function avaliarDestino(url: string): Destino {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, motivo: 'NEON_URL_OWNER não é uma URL válida.' };
  }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') {
    return { ok: false, motivo: 'NEON_URL_OWNER não é uma URL postgres.' };
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (['localhost', '127.0.0.1', '::1'].includes(host) || u.port === '55432') {
    return {
      ok: false,
      motivo: 'Destino local recusado: este comando é só para o Neon (para o local use pnpm migrar).',
    };
  }
  if (!host.endsWith('.neon.tech')) {
    return { ok: false, motivo: 'Host fora de .neon.tech recusado.' };
  }
  if (host.includes('-pooler')) {
    return { ok: false, motivo: 'Host com -pooler recusado: migrar exige a string direta (sem pooler).' };
  }
  const ssl = u.searchParams.get('sslmode');
  if (ssl !== 'require' && ssl !== 'verify-full') {
    return { ok: false, motivo: 'URL sem sslmode=require (ou verify-full) recusada.' };
  }
  const banco = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!banco) return { ok: false, motivo: 'URL sem nome de banco.' };
  return { ok: true, usuario: decodeURIComponent(u.username), host, banco };
}

/** Descrição do destino; a senha não entra nunca. */
export function descrever(d: { usuario: string; host: string; banco: string }): string {
  return `Usuário: ${d.usuario}\nHost: ${d.host}\nBanco: ${d.banco}\nSenha: ********`;
}

export interface Dependencias {
  ambiente: NodeJS.ProcessEnv;
  argv: string[];
  /** Pergunta ao usuário e devolve a resposta digitada. */
  perguntar: (pergunta: string) => Promise<string>;
  /** Roda a migração; devolve o código de saída. */
  migrar: (ambiente: NodeJS.ProcessEnv) => Promise<number>;
  /** Lê o banco após migrar (mesma checagem do conferir-banco). */
  conferir: (url: string) => Promise<DadosDoBanco>;
  saida: (texto: string) => void;
  erro: (texto: string) => void;
}

export async function migrarNeon(dep: Dependencias): Promise<number> {
  const url = dep.ambiente['NEON_URL_OWNER'];
  if (!url) {
    dep.erro(
      'NEON_URL_OWNER ausente no ambiente do terminal. Este comando não lê o .env (ele aponta para o banco local). ' +
        'Defina a variável com a URL direta do owner do Neon e rode de novo.',
    );
    return 1;
  }
  const destino = avaliarDestino(url);
  if (!destino.ok) {
    dep.erro(destino.motivo);
    return 1;
  }
  dep.saida(descrever(destino));
  if (!dep.argv.includes('--sim')) {
    const resposta = (await dep.perguntar(`Para migrar, digite o nome do banco (${destino.banco}): `)).trim();
    if (resposta !== destino.banco) {
      dep.erro('Confirmação diferente do nome do banco: cancelado, nada foi migrado.');
      return 1;
    }
  }
  const codigo = await dep.migrar(dep.ambiente);
  if (codigo !== 0) {
    dep.erro('A migração falhou (código de saída diferente de 0).');
    return 1;
  }
  let dados: DadosDoBanco;
  try {
    dados = await dep.conferir(url);
  } catch {
    dep.erro('Migrou, mas não foi possível ler o banco para conferir (conexão ou consulta falhou).');
    return 1;
  }
  const problemas = avaliar(dados);
  if (problemas.length > 0) {
    for (const p of problemas) dep.erro(p);
    dep.erro(`Banco fora do esperado: ${resumo(dados)}`);
    return 1;
  }
  dep.saida(`Banco conforme: ${resumo(dados)}`);
  return 0;
}

const RAIZ_SCRIPTS = join(import.meta.dirname, '../..');

/** Argumentos do node-pg-migrate: lê a URL de `NEON_URL_OWNER` (a mesma variável validada acima), nunca de argv. */
export const ARGUMENTOS_MIGRACAO = [
  'node_modules/node-pg-migrate/bin/node-pg-migrate.js',
  'up',
  '-m',
  'migracoes',
  '--database-url-var',
  'NEON_URL_OWNER',
  '--no-single-transaction',
] as const;

/** Mesmo comportamento do script `migrar`, sem carregar o arquivo de ambiente: o filho herda só o ambiente do processo. */
export function migrarDeVerdade(ambiente: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const filho = spawn(process.execPath, [...ARGUMENTOS_MIGRACAO], {
      cwd: RAIZ_SCRIPTS,
      env: ambiente,
      stdio: 'inherit',
    });
    filho.on('error', () => resolve(1));
    filho.on('close', (c) => resolve(c ?? 1));
  });
}

async function perguntarNoTerminal(pergunta: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(pergunta);
  } finally {
    rl.close();
  }
}

if (import.meta.main) {
  process.exitCode = await migrarNeon({
    ambiente: process.env,
    argv: process.argv.slice(2),
    perguntar: perguntarNoTerminal,
    migrar: migrarDeVerdade,
    conferir: (url) => conferirBanco(url),
    saida: (t) => console.info(t),
    erro: (t) => console.error(t),
  });
}
