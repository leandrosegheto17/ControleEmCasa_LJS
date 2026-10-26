// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it, vi } from 'vitest';

/**
 * As regras do front no `eslint.config.mjs` da raiz, provadas com código de violação (GUARDRAILS G-36, G-37;
 * SDD 9.1 e 9.2). O caminho do arquivo fictício decide a camada; os imports apontam para arquivos reais.
 */
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const SRC = 'frontend/web/src';
const eslint = new ESLint({ cwd: RAIZ });

// A primeira an�lise carrega a configura��o inteira (resolvedor de TypeScript): pode passar de 5 s.
vi.setConfig({ testTimeout: 60_000 });

async function regrasVioladas(arquivo: string, codigo: string): Promise<string[]> {
  const [resultado] = await eslint.lintText(codigo, { filePath: `${RAIZ}${SRC}/${arquivo}` });
  return (resultado?.messages ?? []).map((m) => m.ruleId ?? 'erro-de-sintaxe');
}

describe('G-36: texto do usuário nunca vira HTML', () => {
  it.each([
    [
      'dangerouslySetInnerHTML',
      'export const A = (p: { t: string }) => <div dangerouslySetInnerHTML={{ __html: p.t }} />;',
    ],
    ['innerHTML', 'export function f(el: HTMLElement, t: string) { el.innerHTML = t; }'],
    ['outerHTML', 'export function f(el: HTMLElement, t: string) { el.outerHTML = t; }'],
    ['insertAdjacentHTML', "export function f(el: HTMLElement, t: string) { el.insertAdjacentHTML('beforeend', t); }"],
    ['document.write', 'export function f(t: string) { document.write(t); }'],
  ])('%s é proibido', async (_nome, codigo) => {
    expect(await regrasVioladas('componentes/Violacao.tsx', codigo)).toContain('no-restricted-syntax');
  });

  it('texto comum em JSX passa', async () => {
    expect(await regrasVioladas('componentes/Ok.tsx', 'export const A = (p: { t: string }) => <p>{p.t}</p>;')).toEqual(
      [],
    );
  });
});

describe('G-37: sem import dinâmico aberto nem avaliação de código', () => {
  it('import() com variável é proibido', async () => {
    const regras = await regrasVioladas('paginas/V.ts', 'export const f = (n: string) => import(n);');
    expect(regras).toContain('no-restricted-syntax');
  });

  it('import() com template literal e variável é proibido', async () => {
    const regras = await regrasVioladas('paginas/V.ts', 'export const f = (n: string) => import(`./paginas/${n}`);');
    expect(regras).toContain('no-restricted-syntax');
  });

  it('import() com string literal (rota lazy) passa', async () => {
    expect(await regrasVioladas('paginas/Ok.ts', "export const f = () => import('./Entrar');")).toEqual([]);
  });

  it.each([
    ['eval', 'export const f = (t: string) => eval(t);', 'no-eval'],
    ['new Function', "export const f = () => new Function('return 1');", 'no-new-func'],
    ['setTimeout com texto', "export const f = () => setTimeout('alert(1)', 10);", 'no-restricted-syntax'],
    ['setTimeout com template', 'export const f = () => setTimeout(`x`, 10);', 'no-restricted-syntax'],
    ['javascript:', "export const u = 'javascript:alert(1)';", 'no-script-url'],
  ])('%s é proibido', async (_nome, codigo, regra) => {
    expect(await regrasVioladas('paginas/V.ts', codigo)).toContain(regra);
  });

  it('setTimeout com função passa', async () => {
    expect(await regrasVioladas('paginas/Ok.ts', 'export const f = () => setTimeout(() => undefined, 10);')).toEqual(
      [],
    );
  });
});

describe('camadas do front (SDD 9.1)', () => {
  it('componentes/ não importa dados/', async () => {
    const regras = await regrasVioladas(
      'componentes/V.ts',
      "import { chamar } from '../dados/transporte';\nexport const x = chamar;",
    );
    expect(regras).toContain('import-x/no-restricted-paths');
  });

  it('paginas/ não importa dados/ (só por ganchos/)', async () => {
    const regras = await regrasVioladas(
      'paginas/V.ts',
      "import { entrar } from '../dados/sessao';\nexport const x = entrar;",
    );
    expect(regras).toContain('import-x/no-restricted-paths');
  });

  it('ganchos/ importa dados/', async () => {
    const regras = await regrasVioladas(
      'ganchos/Ok.ts',
      "import { entrar } from '../dados/sessao';\nexport const x = entrar;",
    );
    expect(regras).toEqual([]);
  });

  it('dados/ não importa ganchos/ nem componentes/', async () => {
    const a = await regrasVioladas(
      'dados/V.ts',
      "import { useSessao } from '../ganchos/useSessao';\nexport const x = useSessao;",
    );
    const b = await regrasVioladas(
      'dados/V.ts',
      "import { Botao } from '../componentes/base/Botao';\nexport const x = Botao;",
    );
    expect(a).toContain('import-x/no-restricted-paths');
    expect(b).toContain('import-x/no-restricted-paths');
  });

  it('componentes/base/ não importa o resto de componentes/', async () => {
    const regras = await regrasVioladas(
      'componentes/base/V.ts',
      "import { CartaoAcesso } from '../CartaoAcesso';\nexport const x = CartaoAcesso;",
    );
    expect(regras).toContain('import-x/no-restricted-paths');
  });

  it('formatacao/ e rotulos/ só importam comum/', async () => {
    const regras = await regrasVioladas(
      'rotulos/V.ts',
      "import { chamar } from '../dados/transporte';\nexport const x = chamar;",
    );
    expect(regras).toContain('import-x/no-restricted-paths');
  });
});

describe('fetch e IndexedDB só em dados/ (SDD 9.2)', () => {
  it('fetch fora de dados/ é proibido', async () => {
    const regras = await regrasVioladas('ganchos/V.ts', "export const f = () => fetch('/api/x');");
    expect(regras).toContain('no-restricted-globals');
  });

  it('fetch em dados/ passa', async () => {
    expect(await regrasVioladas('dados/Ok.ts', "export const f = () => fetch('/api/x');")).toEqual([]);
  });

  it('idb-keyval fora de dados/ é proibido', async () => {
    const regras = await regrasVioladas('ganchos/V.ts', "import { get } from 'idb-keyval';\nexport const x = get;");
    expect(regras).toContain('no-restricted-imports');
  });

  it('idb-keyval em dados/ passa', async () => {
    expect(await regrasVioladas('dados/Ok.ts', "import { get } from 'idb-keyval';\nexport const x = get;")).toEqual([]);
  });
});

describe('fronteira de pacotes', () => {
  it('o front não importa o dominio nem a api', async () => {
    const dominio = await regrasVioladas('dados/V.ts', "import '@controle/dominio';");
    const api = await regrasVioladas('dados/V.ts', "import '@controle/api';");
    expect(dominio).toContain('no-restricted-imports');
    expect(api).toContain('no-restricted-imports');
  });
});
