import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jsoncParaJson } from './cache-hyperdrive';

/** Domínio custom do Worker (PLANO etapa 17; ADR-015): uma rota só, custom_domain, o mesmo host do URL_PUBLICA do deploy. */
const RAIZ = join(import.meta.dirname, '../../../..');
const HOST = 'controleemcasa.ljssoftware.com.br';
const config = JSON.parse(jsoncParaJson(readFileSync(join(RAIZ, 'wrangler.jsonc'), 'utf8'))) as {
  routes?: Array<{ pattern?: string; custom_domain?: boolean }>;
  hyperdrive?: Array<{ binding?: string; id?: string; localConnectionString?: string }>;
};

describe('wrangler.jsonc: Hyperdrive de produção', () => {
  it('o binding HYPERDRIVE tem um id real (32 hex, não só zeros) e o localConnectionString continua local', () => {
    expect(config.hyperdrive).toHaveLength(1);
    const [h] = config.hyperdrive!;
    expect(h!.binding).toBe('HYPERDRIVE');
    expect(h!.id).toMatch(/^[0-9a-f]{32}$/);
    expect(h!.id).not.toMatch(/^0+$/);
    expect(h!.localConnectionString).toMatch(/@localhost:\d+\//);
  });
});

describe('wrangler.jsonc: domínio custom', () => {
  it('tem exatamente uma rota, custom_domain true, no host de produção e sem curinga', () => {
    expect(config.routes).toEqual([{ pattern: HOST, custom_domain: true }]);
    for (const r of config.routes ?? []) expect(r.pattern).not.toContain('*');
  });

  it('o URL_PUBLICA injetado no deploy.yml bate com o host da rota', () => {
    const yml = readFileSync(join(RAIZ, '.github/workflows/deploy.yml'), 'utf8');
    const url = /^\s*URL_PUBLICA: (\S+)$/m.exec(yml)?.[1];
    expect(url).toBe(`https://${config.routes![0]!.pattern}`);
  });
});
