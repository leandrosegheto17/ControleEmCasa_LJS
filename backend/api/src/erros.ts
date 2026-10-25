import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Erro esperado da API: vira `{ code, message }` com o status indicado (SDD 7). `message` nunca leva dado do usuário. */
export class ErroApi extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

const CODIGOS_DE_CONEXAO = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  '57P01',
  '57P02',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
]);

/** Banco ou Hyperdrive fora do ar (503 `indisponivel`). */
export function ehErroDeConexao(erro: unknown): boolean {
  if (!(erro instanceof Error)) return false;
  const codigo = (erro as { code?: unknown }).code;
  if (typeof codigo === 'string' && CODIGOS_DE_CONEXAO.has(codigo)) return true;
  return /connection terminated|connection timeout|timeout exceeded when trying to connect|network connection lost|connect failed|connection refused|cannot connect to the specified address/i.test(
    erro.message,
  );
}
