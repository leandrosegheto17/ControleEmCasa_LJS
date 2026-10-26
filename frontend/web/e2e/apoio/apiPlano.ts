import type { Page } from '@playwright/test';

/**
 * Camada de plano por cima de qualquer API simulada dos outros e2e (`simularApiMetas`, `simularApiFixas`): registrada
 * depois, ela responde primeiro e passa adiante (`fallback`) o que não é dela. Responde `GET /api/sessao` com o plano do
 * lar, as rotas do plano e, no Free, as escritas de orçamento e metas com 403 `plano_necessario` (RN-25; CA-25.2). As
 * regras seguem o critério de aceite (RN-24; CA-24.6 a CA-24.8); os e2e com o Worker e o banco são da etapa 16.
 */

export const ID_USUARIO = '00000000-0000-4000-8000-0000000000a1';
export const PIX = '00020126580014br.gov.bcb.pix0136exemplo-pix-copia-e-cola5204000053039865802BR6304ABCD';
const QR_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export interface MeuPlano {
  plano: 'free' | 'pro';
  situacao: 'trial' | 'ativa' | 'atrasada' | 'cancelada' | 'free';
  trial_ate: string;
  periodo_ate: string | null;
  preco_centavos: number;
  sou_titular: boolean;
  cobranca?: {
    vencimento: string;
    valor_centavos: number;
    situacao: 'pendente' | 'vencida';
    pix_copia_cola: string | null;
    qr_png_base64: string | null;
  };
}

export const planoFree = (parcial: Partial<MeuPlano> = {}): MeuPlano => ({
  plano: 'free',
  situacao: 'free',
  trial_ate: '2026-09-20T15:00:00.000Z',
  periodo_ate: null,
  preco_centavos: 990,
  sou_titular: true,
  ...parcial,
});

export interface EscritaPlano {
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

/** CPF/CNPJ com os dígitos verificadores certos (a mesma regra do contrato). */
function cpfCnpjValido(texto: string): boolean {
  const d = texto.replace(/[.\-/\s]/g, '');
  if (!/^\d+$/.test(d) || (d.length !== 11 && d.length !== 14) || /^(\d)\1+$/.test(d)) return false;
  const n = [...d].map(Number);
  const dv = (nums: number[], pesos: number[]) => {
    const resto = nums.reduce((s, x, i) => s + x * pesos[i]!, 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (d.length === 11) {
    return (
      dv(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[9] &&
      dv(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[10]
    );
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return dv(n.slice(0, 12), p1) === n[12] && dv(n.slice(0, 13), [6, ...p1]) === n[13];
}

export async function simularPlano(page: Page, inicial: MeuPlano) {
  const estado = { meuPlano: inicial, pixNuloNaProxima: false };
  const escritas: EscritaPlano[] = [];

  await page.route('**/api/**', async (rota) => {
    const pedido = rota.request();
    const { pathname } = new URL(pedido.url());
    const metodo = pedido.method();
    const corpo = metodo === 'GET' ? undefined : (pedido.postDataJSON() as Record<string, unknown> | null);
    const p = estado.meuPlano;

    if (pathname === '/api/sessao' && metodo === 'GET') {
      return rota.fulfill(
        json({
          usuario: { id: ID_USUARIO, nome: 'Ana', email: 'ana@exemplo.com' },
          membro: { id: ID_USUARIO, nome: 'Ana', papel: p.sou_titular ? 'titular' : 'membro' },
          lar: { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' },
          plano: p.plano,
          termos_pendentes: false,
        }),
      );
    }
    if (pathname.startsWith('/api/plano') && metodo !== 'GET') {
      escritas.push({ metodo, url: pathname, corpo, cabecalhos: pedido.headers() });
    }
    if (pathname === '/api/plano' && metodo === 'GET') {
      // Pix nulo na próxima leitura: o Asaas não respondeu; a leitura seguinte já traz o código.
      if (estado.pixNuloNaProxima && p.cobranca) {
        estado.pixNuloNaProxima = false;
        return rota.fulfill(json({ ...p, cobranca: { ...p.cobranca, pix_copia_cola: null, qr_png_base64: null } }));
      }
      return rota.fulfill(json(p));
    }
    if (pathname === '/api/plano/assinar' && metodo === 'POST') {
      if (!p.sou_titular) return rota.fulfill(json({ code: 'registro_invalido', message: 'x' }, 404));
      if (typeof corpo?.cpf_cnpj !== 'string' || !cpfCnpjValido(corpo.cpf_cnpj)) {
        return rota.fulfill(
          json({ code: 'valor_invalido', message: 'x', campos: { cpf_cnpj: 'valor_invalido' } }, 400),
        );
      }
      if (p.situacao === 'ativa' || p.situacao === 'atrasada') {
        return rota.fulfill(json({ code: 'assinatura_ativa', message: 'x' }, 409));
      }
      estado.meuPlano = {
        ...p,
        cobranca: {
          vencimento: '2026-10-09',
          valor_centavos: p.preco_centavos,
          situacao: 'pendente',
          pix_copia_cola: estado.pixNuloNaProxima ? null : PIX,
          qr_png_base64: estado.pixNuloNaProxima ? null : QR_PNG,
        },
      };
      return rota.fulfill(json(estado.meuPlano, 201));
    }
    if (pathname === '/api/plano/cancelar' && metodo === 'POST') {
      if (!p.sou_titular) return rota.fulfill(json({ code: 'registro_invalido', message: 'x' }, 404));
      if (!p.cobranca && p.situacao !== 'ativa' && p.situacao !== 'atrasada') {
        return rota.fulfill(json({ code: 'sem_assinatura', message: 'x' }, 409));
      }
      const { cobranca: _cobranca, ...resto } = p;
      estado.meuPlano = {
        ...resto,
        situacao: 'cancelada',
        periodo_ate: p.periodo_ate ?? '2026-11-09T15:00:00.000Z',
      };
      return rota.fulfill({ status: 204 });
    }
    if (p.plano === 'free' && metodo !== 'GET' && /^\/api\/(orcamento|metas)/.test(pathname)) {
      escritas.push({ metodo, url: pathname, corpo, cabecalhos: pedido.headers() });
      return rota.fulfill(json({ code: 'plano_necessario', message: 'x' }, 403));
    }
    return rota.fallback();
  });

  return { estado, escritas };
}
