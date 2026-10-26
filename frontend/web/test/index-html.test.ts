import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('index.html', () => {
  it('declara o idioma pt-BR', () => {
    expect(html).toMatch(/<html[^>]*\blang="pt-BR"/);
  });

  it('tem o título Controle em Casa e o viewport com viewport-fit=cover', () => {
    expect(html).toContain('<title>Controle em Casa</title>');
    expect(html).toMatch(/<meta name="viewport"[^>]*viewport-fit=cover/);
  });

  it('não carrega script nem fonte de fora', () => {
    expect(html).not.toMatch(/<script[^>]+src="https?:\/\//);
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });

  it('não tem script nem estilo embutido (a CSP não libera unsafe-inline)', () => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style/);
  });
});
