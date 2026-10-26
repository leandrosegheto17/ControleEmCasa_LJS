import { defineConfig, devices } from '@playwright/test';

const porta = Number(process.env.PORTA ?? 5173);

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  // Teto de workers: em paralelo total, o servidor do Vite sobrecarregado derruba e2e que passam isolados.
  workers: 2,
  use: { baseURL: `http://127.0.0.1:${porta}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // A API é simulada com `page.route`: o e2e do front não depende do Worker nem do banco.
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${porta} --strictPort`,
    url: `http://127.0.0.1:${porta}`,
    reuseExistingServer: !process.env.CI,
  },
});
