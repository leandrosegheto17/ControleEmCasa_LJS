import type { Page } from '@playwright/test';
import { ID_USUARIO } from './apiPlano';

/**
 * Camada da conta por cima de qualquer API simulada dos outros e2e (registrada depois, ela responde primeiro e passa
 * adiante com `fallback` o que não é dela). Responde `GET /api/sessao` (com `encerramento` quando pedido) e as duas rotas
 * de exclusão conforme o critério de aceite (RN-26; CA-26.1, CA-26.2, CA-26.9): o pedido exige a senha certa; o link
 * vale uma vez; nada é excluído antes da confirmação.
 */

export const SENHA_CERTA = 'senha-certa-12345';
export const TOKEN_VALIDO = 'token-de-exclusao-e2e';

export interface EscritaConta {
  metodo: string;
  url: string;
  corpo: unknown;
  cabecalhos: Record<string, string>;
}

const json = (corpo: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(corpo),
});

export interface OpcoesConta {
  papel?: 'titular' | 'membro';
  logado?: boolean;
  encerramento?: { purga_em: string };
}

export async function simularConta(page: Page, opcoes: OpcoesConta = {}) {
  const estado = {
    logado: opcoes.logado ?? true,
    pedidos: 0,
    confirmadas: 0,
    excluida: false,
    tokenUsado: false,
  };
  const escritas: EscritaConta[] = [];

  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const { pathname } = new URL(pedido.url());
    const metodo = pedido.method();
    const corpo = metodo === 'GET' ? undefined : (pedido.postDataJSON() as Record<string, unknown> | null);

    if (pathname === '/api/sessao' && metodo === 'GET') {
      if (!estado.logado) return rota.fulfill(json({ code: 'sessao_expirada', message: 'x' }, 401));
      return rota.fulfill(
        json({
          usuario: { id: ID_USUARIO, nome: 'Ana', email: 'ana@exemplo.com' },
          membro: { id: ID_USUARIO, nome: 'Ana', papel: opcoes.papel ?? 'titular' },
          lar: { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' },
          plano: 'pro',
          termos_pendentes: false,
          ...(opcoes.encerramento ? { encerramento: opcoes.encerramento } : {}),
        }),
      );
    }
    if (pathname === '/api/conta/exclusao' && metodo === 'POST') {
      escritas.push({ metodo, url: pathname, corpo, cabecalhos: pedido.headers() });
      if (corpo?.senha !== SENHA_CERTA) {
        return rota.fulfill(json({ code: 'credenciais_invalidas', message: 'x' }, 400));
      }
      estado.pedidos += 1;
      return rota.fulfill({ status: 202 });
    }
    if (pathname === '/api/conta/exclusao/confirmar' && metodo === 'POST') {
      escritas.push({ metodo, url: pathname, corpo, cabecalhos: pedido.headers() });
      if (corpo?.token !== TOKEN_VALIDO || estado.tokenUsado) {
        return rota.fulfill(json({ code: 'link_expirado', message: 'x' }, 400));
      }
      estado.tokenUsado = true;
      estado.excluida = true;
      estado.logado = false;
      estado.confirmadas += 1;
      return rota.fulfill({ status: 204 });
    }
    return rota.fallback();
  });

  return { estado, escritas };
}
