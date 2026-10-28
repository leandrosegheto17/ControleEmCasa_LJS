import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, statSync } from 'node:fs';
import { validarUrlNeon } from './url-neon';

/**
 * Dump do Postgres cifrado em fluxo (etapa 16; SDD 3.7, D-06; G-44; TM-GH-03, TM-GH-06; ADR-016, ADR-015). Usado pelo
 * `backup.yml` (role `backup_ro`, todo dia) e pelo `deploy.yml` (role `owner`, antes da migração), pela action
 * `.github/actions/dump-cifrado`.
 *
 * - `pg_dump --format=custom --enable-row-security` (o `backup_ro` não tem BYPASSRLS; lê pela política
 *   `backup_leitura`) com o cliente da MESMA versão maior do servidor (18, ADR-016): a versão do servidor é conferida
 *   antes e outra versão derruba o passo;
 * - a saída do pg_dump vai por pipe direto para `age -r <destinatário público>`: o dump em claro nunca toca o disco;
 * - só aceita destinatário público `age1...`; uma identidade privada (`AGE-SECRET-KEY-...`) é recusada;
 * - confere que o arquivo final existe, não está vazio e começa com o cabeçalho do formato age;
 * - a URL do banco chega só pelo ambiente (`URL_BANCO`), nunca em argv; o stderr do psql/pg_dump (que pode trazer host)
 *   é descartado e a falha sai com mensagem fixa. Em qualquer falha o arquivo parcial é apagado e o código é 1;
 * - a linha de comando só aceita URL do Neon (validação única, ADR-017): local, `-pooler`, fora de `.neon.tech` ou
 *   sem TLS é recusado antes de rodar qualquer comando. A action recebe a URL do secret `NEON_URL_BACKUP`.
 */

/** Postgres 18 (ADR-016, que substitui o ADR-002), fixado por digest como as ações por SHA (G-40). Atualizar = trocar tag e digest juntos. */
export const IMAGEM_PG = 'postgres:18-alpine@sha256:10a5c69a83035ab5239f5620d708520e8b28f5aa1f2b20143e6024532edadfb5';
export const VERSAO_MAIOR = 18;
export const CABECALHO_AGE = 'age-encryption.org/v1\n';

const DESTINATARIO = /^age1[02-9ac-hj-np-z]{58}$/;

export interface Comando {
  cmd: string;
  args: string[];
}

export interface OpcoesDump {
  destinatario: string;
  saida: string;
  versao: Comando;
  dump: Comando;
  /** Comando que lê o dump em stdin e grava o cifrado em `saida`. */
  cifrar: (destinatario: string, saida: string) => Comando;
  ambiente?: NodeJS.ProcessEnv;
  versaoMaior?: number;
}

export interface ResultadoDump {
  bytes: number;
  sha256: string;
}

export function validarDestinatario(destinatario: string): void {
  if (/AGE-SECRET-KEY-/i.test(destinatario)) {
    throw new Error(
      'Isto é uma identidade PRIVADA do age: ela nunca entra no GitHub. Use o destinatário público (age1...).',
    );
  }
  if (!DESTINATARIO.test(destinatario)) throw new Error('AGE_RECIPIENT ausente ou fora do formato (age1...).');
}

function executar(c: Comando, ambiente: NodeJS.ProcessEnv): Promise<{ codigo: number; saida: string }> {
  return new Promise((resolver) => {
    const filho = spawn(c.cmd, c.args, { env: ambiente, stdio: ['ignore', 'pipe', 'ignore'] });
    let saida = '';
    filho.stdout.setEncoding('utf8').on('data', (d: string) => (saida += d));
    filho.on('error', () => resolver({ codigo: -1, saida: '' }));
    filho.on('close', (codigo) => resolver({ codigo: codigo ?? -1, saida }));
  });
}

