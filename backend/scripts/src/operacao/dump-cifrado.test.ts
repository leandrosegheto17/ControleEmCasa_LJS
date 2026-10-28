import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CABECALHO_AGE,
  comandosDoRunner,
  gerarDumpCifrado,
  IMAGEM_PG,
  main,
  validarDestinatario,
  type Comando,
  type OpcoesDump,
} from './dump-cifrado';

/**
 * Dump cifrado com age (G-44; TM-GH-03, TM-GH-06; ADR-002, ADR-015). Sem banco real, sem docker e sem age: os comandos
 * são scripts Node falsos numa pasta temporária. Critérios: só destinatário público; cliente da mesma versão maior do
 * servidor; dump em pipe para o cifrador (nada em claro no disco); qualquer falha apaga o parcial e não vaza o stderr.
 */

const DESTINATARIO = 'age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p';
/** Formato de identidade privada do age, montado em partes para o gitleaks não confundir com uma chave real. */
const IDENTIDADE_FALSA = ['AGE-SECRET-KEY-1', 'Q'.repeat(58)].join('');
const DUMP_EM_CLARO = 'PGDMP-conteudo-em-claro-com-email@exemplo.com';

let pasta: string;
let saida: string;

let contador = 0;
/** Cada chamada grava um arquivo novo: as opções padrão não sobrescrevem o comando falso de um teste. */
function script(nome: string, codigo: string): Comando {
  contador += 1;
  const caminho = join(pasta, `${nome}-${contador}.mjs`);
  writeFileSync(caminho, codigo);
  return { cmd: process.execPath, args: [caminho] };
}

const versao = (texto: string, codigo = 0) =>
  script('versao', `process.stdout.write(${JSON.stringify(texto)}); process.exit(${codigo});`);
const dump = (codigo = 0) =>
  script(
    'dump',
    `process.stderr.write('host=db.interno senha=nao-pode-vazar\\n');
     process.stdout.write(${JSON.stringify(DUMP_EM_CLARO)}, () => process.exit(${codigo}));`,
  );
/** "age" falso: lê stdin e grava cabeçalho age + base64 do conteúdo no arquivo do `-o`. */
function cifrador(opcoes: { codigo?: number; cabecalho?: string; vazio?: boolean } = {}) {
  const c = script(
    'age',
    `const [, , flagR, dest, flagO, arq] = process.argv;
     const partes = [];
     process.stdin.on('data', (d) => partes.push(d));
     process.stdin.on('end', async () => {
       const { writeFileSync } = await import('node:fs');
       if (flagR !== '-r' || flagO !== '-o' || !dest.startsWith('age1')) process.exit(9);
       const corpo = ${opcoes.vazio ? "''" : `${JSON.stringify(opcoes.cabecalho ?? CABECALHO_AGE)} + Buffer.concat(partes).toString('base64')`};
       writeFileSync(arq, corpo);
       process.exit(${opcoes.codigo ?? 0});
     });`,
  );
  return (dest: string, arq: string): Comando => ({ cmd: c.cmd, args: [...c.args, '-r', dest, '-o', arq] });
}

function opcoes(extra: Partial<OpcoesDump> = {}): OpcoesDump {
  return {
    destinatario: DESTINATARIO,
    saida,
    versao: versao('180004\n'),
    dump: dump(),
    cifrar: cifrador(),
    ...extra,
  };
}

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'dump-cifrado-'));
  // pasta de saída separada dos scripts falsos: no fim, ela só pode ter o .age
  mkdirSync(join(pasta, 'saida'));
  saida = join(pasta, 'saida', 'backup.sql.age');
});

afterEach(() => {
  rmSync(pasta, { recursive: true, force: true });
});

describe('validarDestinatario', () => {
  it('aceita só o destinatário público age1...', () => {
    expect(() => validarDestinatario(DESTINATARIO)).not.toThrow();
  });

  it('recusa a identidade privada com mensagem própria', () => {
    expect(() => validarDestinatario(IDENTIDADE_FALSA)).toThrow(/PRIVADA/);
  });

  it.each(['', 'age1curta', `${DESTINATARIO}x`, DESTINATARIO.replace('age1', 'agE1'), `age1${'b'.repeat(58)}`])(
    'recusa %j',
    (d) => {
      expect(() => validarDestinatario(d)).toThrow(/AGE_RECIPIENT/);
    },
  );
});

