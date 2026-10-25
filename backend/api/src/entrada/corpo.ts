import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from '../env';
import { ErroApi } from '../erros';

/**
 * Lê o corpo JSON e valida com o schema do contrato (SDD 5.1 passo 10): falha → 400 `valor_invalido`, com
 * `campos` levando só o caminho e o código do problema, nunca o valor recebido (SDD 7).
 */
export async function lerCorpo<S extends z.ZodType>(c: Context<AppEnv>, schema: S): Promise<z.output<S>> {
  let bruto: unknown;
  try {
    bruto = await c.req.json();
  } catch {
    throw new ErroApi(400, 'valor_invalido', 'Corpo da requisição inválido.');
  }
  const r = schema.safeParse(bruto);
  if (!r.success) {
    const campos: Record<string, string> = {};
    for (const problema of r.error.issues) campos[problema.path.join('.') || '_'] = problema.code;
    throw new ErroApi(400, 'valor_invalido', 'Dados inválidos.', campos);
  }
  return r.data;
}
