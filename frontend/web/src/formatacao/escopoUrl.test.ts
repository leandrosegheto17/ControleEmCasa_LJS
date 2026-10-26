import { describe, expect, it } from 'vitest';
import { lerEscopoDaUrl, paraEscopoApi } from './escopoUrl';

describe('lerEscopoDaUrl', () => {
  it('lê casa e eu', () => {
    expect(lerEscopoDaUrl(new URLSearchParams('mes=2026-10&escopo=casa'))).toBe('casa');
    expect(lerEscopoDaUrl(new URLSearchParams('mes=2026-10&escopo=eu'))).toBe('eu');
  });

  it('ausente vale casa', () => {
    expect(lerEscopoDaUrl(new URLSearchParams('mes=2026-10'))).toBe('casa');
  });

  it('valor fora da lista fechada vale casa', () => {
    expect(lerEscopoDaUrl(new URLSearchParams('escopo=xyz'))).toBe('casa');
    expect(lerEscopoDaUrl(new URLSearchParams('escopo=individual'))).toBe('casa');
    expect(lerEscopoDaUrl(new URLSearchParams('escopo=EU'))).toBe('casa');
    expect(lerEscopoDaUrl(new URLSearchParams('escopo='))).toBe('casa');
  });
});

describe('paraEscopoApi', () => {
  it('casa vira conjunto e eu vira individual', () => {
    expect(paraEscopoApi('casa')).toBe('conjunto');
    expect(paraEscopoApi('eu')).toBe('individual');
  });
});
