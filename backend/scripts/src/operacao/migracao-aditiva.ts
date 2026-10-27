import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * G-43 (etapa 16; ADR-015): passo de CI que recusa migration não aditiva.
 *
 * O deploy migra ANTES de publicar o Worker novo, e o Worker anterior continua no ar até a publicação (e volta no
 * rollback). Por isso toda migration precisa ser compatível com o código que já está no ar. É recusado:
 *
 * - `drop` de qualquer coisa (tabela, coluna, default, constraint, índice, função, política...), exceto `drop not null`,
 *   que só afrouxa;
 * - `rename` de qualquer coisa (tabela, coluna, constraint, valor de enum);
 * - troca de tipo de coluna ou atributo (`alter column x type`, `set data type`, `alter attribute x type`);
 *   `alter type ... add value` é aditivo e passa;
 * - `add column ... not null` sem `default` (nem `generated`) e `set not null` numa tabela que não foi criada na mesma
 *   migration;
 * - `truncate`.
 *
 * A varredura ignora comentários e olha também dentro de strings e de blocos `$$` (SQL dinâmico em `execute` conta).
 *
 * **Exceção** (explícita e auditável, como pede o G-43): um comentário de linha imediatamente antes do comando,
 *
 *     -- migracao-nao-aditiva: expand=<migration da fase expand>.sql | <justificativa com 20+ caracteres>
 *     -- migracao-nao-aditiva: log | <justificativa com 20+ caracteres>
 *
 * - `expand=`: a migration citada tem de existir, ser mais antiga e, no CI (`--base <sha>`), já estar no commit de base
 *   (publicada antes; expand e contract no mesmo push não valem);
 * - `log`: o Log de Alterações do `.md/GUARDRAILS.md` tem de ter uma linha com `G-43` e o nome desta migration, com
 *   "Aprovado por" preenchido (não pendente) e validade.
 *
 * A anotação vale só para o comando seguinte; anotação sem comando não aditivo depois dela é erro. Toda exceção aceita
 * é impressa no log do CI.
 */

export type Motivo = 'drop' | 'rename' | 'alter_type' | 'not_null_sem_default' | 'set_not_null' | 'truncate';

export interface ArquivoMigracao {
  arquivo: string;
  sql: string;
}

export interface Violacao {
  arquivo: string;
  linha: number;
  motivo: Motivo;
  trecho: string;
}

export interface Excecao {
  arquivo: string;
  linha: number;
  motivos: Motivo[];
  tipo: 'expand' | 'log';
  referencia: string | null;
  justificativa: string;
}

export interface Contexto {
  /** Nomes de todos os arquivos `.sql` da pasta de migrations. */
  arquivos: string[];
  /** Conteúdo do `.md/GUARDRAILS.md` (para as exceções `log`). */
  logGuardrails: string;
  /** No CI: a migration da fase expand já estava no commit de base? Ausente = não confere. */
  existeNaBase?: (arquivo: string) => boolean;
}

export interface Analise {
  violacoes: Violacao[];
  excecoes: Excecao[];
  erros: string[];
}

export const MARCA = 'migracao-nao-aditiva';
const JUSTIFICATIVA_MINIMA = 20;
const DESCRICAO: Record<Motivo, string> = {
  drop: 'DROP',
  rename: 'RENAME',
  alter_type: 'troca de tipo (ALTER ... TYPE)',
  not_null_sem_default: 'coluna NOT NULL sem DEFAULT em tabela existente',
  set_not_null: 'SET NOT NULL em tabela existente',
  truncate: 'TRUNCATE',
};

interface Comando {
  inicio: number;
  fim: number;
  texto: string;
}
interface Anotacao {
  posicao: number;
  texto: string;
}

/**
 * Separa o SQL em comandos (por `;` fora de string, identificador entre aspas, `$tag$` e comentário) e recolhe os
 * comentários de linha de nível superior (candidatos a anotação). Comentários viram espaço; o resto fica igual, então
 * as posições batem com o arquivo original.
 */
