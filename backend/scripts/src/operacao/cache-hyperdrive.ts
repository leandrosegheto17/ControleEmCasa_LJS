import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Confere, no deploy, que o cache de consultas do Hyperdrive está DESLIGADO (etapa 16; SDD 5.3; G-02 (e); R2;
 * TM-DB-02; ADR-015). Com cache ligado, a mesma consulta de dois lares diferentes (mesmo texto e parâmetros, só o GUC
 * muda) poderia devolver ao lar B o resultado do lar A. Passo do `.github/workflows/deploy.yml` ANTES da migração e
 * da publicação do Worker: falha fechado em qualquer coisa que não seja `caching.disabled === true`.
 *
 * O id do Hyperdrive vem do `wrangler.jsonc` (o mesmo que o deploy publica). O id fictício (só zeros) até a etapa 17
 * faz o passo falhar. O token da Cloudflare vem só do ambiente (`CLOUDFLARE_API_TOKEN`) e nunca vai ao log.
 */

export const API_CLOUDFLARE = 'https://api.cloudflare.com/client/v4';
const ID_VALIDO = /^[0-9a-f]{32}$/;
const TOKEN_VALIDO = /^[A-Za-z0-9_-]+$/;

/** Remove comentários `//` e `/* *\/` (fora de strings) e vírgulas finais: o JSONC do wrangler vira JSON. */
export function jsoncParaJson(texto: string): string {
  let saida = '';
  let emString = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i]!;
    if (emString) {
      saida += c;
      if (c === '\\') {
        saida += texto[i + 1] ?? '';
        i += 1;
      } else if (c === '"') emString = false;
      continue;
    }
    if (c === '"') {
      emString = true;
      saida += c;
    } else if (c === '/' && texto[i + 1] === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1;
      saida += '\n';
    } else if (c === '/' && texto[i + 1] === '*') {
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) i += 1;
      i += 1;
    } else saida += c;
  }
  return saida.replace(/,(\s*[}\]])/g, '$1');
}

/** Id do único Hyperdrive com binding HYPERDRIVE. Fictício (só zeros), ausente ou fora do formato: lança. */
export function idDoHyperdrive(wranglerJsonc: string): string {
  const config = JSON.parse(jsoncParaJson(wranglerJsonc)) as {
    hyperdrive?: Array<{ binding?: unknown; id?: unknown }>;
  };
  const lista = (config.hyperdrive ?? []).filter((h) => h.binding === 'HYPERDRIVE');
  if (lista.length !== 1) throw new Error('wrangler.jsonc sem exatamente um Hyperdrive com binding HYPERDRIVE.');
  const id = lista[0]!.id;
  if (typeof id !== 'string' || !ID_VALIDO.test(id))
    throw new Error('Id do Hyperdrive fora do formato no wrangler.jsonc.');
  if (/^0+$/.test(id))
    throw new Error('Id do Hyperdrive ainda é o fictício (só zeros): crie o de produção (etapa 17).');
  return id;
}

/** Só passa com `success === true` e `result.caching.disabled === true` (booleano). Qualquer outra coisa lança. */
export function conferirRespostaDoCache(corpo: unknown): void {
  const { success, result } = (corpo ?? {}) as { success?: unknown; result?: { caching?: { disabled?: unknown } } };
  if (success !== true) throw new Error('A API do Hyperdrive não respondeu com sucesso.');
  if (result?.caching?.disabled !== true) {
    throw new Error('Cache do Hyperdrive ligado ou ausente na resposta (G-02, TM-DB-02): desligue antes do deploy.');
  }
}

export interface OpcoesCache {
  token: string;
  conta: string;
  id: string;
  fetch?: typeof fetch;
}

export async function conferirCacheDesligado({ token, conta, id, fetch: buscar = fetch }: OpcoesCache): Promise<void> {
  if (!TOKEN_VALIDO.test(token)) throw new Error('CLOUDFLARE_API_TOKEN ausente ou fora do formato.');
  if (!ID_VALIDO.test(conta)) throw new Error('CLOUDFLARE_ACCOUNT_ID ausente ou fora do formato.');
  if (!ID_VALIDO.test(id)) throw new Error('Id do Hyperdrive fora do formato.');
  const resposta = await buscar(`${API_CLOUDFLARE}/accounts/${conta}/hyperdrive/configs/${id}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!resposta.ok) throw new Error(`A API do Hyperdrive respondeu ${resposta.status}.`);
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    throw new Error('Resposta da API do Hyperdrive não é JSON.');
  }
  conferirRespostaDoCache(corpo);
}

const WRANGLER = join(import.meta.dirname, '../../../../wrangler.jsonc');

export async function main(
  ambiente: NodeJS.ProcessEnv = process.env,
  buscar: typeof fetch = fetch,
  wranglerJsonc: () => string = () => readFileSync(WRANGLER, 'utf8'),
): Promise<number> {
  try {
    await conferirCacheDesligado({
      token: ambiente['CLOUDFLARE_API_TOKEN'] ?? '',
      conta: ambiente['CLOUDFLARE_ACCOUNT_ID'] ?? '',
      id: idDoHyperdrive(wranglerJsonc()),
      fetch: buscar,
    });
    console.info('Cache do Hyperdrive desligado.');
    return 0;
  } catch (erro) {
    console.error((erro as Error).message);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await main();
}
