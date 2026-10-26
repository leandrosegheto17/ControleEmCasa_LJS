import { app } from '../app';
import type { Bindings } from '../env';
import { criarScheduled } from './agendadas';

/** Ponto de entrada do Worker (wrangler.jsonc `main`): a API (`fetch`) e os crons (`scheduled`, etapa 15). */
export default {
  fetch: app.fetch,
  scheduled: criarScheduled(),
} satisfies ExportedHandler<Bindings>;
