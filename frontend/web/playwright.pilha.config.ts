import { defineConfig, devices } from '@playwright/test';
import { URL_PILHA } from './e2e-pilha/apoio/pilha';

/**
 * e2e críticos contra a pilha real (etapa 16): Worker no `wrangler dev` + Postgres 18 + Asaas simulado
 * (`e2e-pilha/global.ts`). Precisa do front construído e do Postgres no ar: `pnpm --filter @controle/web e2e:pilha`.
 * Os e2e com a API simulada (`e2e/`, `playwright.config.ts`) continuam separados e não precisam de banco.
 */
export default defineConfig({
  testDir: 'e2e-pilha',
  testMatch: '**/*.spec.ts',
  // Mesmo teto dos outros e2e: o Worker local e o Postgres dividem a máquina.
  workers: 2,
  globalSetup: './e2e-pilha/global.ts',
  use: { baseURL: URL_PILHA, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
