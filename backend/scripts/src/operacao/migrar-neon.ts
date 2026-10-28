import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';
import { avaliar, conferirBanco, resumo, type DadosDoBanco } from './conferir-banco';
import { validarUrlNeon, type DestinoNeon } from './url-neon';

/**
 * Migra o banco do Neon confirmando o destino (G-43; TM-DB-05; roteiro `.specs/etapa-17/neon.md`, passos 5 e 6).
 * O `.env` da raiz aponta para o Postgres local do Docker; por isso este comando NÃO carrega `.env`: a
 * `NEON_URL_OWNER` (ou, com `--dev`, a `NEON_URL_DEV` da branch `dev`) tem de vir do ambiente do terminal. Recusa destino local, fora de `.neon.tech`, host `-pooler`
 * e URL sem TLS; mostra usuário, host e banco (senha nunca) e só migra com o nome do banco digitado (ou `--sim`).
 * Nunca imprime a URL nem o texto bruto de erro do driver.
 */

export type Destino = DestinoNeon;

/** Variável da URL: `NEON_URL_OWNER` (branch `main`) ou, com `--dev`, `NEON_URL_DEV` (owner da branch `dev`; ADR-017). */
export function variavelDoDestino(argv: string[]): 'NEON_URL_OWNER' | 'NEON_URL_DEV' {
  return argv.includes('--dev') ? 'NEON_URL_DEV' : 'NEON_URL_OWNER';
}

/** Destino da migração: a validação única do Neon (ADR-017, decisão 4) aplicada à variável usada. */
export function avaliarDestino(url: string, variavel: string = 'NEON_URL_OWNER'): Destino {
  return validarUrlNeon(url, variavel);
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
  /** Roda a migração lendo a URL da variável indicada; devolve o código de saída. */
  migrar: (ambiente: NodeJS.ProcessEnv, variavel: string) => Promise<number>;
  /** Lê o banco após migrar (mesma checagem do conferir-banco). */
  conferir: (url: string) => Promise<DadosDoBanco>;
  saida: (texto: string) => void;
  erro: (texto: string) => void;
}

export async function migrarNeon(dep: Dependencias): Promise<number> {
  const variavel = variavelDoDestino(dep.argv);
  const url = dep.ambiente[variavel];
  if (!url) {
    dep.erro(
      `${variavel} ausente no ambiente do terminal. Este comando não lê o .env (ele aponta para o banco local). ` +
        'Defina a variável com a URL direta do owner do Neon e rode de novo.',
    );
    return 1;
  }
  const destino = avaliarDestino(url, variavel);
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
  const codigo = await dep.migrar(dep.ambiente, variavel);
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

/** Argumentos do node-pg-migrate: lê a URL da variável validada acima (nome, nunca o valor em argv). */
export function argumentosDaMigracao(variavel: string): string[] {
  return [
    'node_modules/node-pg-migrate/bin/node-pg-migrate.js',
    'up',
    '-m',
    'migracoes',
    '--database-url-var',
    variavel,
    '--no-single-transaction',
  ];
}

/** Os argumentos do caminho padrão (branch `main`, `NEON_URL_OWNER`). */
export const ARGUMENTOS_MIGRACAO = argumentosDaMigracao('NEON_URL_OWNER');

/** Mesmo comportamento do script `migrar`, sem carregar o arquivo de ambiente: o filho herda só o ambiente do processo. */
export function migrarDeVerdade(ambiente: NodeJS.ProcessEnv, variavel: string): Promise<number> {
  return new Promise((resolve) => {
    const filho = spawn(process.execPath, argumentosDaMigracao(variavel), {
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
