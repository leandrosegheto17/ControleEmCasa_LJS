import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * G-42 (etapa 16; SDD 11.1; TM-GH-04; ADR-015): só o `.github/workflows/deploy.yml` publica o Worker, e uma única vez.
 *
 * Regra (o teste `wrangler-deploy-unico.test.ts` aplica a todos os arquivos do repositório, versionados ou novos e não
 * ignorados, exceto a pasta `.claude/`, que guarda as ferramentas dos fluxos e não o app):
 *
 * 1. **Arquivos executáveis ou de automação** (`.github/**` em YAML, todo `package.json`, scripts `.sh`, `.js`, `.ts`,
 *    `.mjs`, `.cjs`, `.ps1`, `.cmd`, `.bat`, `.py`..., `Dockerfile`, `Makefile`, `justfile`): nenhuma linha pode
 *    publicar com o wrangler (`deploy`, `publish`, `versions|pages|triggers deploy`, com ou sem flags antes do
 *    subcomando, linhas quebradas com `\` juntadas) nem usar as actions de publicação da Cloudflare (wrangler-action, pages-action).
 *    Em YAML, comentários (`#`) não contam; no código, contam até em comentário (escreva "publicação do Worker").
 *    A ÚNICA exceção é o `deploy.yml`, que precisa ter **exatamente uma** linha de publicação fora de comentários.
 * 2. **Documentação** (`.md`, `.mdx`, `.txt`, inclusive README e `docs/runbook.md`): pode citar o comando no texto e em
 *    código de linha (`` `...` ``), porque isso não roda. Dentro de bloco cercado (```), que é o que se copia e cola num
 *    terminal, é proibido; só o bloco `mermaid` (diagrama) está liberado.
 *
 * Risco residual aceito: ofuscação deliberada (variáveis, base64, comando montado em partes) não é detectada; o controle
 * real é a revisão, a proteção da `main` e o environment `producao` (TM-GH-04).
 */

export const DEPLOY_YML = '.github/workflows/deploy.yml';

/** Publicação com o wrangler: aceita versão (`wrangler@4`), `.cmd`/`.exe` e flags com valor antes do subcomando. */
export const PUBLICACAO =
  /\bwrangler(?:@[\w.^~<>=*-]+|\.(?:cmd|exe))?(?:\s+-\S+(?:\s+(?:"[^"]*"|'[^']*'|[^\s"'-]\S*))?)*\s+(?:(?:versions|pages|triggers)\s+)?(?:deploy|publish)\b/;
export const ACAO_CLOUDFLARE = /\bcloudflare\/(?:wrangler|pages)-action\b/i;

const FORA = /^\.claude\//;
const YAML = /\.ya?ml$/i;
const EXECUTAVEL =
  /(^\.github\/.*\.ya?ml$)|(^|\/)package\.json$|\.(sh|bash|zsh|js|mjs|cjs|jsx|ts|mts|cts|tsx|ps1|psm1|cmd|bat|py|rb)$|(^|\/)(Dockerfile(\.[^/]*)?|[^/]*\.Dockerfile|(GNU)?Makefile|justfile)$/i;
const DOCUMENTO = /\.(md|mdx|txt)$/i;

export interface Achado {
  arquivo: string;
  linha: number;
  texto: string;
}

/** Tira comentário `#` de uma linha YAML, respeitando aspas (um `#` dentro de string não é comentário). */
function semComentarioYaml(linha: string): string {
  let aspas: string | null = null;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i]!;
    if (aspas) {
      if (c === aspas) aspas = null;
    } else if (c === '"' || c === "'") aspas = c;
    else if (c === '#' && (i === 0 || /\s/.test(linha[i - 1]!))) return linha.slice(0, i);
  }
  return linha;
}

