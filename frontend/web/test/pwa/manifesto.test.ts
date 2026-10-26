// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { extname } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lerToken } from '../../scripts/lerToken.mjs';

const RAIZ_WEB = fileURLToPath(new URL('../../', import.meta.url));

type Icone = { src: string; sizes: string; type?: string; purpose?: string };
type Manifesto = {
  name: string;
  short_name: string;
  lang: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: Icone[];
};

let saida: string;
let manifesto: Manifesto;
const corFundo = lerToken(readFileSync(new URL('../../src/estilo/tokens.css', import.meta.url), 'utf8'), '--cor-fundo');

beforeAll(async () => {
  saida = mkdtempSync(join(tmpdir(), 'controle-pwa-'));
  // O Vitest define NODE_ENV=test; o build de produção precisa do NODE_ENV de produção (React sem as mensagens de dev).
  const antes = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  try {
    await build({
      root: RAIZ_WEB,
      configFile: join(RAIZ_WEB, 'vite.config.ts'),
      mode: 'production',
      logLevel: 'silent',
      build: { outDir: saida, emptyOutDir: true },
    });
  } finally {
    process.env['NODE_ENV'] = antes;
  }
  manifesto = JSON.parse(readFileSync(join(saida, 'manifest.webmanifest'), 'utf8'));
}, 180_000);

afterAll(() => {
  if (saida) rmSync(saida, { recursive: true, force: true });
});

describe('manifest.webmanifest do build', () => {
  it('nome, idioma e display standalone', () => {
    expect(manifesto.name).toBe('Controle em Casa');
    expect(manifesto.short_name).toBe('Controle');
    expect(manifesto.lang).toBe('pt-BR');
    expect(manifesto.display).toBe('standalone');
  });

  it('o app vive em /app/: start_url e scope', () => {
    expect(manifesto.start_url).toBe('/app/');
    expect(manifesto.scope).toBe('/app/');
  });

  it('theme_color e background_color vêm do token --cor-fundo', () => {
    expect(manifesto.theme_color.toLowerCase()).toBe(corFundo.toLowerCase());
    expect(manifesto.background_color.toLowerCase()).toBe(corFundo.toLowerCase());
  });

  it('tem ícones 192 e 512 e um maskable', () => {
    const tamanhos = manifesto.icons.map((i) => i.sizes);
    expect(tamanhos).toContain('192x192');
    expect(tamanhos).toContain('512x512');
    expect(manifesto.icons.some((i) => i.purpose?.split(' ').includes('maskable'))).toBe(true);
  });
});

describe('service worker do build (G-39)', () => {
  it('o sw.js existe, usa NetworkOnly para /api e não guarda resposta da API', () => {
    const sw = readFileSync(join(saida, 'sw.js'), 'utf8');
    expect(sw).toMatch(/\/api/);
    expect(sw).not.toMatch(/importScripts\(\s*["']https?:/);
    expect(sw).not.toMatch(/supabase/);
  });

  it('o precache não leva nenhuma rota da API', () => {
    const sw = readFileSync(join(saida, 'sw.js'), 'utf8');
    const urls = [...sw.matchAll(/"url":"([^"]+)"/g)].map((m) => m[1] as string);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((u) => u.startsWith('/api') || u.startsWith('api'))).toEqual([]);
    expect(urls).toContain('index.html');
  });

  it('o bundle do app não carrega o contrato (Zod) em produção: validação só em dev e teste', () => {
    const pasta = join(saida, 'assets');
    const arquivos = readdirSync(pasta).filter((n) => n.endsWith('.js'));
    expect(arquivos.length).toBeGreaterThan(0);
    for (const nome of arquivos) expect(readFileSync(join(pasta, nome), 'utf8'), nome).not.toMatch(/ZodError/);
  });
});

describe('index.html do build', () => {
  it('aponta o apple-touch-icon, a cor do tema e o título do app', () => {
    const html = readFileSync(join(saida, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="apple-touch-icon" href="/icones/apple-touch-icon.png"');
    expect(html.toLowerCase()).toMatch(new RegExp(`<meta name="theme-color" content="${corFundo.toLowerCase()}"`));
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Controle em Casa"');
  });
});

/**
 * G-35: o build não fala com nenhum host de terceiros. Os literais `http(s)://` que sobram em bibliotecas são
 * links de documentação ou namespaces XML, nunca requisições; a lista é fechada (host + caminho) e acrescentar
 * item segue a governança de exceções do GUARDRAILS. A etapa 16 acrescenta o host do Sentry.
 */
const EXCECOES = new Map<string, RegExp>([
  ['www.w3.org', /^\/(2000\/svg|1999\/xlink|1998\/Math\/MathML|XML\/1998\/namespace)$/],
  ['react.dev', /^\/errors\//],
  ['reactrouter.com', /^\/en\/main\//],
  ['bit.ly', /^\/wb-precache$/],
  ['github.com', /^\/ungap\//],
  ['localhost', /^$/],
]);

function arquivosDoBuild(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) return arquivosDoBuild(caminho);
    return ['.js', '.css', '.html', '.webmanifest'].includes(extname(e.name)) ? [caminho] : [];
  });
}

describe('hosts no build (G-35)', () => {
  it('nenhum literal http(s) fora da lista fechada', () => {
    const intrusos = new Set<string>();
    for (const arquivo of arquivosDoBuild(saida)) {
      for (const [, host, resto] of readFileSync(arquivo, 'utf8').matchAll(
        /https?:\/\/([a-z0-9.-]+)([^\s`'")<>]*)/gi,
      )) {
        const h = (host as string).toLowerCase();
        if (!EXCECOES.get(h)?.test(resto as string)) intrusos.add(h);
      }
    }
    expect([...intrusos]).toEqual([]);
  });
});
