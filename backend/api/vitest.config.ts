import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const requirePg = createRequire(createRequire(import.meta.url).resolve('pg'));

/**
 * Testes da API rodam dentro do runtime do Workers (workerd), com Postgres real.
 * O globalSetup cria um banco descartável, migra e entrega a URL; ela vira o `localConnectionString`
 * do Hyperdrive, no lugar do valor do wrangler.jsonc (que aponta para a porta padrão).
 */
export default defineConfig({
  resolve: {
    // O `pg` faz require() de pg-protocol e pg-cloudflare. O resolvedor do pool não aplica as condições de
    // exports que o Node/workerd aplicariam: pegaria a build ESM sem `type: module` (pg-protocol) e a build
    // vazia (pg-cloudflare). Os apelidos apontam para as builds CommonJS certas.
    alias: {
      'pg-protocol': requirePg.resolve('pg-protocol'),
      'pg-cloudflare': join(dirname(requirePg.resolve('pg-cloudflare')), 'index.js'),
    },
  },
  plugins: [
    cloudflareTest(({ inject }) => ({
      wrangler: { configPath: '../../wrangler.jsonc' },
      miniflare: {
        hyperdrives: { HYPERDRIVE: inject<string>('urlBancoApp') },
        bindings: {
          AMBIENTE: 'teste',
          URL_PUBLICA: 'https://teste.exemplo.local',
        },
      },
    })),
  ],
  test: {
    globalSetup: ['./testes/banco-global.ts'],
    include: ['src/**/*.test.ts'],
  },
});