describe('gerarDumpCifrado', () => {
  it('cifra em fluxo: só o .age fica na pasta de saída, com o cabeçalho do age e sem o conteúdo em claro', async () => {
    const r = await gerarDumpCifrado(opcoes());
    expect(readdirSync(join(pasta, 'saida'))).toEqual(['backup.sql.age']);
    const conteudo = readFileSync(saida, 'utf8');
    expect(conteudo.startsWith(CABECALHO_AGE)).toBe(true);
    expect(conteudo).not.toContain(DUMP_EM_CLARO);
    expect(Buffer.from(conteudo.slice(CABECALHO_AGE.length), 'base64').toString()).toBe(DUMP_EM_CLARO);
    expect(r.bytes).toBe(Buffer.byteLength(conteudo));
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('servidor de outra versão maior: falha antes de rodar o dump (ADR-002)', async () => {
    const dumpEspiao = script(
      'dump-espiao',
      `process.getBuiltinModule('node:fs').writeFileSync(${JSON.stringify(join(pasta, 'rodou'))}, '1');`,
    );
    await expect(gerarDumpCifrado(opcoes({ versao: versao('160008'), dump: dumpEspiao }))).rejects.toThrow(/ADR-002/);
    await expect(gerarDumpCifrado(opcoes({ versao: versao('190001'), dump: dumpEspiao }))).rejects.toThrow(/ADR-002/);
    expect(existsSync(join(pasta, 'rodou'))).toBe(false);
    // controle positivo: com a versão certa, o mesmo espião roda
    await gerarDumpCifrado(opcoes({ dump: dumpEspiao })).catch(() => {});
    expect(existsSync(join(pasta, 'rodou'))).toBe(true);
  });

  it('versão ilegível ou consulta que falha: mensagem fixa', async () => {
    await expect(gerarDumpCifrado(opcoes({ versao: versao('abc') }))).rejects.toThrow(/versão do servidor/);
    await expect(gerarDumpCifrado(opcoes({ versao: versao('180004', 2) }))).rejects.toThrow(/versão do servidor/);
  });

  it('pg_dump que falha: apaga o parcial e não repassa o stderr (host, senha)', async () => {
    const erro = await gerarDumpCifrado(opcoes({ dump: dump(1) })).catch((e: Error) => e);
    expect((erro as Error).message).toBe('Falha ao gerar o dump.');
    expect((erro as Error).message).not.toMatch(/host|senha/);
    expect(existsSync(saida)).toBe(false);
  });

  it('cifrador que falha, que grava vazio ou fora do formato age: falha e apaga o arquivo', async () => {
    await expect(gerarDumpCifrado(opcoes({ cifrar: cifrador({ codigo: 1 }) }))).rejects.toThrow(/cifrar/);
    expect(existsSync(saida)).toBe(false);
    await expect(gerarDumpCifrado(opcoes({ cifrar: cifrador({ vazio: true }) }))).rejects.toThrow(/vazio/);
    expect(existsSync(saida)).toBe(false);
    await expect(gerarDumpCifrado(opcoes({ cifrar: cifrador({ cabecalho: 'PGDMP' }) }))).rejects.toThrow(/formato age/);
    expect(existsSync(saida)).toBe(false);
  });

  it('comando inexistente conta como falha', async () => {
    await expect(gerarDumpCifrado(opcoes({ dump: { cmd: join(pasta, 'nao-existe'), args: [] } }))).rejects.toThrow(
      /dump/,
    );
  });

  it('recusa saída que não termina em .age e destinatário privado antes de rodar qualquer comando', async () => {
    const espiao = script(
      'espiao',
      `process.getBuiltinModule('node:fs').writeFileSync(${JSON.stringify(join(pasta, 'rodou'))}, '1');`,
    );
    await expect(
      gerarDumpCifrado(opcoes({ saida: join(pasta, 'saida', 'backup.dump'), versao: espiao })),
    ).rejects.toThrow(/\.age/);
    await expect(gerarDumpCifrado(opcoes({ destinatario: 'AGE-SECRET-KEY-1ABC', versao: espiao }))).rejects.toThrow(
      /PRIVADA/,
    );
    expect(existsSync(join(pasta, 'rodou'))).toBe(false);
    // controle positivo: com saída e destinatário válidos, o espião (no lugar da consulta de versão) roda
    await gerarDumpCifrado(opcoes({ versao: espiao })).catch(() => {});
    expect(existsSync(join(pasta, 'rodou'))).toBe(true);
  });
});

describe('comandos do runner', () => {
  it('usam o Postgres 18 fixado por digest, pg_dump -Fc com --enable-row-security e a URL só pelo ambiente', () => {
    expect(IMAGEM_PG).toMatch(/^postgres:18[-\w]*@sha256:[0-9a-f]{64}$/);
    const c = comandosDoRunner();
    const tudo = [c.versao, c.dump].flatMap((x) => [x.cmd, ...x.args]).join(' ');
    expect(c.dump.args).toContain(IMAGEM_PG);
    expect(c.dump.args.at(-1)).toBe('pg_dump --format=custom --enable-row-security "$URL_BANCO"');
    expect(c.versao.args.at(-1)).toContain('show server_version_num');
    expect(c.dump.args).toEqual(expect.arrayContaining(['-e', 'URL_BANCO']));
    expect(tudo).not.toMatch(/postgres(ql)?:\/\//);
    expect(c.cifrar(DESTINATARIO, '/tmp/x.age')).toEqual({
      cmd: 'age',
      args: ['-r', DESTINATARIO, '-o', '/tmp/x.age'],
    });
  });

  it('main sem URL_BANCO sai com 1 sem rodar nada', async () => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await main({ AGE_RECIPIENT: DESTINATARIO, SAIDA: saida })).toBe(1);
      expect(e).toHaveBeenCalledWith('URL_BANCO ausente.');
    } finally {
      e.mockRestore();
    }
  });

  // Padrão do Neon (ADR-017, decisão 4): o backup e o dump do deploy só aceitam URL do Neon (validação única).
  it.each([
    ['local', 'postgres://controle_backup_ro:x@127.0.0.1:55432/controle', /local/],
    ['pooler', 'postgresql://u:x@ep-a-pooler.sa-east-1.aws.neon.tech/controle?sslmode=require', /-pooler/],
    ['fora do Neon', 'postgresql://u:x@db.exemplo.com/controle?sslmode=require', /\.neon\.tech/],
    ['sem TLS', 'postgresql://u:x@ep-a.sa-east-1.aws.neon.tech/controle', /sslmode/],
  ])('main recusa URL_BANCO %s antes de rodar qualquer comando', async (_n, url, motivo) => {
    const e = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await main({ URL_BANCO: url, AGE_RECIPIENT: DESTINATARIO, SAIDA: saida })).toBe(1);
      const msg = e.mock.calls.flat().join('\n');
      expect(msg).toMatch(motivo);
      expect(msg).toContain('URL_BANCO');
      expect(msg).not.toContain(':x@');
      expect(existsSync(saida)).toBe(false);
    } finally {
      e.mockRestore();
    }
  });
});
