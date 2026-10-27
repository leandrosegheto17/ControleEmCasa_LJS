import { app } from '../app';
import type { Bindings } from '../env';
import { comSentry } from '../observabilidade';
import { criarScheduled } from './agendadas';

/**
 * Ponto de entrada do Worker (wrangler.jsonc `main`): a API (`fetch`) e os crons (`scheduled`, etapa 15), com o Sentry
 * (etapa 16) ligado só quando há o segredo `SENTRY_DSN`.
 */
export default comSentry({
  fetch: app.fetch,
  scheduled: criarScheduled(),
}) satisfies ExportedHandler<Bindings>;