function lexar(sql: string): { comandos: Comando[]; anotacoes: Anotacao[] } {
  const comandos: Comando[] = [];
  const anotacoes: Anotacao[] = [];
  let codigo = '';
  let inicio = -1;
  let i = 0;
  let dolar: string | null = null;
  const empurrar = (trecho: string, posicao: number) => {
    if (inicio < 0 && /\S/.test(trecho)) inicio = posicao + trecho.search(/\S/);
    codigo += trecho;
  };
  const fechar = (fim: number) => {
    if (inicio >= 0) comandos.push({ inicio, fim, texto: codigo.slice(inicio) });
    inicio = -1;
  };
  while (i < sql.length) {
    const c = sql[i]!;
    const dois = sql.slice(i, i + 2);
    if (dolar) {
      if (sql.startsWith(dolar, i)) {
        empurrar(dolar, i);
        i += dolar.length;
        dolar = null;
      } else if (dois === '--') {
        const fimLinha = sql.indexOf('\n', i);
        const ate = fimLinha < 0 ? sql.length : fimLinha;
        empurrar(' '.repeat(ate - i), i);
        i = ate;
      } else {
        empurrar(c, i);
        i += 1;
      }
      continue;
    }
    if (dois === '--') {
      const fimLinha = sql.indexOf('\n', i);
      const ate = fimLinha < 0 ? sql.length : fimLinha;
      anotacoes.push({ posicao: i, texto: sql.slice(i, ate).trim() });
      empurrar(' '.repeat(ate - i), i);
      i = ate;
      continue;
    }
    if (dois === '/*') {
      let nivel = 0;
      let j = i;
      while (j < sql.length) {
        if (sql.startsWith('/*', j)) {
          nivel += 1;
          j += 2;
        } else if (sql.startsWith('*/', j)) {
          nivel -= 1;
          j += 2;
          if (nivel === 0) break;
        } else j += 1;
      }
      empurrar(sql.slice(i, j).replace(/[^\n]/g, ' '), i);
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      const escapeBarra = c === "'" && /[eE]$/.test(sql.slice(0, i)) && !/\w[eE]$/.test(sql.slice(0, i));
      while (j < sql.length) {
        if (escapeBarra && sql[j] === '\\') j += 2;
        else if (sql[j] === c && sql[j + 1] === c) j += 2;
        else if (sql[j] === c) break;
        else j += 1;
      }
      empurrar(sql.slice(i, j + 1), i);
      i = j + 1;
      continue;
    }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m && !/[\w$]$/.test(sql.slice(0, i))) {
        dolar = m[0];
        empurrar(m[0], i);
        i += m[0].length;
        continue;
      }
    }
    if (c === ';') {
      fechar(i);
      codigo += c;
      i += 1;
      continue;
    }
    empurrar(c, i);
    i += 1;
  }
  fechar(sql.length);
  return { comandos, anotacoes };
}

