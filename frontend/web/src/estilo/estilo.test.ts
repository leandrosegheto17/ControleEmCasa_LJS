// @vitest-environment node
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ESTILO = new URL('./', import.meta.url);

function sha256(url: URL): string {
  return createHash('sha256').update(readFileSync(url)).digest('hex');
}

// SPEC_DEVIATION: o repositório não traz o mockup do legado (`.md/mockup/`); as fontes e a licença copiadas
// do legado ficam travadas por hash em vez de comparadas ao mockup.
const HASH_FONTES: Record<string, string> = {
  'ibm-plex-mono-500.woff2': '01d285447409c8a588692162439a038b8cbd7871309ee20267b0d2d91c6e8e22',
  'ibm-plex-mono-600.woff2': '0d1f0b8d0722224e32e9f28261bdc86c79115be73444ae5eceb73976a1bcdf83',
  'ibm-plex-sans-400.woff2': 'e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470',
  'ibm-plex-sans-500.woff2': 'e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470',
  'ibm-plex-sans-600.woff2': 'e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470',
  'ibm-plex-sans-700.woff2': 'e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470',
};

describe('fontes locais', () => {
  const tokens = readFileSync(new URL('tokens.css', ESTILO), 'utf8');

  it('as fontes .woff2 são exatamente as esperadas e não foram alteradas', () => {
    const presentes = readdirSync(new URL('fontes/', ESTILO))
      .filter((n) => n.endsWith('.woff2'))
      .sort();
    expect(presentes).toEqual(Object.keys(HASH_FONTES).sort());
    for (const [nome, hash] of Object.entries(HASH_FONTES)) {
      expect(sha256(new URL(`fontes/${nome}`, ESTILO)), nome).toBe(hash);
    }
  });

  it('o tokens.css referencia cada fonte e nenhuma fonte externa', () => {
    for (const nome of Object.keys(HASH_FONTES)) expect(tokens, nome).toContain(`fontes/${nome}`);
    expect(tokens).not.toMatch(/https?:\/\//);
  });

  it('a licença OFL acompanha as fontes', () => {
    expect(sha256(new URL('fontes/LICENSE-OFL.txt', ESTILO))).toBe(
      'c5d60c5ecdad00bae2814b0e8b820bc1de4a8b35f15374bb0995052a87520f16',
    );
  });
});

describe('global.css', () => {
  const css = readFileSync(new URL('global.css', ESTILO), 'utf8');

  it('não tem prefers-color-scheme', () => {
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('não tem @import nem fonte externa', () => {
    expect(css).not.toMatch(/@import/);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('traz as regras da seção Base do mockup', () => {
    for (const seletor of [
      ':focus-visible',
      '.visualmente-oculto',
      '.icone',
      '.valor',
      '.texto-2',
      '.pequeno',
      'html.com-folha',
    ]) {
      expect(css, seletor).toContain(seletor);
    }
  });
});

describe('global.css com a folha aberta', () => {
  it('limita a altura da página atrás dela (#raiz) à da tela', () => {
    const css = readFileSync(new URL('global.css', ESTILO), 'utf8');
    expect(css).toMatch(/html\.com-folha #raiz\s*\{[^}]*max-height: 100%[^}]*overflow: hidden/);
  });
});