/** Roda `dump | cifrar` sem arquivo intermediário; resolve com os códigos de saída dos dois. */
function dumpEmPipe(dump: Comando, cifrar: Comando, ambiente: NodeJS.ProcessEnv): Promise<[number, number]> {
  return new Promise((resolver) => {
    const codigos: Array<number | undefined> = [undefined, undefined];
    const fim = (i: 0 | 1, codigo: number) => {
      if (codigos[i] !== undefined) return;
      codigos[i] = codigo;
      if (codigos[0] !== undefined && codigos[1] !== undefined) resolver([codigos[0], codigos[1]]);
    };
    const produtor = spawn(dump.cmd, dump.args, { env: ambiente, stdio: ['ignore', 'pipe', 'ignore'] });
    const cifrador = spawn(cifrar.cmd, cifrar.args, { env: ambiente, stdio: ['pipe', 'ignore', 'ignore'] });
    cifrador.stdin.on('error', () => {}); // cifrador morto: o código dele já derruba o passo
    produtor.stdout.pipe(cifrador.stdin);
    produtor.on('error', () => {
      cifrador.stdin.end();
      fim(0, -1);
    });
    cifrador.on('error', () => {
      produtor.kill();
      fim(1, -1);
    });
    produtor.on('close', (c) => fim(0, c ?? -1));
    cifrador.on('close', (c) => fim(1, c ?? -1));
  });
}

export async function gerarDumpCifrado(opcoes: OpcoesDump): Promise<ResultadoDump> {
  const { destinatario, saida, ambiente = process.env, versaoMaior = VERSAO_MAIOR } = opcoes;
  validarDestinatario(destinatario);
  if (!saida.endsWith('.age')) throw new Error('O arquivo de saída precisa terminar em .age.');

  const versao = await executar(opcoes.versao, ambiente);
  const numero = versao.saida.trim();
  if (versao.codigo !== 0 || !/^\d{5,6}$/.test(numero)) throw new Error('Falha ao consultar a versão do servidor.');
  const maior = Math.floor(Number(numero) / 10_000);
  if (maior !== versaoMaior) {
    throw new Error(
      `Servidor Postgres ${maior}, cliente ${versaoMaior}: reveja o ADR-016 (substitui o ADR-002) e a imagem do dump.`,
    );
  }

  const [codigoDump, codigoCifra] = await dumpEmPipe(opcoes.dump, opcoes.cifrar(destinatario, saida), ambiente);
  try {
    if (codigoDump !== 0) throw new Error('Falha ao gerar o dump.');
    if (codigoCifra !== 0) throw new Error('Falha ao cifrar o dump.');
    let bytes = 0;
    try {
      bytes = statSync(saida).size;
    } catch {
      throw new Error('Dump cifrado não foi gravado.');
    }
    const conteudo = readFileSync(saida);
    if (bytes <= CABECALHO_AGE.length) throw new Error('Dump cifrado vazio.');
    if (!conteudo.subarray(0, CABECALHO_AGE.length).equals(Buffer.from(CABECALHO_AGE))) {
      throw new Error('O arquivo de saída não está no formato age.');
    }
    return { bytes, sha256: createHash('sha256').update(conteudo).digest('hex') };
  } catch (erro) {
    rmSync(saida, { force: true });
    throw erro;
  }
}

/** Comandos reais do runner: `psql`/`pg_dump` da imagem do Postgres 18 e o `age` instalado pela action. */
export function comandosDoRunner(imagem = IMAGEM_PG): Pick<OpcoesDump, 'versao' | 'dump' | 'cifrar'> {
  // `-e URL_BANCO` (sem valor) repassa a variável do ambiente: a URL não aparece em argv nem no log.
  const noContainer = (script: string): Comando => ({
    cmd: 'docker',
    args: ['run', '--rm', '-e', 'URL_BANCO', imagem, 'sh', '-c', script],
  });
  return {
    versao: noContainer('psql "$URL_BANCO" -X -Atc "show server_version_num"'),
    dump: noContainer('pg_dump --format=custom --enable-row-security "$URL_BANCO"'),
    cifrar: (destinatario, saida) => ({ cmd: 'age', args: ['-r', destinatario, '-o', saida] }),
  };
}

export async function main(ambiente: NodeJS.ProcessEnv = process.env): Promise<number> {
  try {
    const url = ambiente['URL_BANCO'];
    if (!url) throw new Error('URL_BANCO ausente.');
    const destino = validarUrlNeon(url, 'URL_BANCO (NEON_URL_BACKUP)');
    if (!destino.ok) throw new Error(destino.motivo);
    const r = await gerarDumpCifrado({
      destinatario: ambiente['AGE_RECIPIENT'] ?? '',
      saida: ambiente['SAIDA'] ?? '',
      ambiente,
      ...comandosDoRunner(),
    });
    console.info(`Dump cifrado: ${r.bytes} bytes, sha256 ${r.sha256}`);
    return 0;
  } catch (erro) {
    console.error((erro as Error).message);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
