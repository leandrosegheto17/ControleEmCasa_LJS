// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { avaliarNotas, CAMINHOS_MEDIDOS, META_PWA, notasDoRelatorio } from './lighthouse.mjs';

/**
 * Lighthouse PWA ≥ 90 (PLANO etapa 16). A categoria PWA saiu do Lighthouse na versão 12.0.0 (changelog oficial,
 * 2024-04-22); a medição usa a 11.7.1, a última que a tem, fixada sem `^`.
 */

const relatorio = (pwa, extra = {}) => ({
  categories: {
    ...(pwa === undefined ? {} : { pwa: { score: pwa } }),
    performance: { score: 0.564 },
    accessibility: { score: 1 },
    ...extra,
  },
});

describe('notasDoRelatorio', () => {
  it('converte as notas de 0 a 1 para 0 a 100, arredondando', () => {
    expect(notasDoRelatorio(relatorio(0.995))).toEqual({ pwa: 100, performance: 56, accessibility: 100 });
  });

  it('categoria sem nota (erro do Lighthouse) vira null', () => {
    expect(notasDoRelatorio(relatorio(null))).toMatchObject({ pwa: null });
  });
});

describe('avaliarNotas', () => {
  it('meta é 90 na categoria PWA', () => {
    expect(META_PWA).toBe(90);
  });

  it('passa com PWA ≥ 90 em todos os caminhos', () => {
    const r = avaliarNotas([
      { caminho: '/', notas: { pwa: 90, performance: 40 } },
      { caminho: '/app/', notas: { pwa: 100 } },
    ]);
    expect(r).toEqual({ ok: true, falhas: [] });
  });

  it('falha com PWA abaixo de 90, sem nota ou sem a categoria, dizendo o caminho', () => {
    const r = avaliarNotas([
      { caminho: '/', notas: { pwa: 89 } },
      { caminho: '/app/', notas: { pwa: null } },
      { caminho: '/entrar', notas: { performance: 100 } },
    ]);
    expect(r.ok).toBe(false);
    expect(r.falhas).toEqual([
      expect.stringContaining('/: PWA 89'),
      expect.stringContaining('/app/: PWA sem nota'),
      expect.stringContaining('/entrar: PWA sem nota'),
    ]);
  });

  it('nenhuma medição não passa', () => {
    expect(avaliarNotas([]).ok).toBe(false);
  });
});

describe('configuração', () => {
  it('mede a landing e o início do app (start_url do manifesto)', () => {
    expect(CAMINHOS_MEDIDOS).toEqual(['/', '/app/']);
  });

  it('o Lighthouse fica fixado na 11.7.1 (a 12 removeu a categoria PWA)', () => {
    const pacote = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pacote.devDependencies.lighthouse).toBe('11.7.1');
    expect(pacote.scripts.lighthouse).toBe('node scripts/lighthouse.mjs');
  });
});