/** Linhas lógicas (com `\` de continuação juntado), cada uma com o número da linha onde começa. */
function linhasLogicas(texto: string, yaml: boolean): Array<{ linha: number; texto: string }> {
  const brutas = texto.split(/\r?\n/).map((l) => (yaml ? semComentarioYaml(l) : l));
  const saida: Array<{ linha: number; texto: string }> = [];
  for (let i = 0; i < brutas.length; i += 1) {
    const inicio = i;
    let junta = brutas[i]!;
    while (/\\\s*$/.test(junta) && i + 1 < brutas.length) {
      i += 1;
      junta = `${junta.replace(/\\\s*$/, '')} ${brutas[i]!.trim()}`;
    }
    saida.push({ linha: inicio + 1, texto: junta });
  }
  return saida;
}

/** Linhas de publicação e de action da Cloudflare num arquivo executável. */
export function publicacoesEmCodigo(arquivo: string, texto: string): Achado[] {
  return linhasLogicas(texto, YAML.test(arquivo))
    .filter((l) => PUBLICACAO.test(l.texto) || ACAO_CLOUDFLARE.test(l.texto))
    .map((l) => ({ arquivo, linha: l.linha, texto: l.texto.trim().slice(0, 160) }));
}

/** Linhas de publicação dentro de blocos cercados (``` ou ~~~) de um documento, fora dos blocos `mermaid`. */
export function publicacoesEmDocumento(arquivo: string, texto: string): Achado[] {
  const achados: Achado[] = [];
  let cerca: { marca: string; mermaid: boolean } | null = null;
  const linhas = texto.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i += 1) {
    const l = linhas[i]!;
    const abre = /^\s{0,3}(`{3,}|~{3,})\s*([\w-]*)/.exec(l);
    if (!cerca && abre) {
      cerca = { marca: abre[1]!, mermaid: abre[2]!.toLowerCase() === 'mermaid' };
      continue;
    }
    if (cerca && new RegExp(`^\\s{0,3}${cerca.marca[0] === '`' ? '`' : '~'}{${cerca.marca.length},}\\s*$`).test(l)) {
      cerca = null;
      continue;
    }
    if (cerca && !cerca.mermaid) {
      let junta = l;
      let j = i;
      while (/\\\s*$/.test(junta) && j + 1 < linhas.length) {
        j += 1;
        junta = `${junta.replace(/\\\s*$/, '')} ${linhas[j]!.trim()}`;
      }
      if (PUBLICACAO.test(junta) || ACAO_CLOUDFLARE.test(junta)) {
        achados.push({ arquivo, linha: i + 1, texto: l.trim().slice(0, 160) });
      }
    }
  }
  return achados;
}

/** Arquivos do repositório que o git conhece: versionados e novos não ignorados (fora `.claude/`). */
export function arquivosDoRepositorio(raiz: string): string[] {
  const saida = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: raiz,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set(saida.split('\0').filter(Boolean))]
    .filter((a) => !FORA.test(a))
    .filter((a) => existsSync(join(raiz, a)));
}

export interface Varredura {
  /** Publicações fora do `deploy.yml` (precisa ser vazia). */
  proibidas: Achado[];
  /** Publicações dentro do `deploy.yml` (precisa ter exatamente uma). */
  noDeploy: Achado[];
}

export function varrer(raiz: string, arquivos = arquivosDoRepositorio(raiz)): Varredura {
  const proibidas: Achado[] = [];
  let noDeploy: Achado[] = [];
  for (const arquivo of arquivos) {
    const executavel = EXECUTAVEL.test(arquivo);
    const documento = DOCUMENTO.test(arquivo);
    if (!executavel && !documento) continue;
    const texto = readFileSync(join(raiz, arquivo), 'utf8');
    if (arquivo === DEPLOY_YML) {
      noDeploy = publicacoesEmCodigo(arquivo, texto);
      proibidas.push(...noDeploy.filter((a) => ACAO_CLOUDFLARE.test(a.texto)));
      continue;
    }
    proibidas.push(...(executavel ? publicacoesEmCodigo(arquivo, texto) : publicacoesEmDocumento(arquivo, texto)));
  }
  return { proibidas, noDeploy };
}
