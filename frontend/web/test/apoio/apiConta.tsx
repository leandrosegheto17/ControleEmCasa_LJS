import { vi } from 'vitest';
import { criarServidor, json, responder, sessao, type Chamada, type Servidor } from './apiCadastros';

/**
 * API simulada da conta (etapa 14, lote 2), por cima da de cadastros. Responde `GET /api/sessao` com o papel e o
 * `encerramento` pedidos e as duas rotas de exclusão (RN-26; CA-26.1, CA-26.2, CA-26.9); o resto passa para `responder`.
 */

export interface ServidorConta {
  base: Servidor;
  papel: 'titular' | 'membro';
  /** `purga_em` que o convidado vê em `GET /api/sessao` (CA-26.7). */
  encerramento?: { purga_em: string };
  /** Resposta forçada para o pedido (`POST /api/conta/exclusao`). */
  pedido?: { status: number; code?: string };
  /** Resposta forçada para a confirmação. */
  confirmacao?: { status: number; code?: string };
  /** Sem rede só nas rotas de exclusão. */
  semRedeNaExclusao?: boolean;
  chamadas: Chamada[];
}

export function criarServidorConta(parcial: Partial<ServidorConta> = {}): ServidorConta {
  return { base: criarServidor(), papel: 'titular', chamadas: [], ...parcial };
}

export function instalarApiConta(s: ServidorConta): void {
  const simulado = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    const chamada = { metodo, url, corpo, cabecalhos: (init?.headers ?? {}) as Record<string, string> };
    s.chamadas.push(chamada);
    s.base.chamadas.push(chamada);

    if (url === '/api/sessao' && metodo === 'GET') {
      if (!s.base.logado) return json({ code: 'sessao_expirada', message: 'x' }, 401);
      const dados = sessao(s.base.plano ?? null);
      return json({
        ...dados,
        membro: { ...dados.membro, papel: s.papel },
        ...(s.encerramento ? { encerramento: s.encerramento } : {}),
      });
    }
    if (url.startsWith('/api/conta/exclusao')) {
      if (s.semRedeNaExclusao) throw new TypeError('Failed to fetch');
      const forcada = url.endsWith('/confirmar') ? s.confirmacao : s.pedido;
      if (forcada && forcada.status >= 400) return json({ code: forcada.code, message: 'x' }, forcada.status);
      return new Response(null, { status: url.endsWith('/confirmar') ? 204 : 202 });
    }
    return responder(s.base, metodo, url, corpo);
  });
  vi.stubGlobal('fetch', simulado);
}

export const chamadasDeExclusao = (s: ServidorConta) => s.chamadas.filter((c) => c.url.startsWith('/api/conta/'));
