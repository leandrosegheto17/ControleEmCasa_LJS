import { CODIGOS_ERRO, type CodigoErro, type ErroDados } from '../comum/erros';

export type { ErroDados } from '../comum/erros';

function ehCodigo(valor: unknown): valor is CodigoErro {
  return typeof valor === 'string' && (CODIGOS_ERRO as readonly string[]).includes(valor);
}

function codigoDoCorpo(corpo: unknown): unknown {
  return typeof corpo === 'object' && corpo !== null ? (corpo as { code?: unknown }).code : undefined;
}

/**
 * Converte a resposta de erro da API em `ErroDados` (SDD 9.2). Nunca devolve texto do servidor: a mensagem é da tela.
 * - 401 ou `sessao_expirada` → `autenticacao`;
 * - `code` conhecido → `regra` (inclusive `muitas_requisicoes` e `muitas_tentativas`, que têm texto próprio);
 * - 429 sem código reconhecido e 5xx → `indisponivel`;
 * - o resto → `desconhecido`.
 */
export function traduzirResposta(status: number, corpo: unknown): ErroDados {
  const codigo = codigoDoCorpo(corpo);
  if (status === 401 || codigo === 'sessao_expirada') return { tipo: 'autenticacao' };
  // 503 do servidor (Asaas ou banco fora do ar): o mesmo `indisponivel` de sempre, não uma regra.
  if (codigo === 'indisponivel' && status >= 500) return { tipo: 'indisponivel' };
  if (ehCodigo(codigo)) return { tipo: 'regra', codigo };
  if (status === 429 || status >= 500) return { tipo: 'indisponivel' };
  return { tipo: 'desconhecido' };
}

/** Falha antes de haver resposta: sem rede, DNS, ou o prazo de 10 s estourado. */
export function traduzirFalhaDeEnvio(e: unknown): ErroDados {
  if (e instanceof TypeError) return { tipo: 'rede' };
  if (typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError') return { tipo: 'rede' };
  if (typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'TimeoutError') return { tipo: 'rede' };
  return { tipo: 'desconhecido' };
}

/** `true` se o valor lançado já é um `ErroDados` (os módulos de `dados/` só lançam esse formato). */
export function ehErroDados(e: unknown): e is ErroDados {
  const tipo = (e as { tipo?: unknown } | null)?.tipo;
  return (
    tipo === 'rede' ||
    tipo === 'indisponivel' ||
    tipo === 'autenticacao' ||
    tipo === 'desconhecido' ||
    (tipo === 'regra' && ehCodigo((e as { codigo?: unknown }).codigo))
  );
}