/** Minúsculas, sem aspas de identificador e com espaços simples. */
function normalizar(texto: string): string {
  return texto.toLowerCase().replace(/"/g, '').replace(/\s+/g, ' ').trim();
}

/** Último segmento de um nome qualificado (`app.conta` → `conta`). */
const nomeSimples = (nome: string) => nome.split('.').pop()!;

/** Divide por vírgulas de nível superior (fora de parênteses). */
function porVirgulas(texto: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let atual = '';
  for (const c of texto) {
    if (c === '(') nivel += 1;
    if (c === ')') nivel -= 1;
    if (c === ',' && nivel === 0) {
      partes.push(atual.trim());
      atual = '';
    } else atual += c;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}

const RE_DROP = /\bdrop\b(?! not null\b)/;
const RE_RENAME = /\brename\b/;
const RE_ALTER_TYPE = /\balter (?:(?:column|attribute) )?[\w$.]+ (?:set data )?type\b/;
const RE_TRUNCATE = /\btruncate\b/;
const RE_CRIA_TABELA =
  /\bcreate (?:(?:global |local )?(?:temp|temporary|unlogged) )?table (?:if not exists )?([\w$.]+)/g;
const RE_ALTER_TABLE = /^alter table (?:if exists )?(?:only )?([\w$.]+)\*? (.*)$/;
const RE_ADD_COLUNA =
  /^add (?:column )?(?:if not exists )?(?!constraint\b|primary\b|unique\b|foreign\b|check\b|exclude\b)[\w$]+ (.*)$/;

function motivosDoComando(texto: string, criadas: Set<string>): Motivo[] {
  const n = normalizar(texto);
  const motivos = new Set<Motivo>();
  if (RE_DROP.test(n)) motivos.add('drop');
  if (RE_RENAME.test(n)) motivos.add('rename');
  if (RE_ALTER_TYPE.test(n)) motivos.add('alter_type');
  if (RE_TRUNCATE.test(n)) motivos.add('truncate');
  const alter = RE_ALTER_TABLE.exec(n.replace(/;$/, ''));
  if (alter && !criadas.has(nomeSimples(alter[1]!))) {
    for (const clausula of porVirgulas(alter[2]!)) {
      const add = RE_ADD_COLUNA.exec(clausula);
      if (add && /\bnot null\b/.test(add[1]!) && !/\b(?:default|generated)\b/.test(add[1]!)) {
        motivos.add('not_null_sem_default');
      }
      if (/^alter (?:column )?[\w$]+ set not null\b/.test(clausula)) motivos.add('set_not_null');
    }
  }
  return [...motivos];
}

/** A linha (1-based) de uma posição do texto. */
const linhaDe = (sql: string, posicao: number) => sql.slice(0, posicao).split('\n').length;

/**
 * Há, na tabela do "## Log de Alterações" do GUARDRAILS, uma linha com `G-43` e o nome da migration, aprovada (coluna
 * "Aprovado por" preenchida e não pendente) e com validade?
 */
export function linhaDoLogAprovada(documento: string, arquivo: string): boolean {
  const inicio = documento.search(/^## Log de Alterações\s*$/m);
  if (inicio < 0) return false;
  const resto = documento.slice(inicio).split('\n').slice(1);
  const fim = resto.findIndex((l) => /^#{1,2} /.test(l));
  const linhas = (fim < 0 ? resto : resto.slice(0, fim)).filter((l) => l.trim().startsWith('|'));
  const vazio = (celula: string) => celula === '' || /^[—–-]/.test(celula) || /pendente/i.test(celula);
  return linhas.slice(2).some((linha) => {
    const celulas = linha
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
    if (celulas.length < 6) return false;
    return linha.includes('G-43') && linha.includes(arquivo) && !vazio(celulas[2]!) && !vazio(celulas[5]!);
  });
}

const RE_ANOTACAO = new RegExp(`^--\\s*${MARCA}\\b`);
const RE_ANOTACAO_COMPLETA = new RegExp(`^--\\s*${MARCA}:\\s*(?:expand=(\\S+\\.sql)|(log))\\s*\\|\\s*(.+?)\\s*$`);

export function analisarMigracao(migracao: ArquivoMigracao, ctx: Contexto): Analise {
  const { arquivo, sql } = migracao;
  const { comandos, anotacoes } = lexar(sql);
  const criadas = new Set<string>();
  for (const c of comandos) {
    for (const m of normalizar(c.texto).matchAll(RE_CRIA_TABELA)) criadas.add(nomeSimples(m[1]!));
  }
  const porComando = comandos.map((c) => ({ comando: c, motivos: motivosDoComando(c.texto, criadas) }));
  const liberados = new Set<number>();
  const excecoes: Excecao[] = [];
  const erros: string[] = [];

  for (const anotacao of anotacoes.filter((a) => RE_ANOTACAO.test(a.texto))) {
    const onde = `${arquivo}:${linhaDe(sql, anotacao.posicao)}`;
    const m = RE_ANOTACAO_COMPLETA.exec(anotacao.texto);
    if (!m) {
      erros.push(
        `${onde}: anotação fora do formato "-- ${MARCA}: expand=<arquivo>.sql | <justificativa>" ou "log | ...".`,
      );
      continue;
    }
    const [, expand, log, justificativa] = m;
    if (justificativa!.length < JUSTIFICATIVA_MINIMA) {
      erros.push(`${onde}: justificativa com menos de ${JUSTIFICATIVA_MINIMA} caracteres.`);
      continue;
    }
    if (expand) {
      if (!ctx.arquivos.includes(expand) || expand >= arquivo) {
        erros.push(`${onde}: a fase expand "${expand}" tem de ser uma migration existente e mais antiga que esta.`);
        continue;
      }
      if (ctx.existeNaBase && !ctx.existeNaBase(expand)) {
        erros.push(`${onde}: a fase expand "${expand}" não estava publicada (ausente no commit de base).`);
        continue;
      }
    } else if (log && !linhaDoLogAprovada(ctx.logGuardrails, arquivo)) {
      erros.push(
        `${onde}: falta no Log de Alterações (.md/GUARDRAILS.md) uma linha aprovada, com validade, citando G-43 e ${arquivo}.`,
      );
      continue;
    }
    const indice = porComando.findIndex((p) => p.comando.fim > anotacao.posicao);
    const alvo = porComando[indice];
    if (!alvo || alvo.motivos.length === 0) {
      erros.push(`${onde}: a anotação não precede um comando não aditivo.`);
      continue;
    }
    liberados.add(indice);
    excecoes.push({
      arquivo,
      linha: linhaDe(sql, alvo.comando.inicio),
      motivos: alvo.motivos,
      tipo: expand ? 'expand' : 'log',
      referencia: expand ?? null,
      justificativa: justificativa!,
    });
  }

  const violacoes: Violacao[] = [];
  porComando.forEach(({ comando, motivos }, indice) => {
    if (liberados.has(indice)) return;
    for (const motivo of motivos) {
      violacoes.push({
        arquivo,
        linha: linhaDe(sql, comando.inicio),
        motivo,
        trecho: comando.texto.replace(/\s+/g, ' ').trim().slice(0, 120),
      });
    }
  });
  return { violacoes, excecoes, erros };
}

export interface Resultado {
  /** Violações sem exceção e anotações inválidas, já formatadas. Vazio = passou. */
  erros: string[];
  excecoes: Excecao[];
}

export function conferirMigracoes(migracoes: ArquivoMigracao[], ctx: Contexto): Resultado {
  const erros: string[] = [];
  const excecoes: Excecao[] = [];
  for (const m of migracoes) {
    const a = analisarMigracao(m, ctx);
    erros.push(...a.erros);
    excecoes.push(...a.excecoes);
    for (const v of a.violacoes)
      erros.push(`${v.arquivo}:${v.linha}: ${DESCRICAO[v.motivo]} não é aditivo: ${v.trecho}`);
  }
  return { erros, excecoes };
}

const RAIZ = join(import.meta.dirname, '../../../..');
export const PASTA_MIGRACOES = 'backend/scripts/migracoes';

export interface Pasta {
  listar: () => string[];
  ler: (arquivo: string) => string;
  guardrails: () => string;
}

const pastaDoRepositorio: Pasta = {
  listar: () => readdirSync(join(RAIZ, PASTA_MIGRACOES)),
  ler: (arquivo) => readFileSync(join(RAIZ, PASTA_MIGRACOES, arquivo), 'utf8'),
  guardrails: () => readFileSync(join(RAIZ, '.md/GUARDRAILS.md'), 'utf8'),
};

/** `git cat-file -e <ref>:<caminho>`: o arquivo existia no commit? */
function existeNoGit(ref: string, caminho: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}:${caminho}`], { cwd: RAIZ, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * CLI: `pnpm --filter @controle/scripts migracoes-aditivas [--base <sha>]`. No CI, `--base` é o commit anterior ao push
 * (ou a base do pull request): é contra ele que se confere se a fase expand já tinha sido publicada.
 */
export async function main(
  args: string[] = process.argv.slice(2),
  pasta: Pasta = pastaDoRepositorio,
  log: (linha: string) => void = (l) => console.info(l),
  naBase: (ref: string, caminho: string) => boolean = existeNoGit,
): Promise<number> {
  const i = args.indexOf('--base');
  const base = i >= 0 ? (args[i + 1] ?? '') : '';
  const comBase = base !== '' && !/^0+$/.test(base);
  if (!comBase) log('Aviso: sem commit de base; a fase expand das exceções é conferida só pela ordem das migrations.');
  const arquivos = pasta
    .listar()
    .filter((a) => a.endsWith('.sql'))
    .sort();
  const migracoes = arquivos.map((arquivo) => ({ arquivo, sql: pasta.ler(arquivo) }));
  const { erros, excecoes } = conferirMigracoes(migracoes, {
    arquivos,
    logGuardrails: pasta.guardrails(),
    existeNaBase: comBase ? (arquivo) => naBase(base, `${PASTA_MIGRACOES}/${arquivo}`) : undefined,
  });
  for (const e of excecoes) {
    log(
      `Exceção aceita (G-43): ${e.arquivo}:${e.linha} [${e.motivos.join(', ')}] ${e.tipo}${e.referencia ? `=${e.referencia}` : ''}: ${e.justificativa}`,
    );
  }
  if (erros.length === 0) {
    log(`${migracoes.length} migrations conferidas: todas aditivas.`);
    return 0;
  }
  for (const e of erros) log(`::error::${e}`);
  log(
    `Migration não aditiva (G-43). Divida em expand e contract, ou anote o comando com "-- ${MARCA}: expand=<arquivo>.sql | <justificativa>" ou "-- ${MARCA}: log | <justificativa>" (linha aprovada no Log de Alterações).`,
  );
  return 1;
}

if (import.meta.main) {
  process.exitCode = await main();
}
