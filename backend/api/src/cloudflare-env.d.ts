import type { Bindings } from './env';

// Tipa `env` e `exports` de `cloudflare:workers` (e dos testes) com o que o wrangler.jsonc declara.
declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends Bindings {}
    interface GlobalProps {
      mainModule: typeof import('./entrada/worker');
    }
  }
}
