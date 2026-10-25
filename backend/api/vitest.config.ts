import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const requirePg = createRequire(createRequire(import.meta.url).resolve('pg'));

// Pendência da etapa 3: sem `.dev.vars`, o wrangler carregaria o `.env` da raiz (URLs do banco com senha)
// como secrets do Worker de teste. Os testes não leem segredo de arquivo nenhum: tudo vem dos bindings abaixo.
process.env['CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV'] = 'false';

// CHAVE_HMAC dos testes: aleatória a cada execução (nunca um valor fixo no repositório).
const CHAVE_HMAC_TESTE = randomBytes(32).toString('base64url');

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
          MAIL_FROM: 'Controle em Casa <nao-responda@teste.exemplo.local>',
          CHAVE_HMAC: CHAVE_HMAC_TESTE,
          // Mesmo que um `.dev.vars` local traga a chave real, os testes nunca falam com o Resend.
          RESEND_API_KEY: '',
        },
      },
    })),
  ],
  test: {
    // Teto de arquivos em paralelo: todos dividem o MESMO Postgres, e o bcrypt de custo 12 roda nele (crypt no SQL).
    // Com a etapa 6 (mais 5 arquivos que usam o banco), o paralelismo padrão (1 por núcleo) fazia os testes de
    // acesso com bcrypt estourarem 5 s por disputa de CPU no Postgres, não por defeito. 4 mantém a suíte estável.
    maxWorkers: 4,
    // Teto por teste (etapa 8): o padrão de 5 s não cabe nos testes de isolamento por rota, que montam dois lares
    // completos e fazem dezenas de requisições no Postgres compartilhado. Medido antes desta etapa, sem nenhuma
    // mudança de código: "a vítima continua vendo..." (cadastros-isolamento, etapa 7) já levava 8,2 s nesta máquina e
    // estourava o padrão. O teto só adia a detecção de um travamento; nenhuma asserção muda.
    testTimeout: 30_000,
    globalSetup: ['./testes/banco-global.ts'],
    include: ['src/**/*.test.ts'],
  },
});
