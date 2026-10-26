// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lerToken } from './lerToken.mjs';

const TOKENS = readFileSync(new URL('../src/estilo/tokens.css', import.meta.url), 'utf8');

describe('lerToken', () => {
  it('extrai --cor-fundo de tokens.css', () => {
    expect(lerToken(TOKENS, '--cor-fundo')).toBe('#10141A');
  });

  it('lê de um CSS qualquer, ignorando espaços', () => {
    expect(lerToken(':root {\n  --cor-x:   #ABCDEF ;\n}', '--cor-x')).toBe('#ABCDEF');
  });

  it('não confunde nome com prefixo de outro', () => {
    expect(lerToken(':root { --cor-fundo-2: #111111; --cor-fundo: #222222; }', '--cor-fundo')).toBe('#222222');
  });

  it('nome inexistente lança', () => {
    expect(() => lerToken(TOKENS, '--nao-existe')).toThrow();
  });
});
