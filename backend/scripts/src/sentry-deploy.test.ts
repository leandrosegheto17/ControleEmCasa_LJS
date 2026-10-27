import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { arquivosDoRepositorio } from './operacao/wrangler-deploy-unico';

/**
 * Sentry no deploy (PLANO etapa 16; SDD 11.2; G-45): release = SHA do commit publicado nos dois lados (Worker por
 * `--var SENTRY_RELEASE`, testado em `deploy-workflow.test.ts`; front por `VITE_SENTRY_RELEASE` no build) e DSN só por
 * segredo ou variável, nunca escrito no repositório.
 */
const RAIZ = join(import.meta.dirname, '../../..');
const deploy = readFileSync(join(RAIZ, '.github/workflows/deploy.yml'), 'utf8').replace(/^\s*#.*$/gm, '');

describe('deploy.yml e o Sentry do front', () => {
  it('o build do front recebe o DSN da variável do environment e o release = SHA do commit que o CI testou', () => {
    const inicio = deploy.indexOf('- name: 1. Build do front');
    const passo = deploy.slice(inicio, deploy.indexOf('- name: 2.', inicio));
    expect(passo).toMatch(/VITE_SENTRY_DSN: \$\{\{ vars\.VITE_SENTRY_DSN \}\}/);
    expect(passo).toMatch(/VITE_SENTRY_RELEASE: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
    expect(passo).toMatch(/run: pnpm --filter @controle\/web build/);
  });
});

describe('o repositório', () => {
  it('não traz DSN do Sentry escrito em lugar nenhum (só nos testes, com um DSN de exemplo)', () => {
    const DSN = /https:\/\/[0-9a-f]{16,}@o\d+\.ingest(?:\.[a-z]{2})?\.sentry\.io\/\d+/i;
    const achados = arquivosDoRepositorio(RAIZ)
      .filter((a) => !/\.(png|jpe?g|webp|ico|woff2?)$/i.test(a) && a !== 'pnpm-lock.yaml')
      .filter((a) => DSN.test(readFileSync(join(RAIZ, a), 'utf8')));
    expect(achados).toEqual([]);
  });
});
