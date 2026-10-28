import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Os e2e críticos da pilha real (PLANO etapa 16: cadastro, login, assinar e lançar) rodam no CI, com Postgres 18 e o
 * mesmo teto de workers dos outros e2e.
 */
const WEB = join(import.meta.dirname, '..');
const ler = (caminho: string) => readFileSync(join(WEB, caminho), 'utf8');
const ci = ler('../../.github/workflows/ci.yml').replace(/^\s*#.*$/gm, '');

describe('e2e da pilha real', () => {
  it('o script constrói o front e roda o Playwright com a configuração da pilha', () => {
    const pacote = JSON.parse(ler('package.json')) as { scripts: Record<string, string> };
    expect(pacote.scripts['e2e:pilha']).toBe('vite build && playwright test -c playwright.pilha.config.ts');
  });

  it('a configuração sobe a pilha no globalSetup e limita os workers a 2', () => {
    const config = ler('playwright.pilha.config.ts');
    expect(config).toMatch(/testDir: 'e2e-pilha'/);
    expect(config).toMatch(/workers: 2,/);
    expect(config).toMatch(/globalSetup: '\.\/e2e-pilha\/global\.ts'/);
  });

  it('cobre cadastro, login, assinar e lançar', () => {
    const spec = ler('e2e-pilha/criticos.spec.ts');
    for (const passo of ["name: 'Criar conta'", "name: 'Entrar'", "name: 'Assinar o Pro'", "name: 'Lançar R$ 45,90'"]) {
      expect(spec).toContain(passo);
    }
  });

  it('o CI tem o job e2e-pilha com Postgres 18, as roles locais e o script', () => {
    const inicio = ci.indexOf('  e2e-pilha:');
    expect(inicio).toBeGreaterThan(-1);
    const job = ci.slice(inicio, ci.indexOf('\n  gitleaks:'));
    // Alterado no padrão do Neon (ADR-017, decisão 2, aprovada pelo usuário em 2026-10-28): tag postgres:18.
    expect(job).toMatch(/image: postgres:18\s*\n/);
    expect(job).toMatch(/-f backend\/scripts\/init-local\.sql/);
    expect(job).toMatch(/playwright install --with-deps chromium/);
    expect(job).toMatch(/run: pnpm --filter @controle\/web e2e:pilha/);
    expect(job).not.toMatch(/continue-on-error/);
  });

  it('o mesmo job mede o Lighthouse PWA depois do build dos e2e', () => {
    const job = ci.slice(ci.indexOf('  e2e-pilha:'), ci.indexOf('\n  gitleaks:'));
    expect(job).toMatch(/run: pnpm --filter @controle\/web run lighthouse/);
    expect(job.indexOf('run lighthouse')).toBeGreaterThan(job.indexOf('e2e:pilha'));
  });
});
