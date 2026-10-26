import { cpfCnpjValido, type SaidaMeuPlano } from '@controle/contrato';
import { vi } from 'vitest';
import { json, semCorpo } from './apiCadastros';
import { atender } from './apiLancamentos';
import { atenderFixas } from './apiFixas';
import { atenderMetas, criarServidorMetas, type ServidorMetas } from './apiMetas';

/**
 * API simulada do plano (etapa 13, lote 2), por cima da das metas, das fixas e do orçamento. As regras seguem o critério
 * de aceite do PRD-TECNICO (RN-24, RN-25; CA-24.6, CA-24.7, CA-24.8, CA-24.11): só o titular assina e cancela (o
 * convidado recebe `registro_invalido`); CPF/CNPJ com dígito errado é `valor_invalido`; assinatura ativa ou atrasada
 * recusa assinar com `assinatura_ativa`; sem assinatura, cancelar é `sem_assinatura`; no Free as escritas de orçamento e
 * metas são `plano_necessario`. O CPF/CNPJ só é conferido, nunca guardado.
 */

export interface ServidorPlano extends ServidorMetas {
  meuPlano: SaidaMeuPlano;
  /** Corpos recebidos em `POST /api/plano/assinar` (para conferir o que viaja). */
  assinaturasPedidas: Array<{ cpf_cnpj: unknown }>;
  /** Só as rotas do plano ficam sem rede (o resto do app responde). */
  semRedePlano?: boolean;
}

const PIX = '00020126580014br.gov.bcb.pix0136exemplo-pix-copia-e-cola5204000053039865802BR6304ABCD';
const QR = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export const planoFree = (parcial: Partial<SaidaMeuPlano> = {}): SaidaMeuPlano => ({
  plano: 'free',
  situacao: 'free',
  trial_ate: '2026-09-20T15:00:00.000Z',
  periodo_ate: null,
  preco_centavos: 990,
  sou_titular: true,
  ...parcial,
});

export const planoTrial = (parcial: Partial<SaidaMeuPlano> = {}): SaidaMeuPlano => ({
  plano: 'pro',
  situacao: 'trial',
  trial_ate: '2026-10-23T15:00:00.000Z',
  periodo_ate: null,
  preco_centavos: 990,
  sou_titular: true,
  ...parcial,
});

export function criarServidorPlano(parcial: Partial<ServidorPlano> = {}): ServidorPlano {
  const base = criarServidorMetas();
  const meuPlano = parcial.meuPlano ?? planoTrial();
  return { ...base, plano: meuPlano.plano, meuPlano, assinaturasPedidas: [], ...parcial };
}

const registroInvalido = () => json({ code: 'registro_invalido', message: 'x' }, 404);
const hojeSp = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

const ESCRITA_PRO = [
  /^PUT \/api\/orcamento\//,
  /^POST \/api\/orcamento\//,
  /^PUT \/api\/metas\//,
  /^POST \/api\/metas\//,
];

async function atenderPlano(s: ServidorPlano, metodo: string, url: string, corpo: Record<string, unknown> | undefined) {
  const caminho = new URL(url, 'http://x').pathname;
  const chave = `${metodo} ${caminho}`;
  const atraso = s.atrasos.get(chave);
  if (atraso) await new Promise((resolver) => setTimeout(resolver, atraso));
  const falha = s.falhas.get(chave);
  if (falha) return json({ code: falha.code, message: 'x' }, falha.status);

  if (s.meuPlano.plano === 'free' && ESCRITA_PRO.some((r) => r.test(chave))) {
    return json({ code: 'plano_necessario', message: 'x' }, 403);
  }
  if (chave === 'GET /api/plano') return json(s.meuPlano);

  if (chave === 'POST /api/plano/assinar') {
    s.assinaturasPedidas.push({ cpf_cnpj: corpo?.cpf_cnpj });
    const p = s.meuPlano;
    if (!p.sou_titular) return registroInvalido();
    if (typeof corpo?.cpf_cnpj !== 'string' || !cpfCnpjValido(corpo.cpf_cnpj)) {
      return json({ code: 'valor_invalido', message: 'x', campos: { cpf_cnpj: 'valor_invalido' } }, 400);
    }
    if (p.situacao === 'ativa' || p.situacao === 'atrasada')
      return json({ code: 'assinatura_ativa', message: 'x' }, 409);
    s.meuPlano = {
      ...p,
      cobranca: {
        vencimento: hojeSp(),
        valor_centavos: p.preco_centavos,
        situacao: 'pendente',
        pix_copia_cola: PIX,
        qr_png_base64: QR,
      },
    };
    return json(s.meuPlano, 201);
  }

  if (chave === 'POST /api/plano/cancelar') {
    const p = s.meuPlano;
    if (!p.sou_titular) return registroInvalido();
    if (!p.cobranca && p.situacao !== 'ativa' && p.situacao !== 'atrasada') {
      return json({ code: 'sem_assinatura', message: 'x' }, 409);
    }
    const { cobranca: _cobranca, ...resto } = p;
    s.meuPlano = {
      ...resto,
      situacao: 'cancelada',
      periodo_ate: p.situacao === 'ativa' ? (p.periodo_ate ?? '2026-11-09T15:00:00.000Z') : p.periodo_ate,
    };
    return semCorpo();
  }
  return undefined;
}

/** Troca o `fetch` global pelo simulado. Quem chama desfaz com `vi.unstubAllGlobals()`. */
export function instalarApiPlano(s: ServidorPlano): void {
  const simulado = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    const corpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    s.chamadas.push({ metodo, url, corpo, cabecalhos: (init?.headers ?? {}) as Record<string, string> });
    if (s.semRede || (s.semRedePlano && url.startsWith('/api/plano'))) throw new TypeError('Failed to fetch');
    return (
      (await atenderPlano(s, metodo, url, corpo)) ??
      (await atenderMetas(s, metodo, url, corpo)) ??
      (await atenderFixas(s, metodo, url, corpo)) ??
      (await atender(s, metodo, url, corpo))
    );
  });
  vi.stubGlobal('fetch', simulado);
}

/** Pré-aquece as telas por `lazy` deste lote. */
export const preAquecerPlano = () =>
  Promise.all([
    import('@controle/contrato'),
    import('../../src/paginas/MeuPlano'),
    import('../../src/paginas/Metas'),
    import('../../src/paginas/Meta'),
    import('../../src/paginas/MetaFormulario'),
    import('../../src/paginas/Orcamento'),
    import('../../src/paginas/Ajustes'),
  ]);

export { PIX as PIX_DE_TESTE };
