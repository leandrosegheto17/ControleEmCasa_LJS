import {
  ErroAsaas,
  type ClienteAsaas,
  type CobrancaAsaas,
  type NovaAssinaturaAsaas,
  type NovoClienteAsaas,
  type PixAsaas,
} from './tipos';

/**
 * Cliente REST do Asaas via `fetch`, sem SDK (SDD 1 e 2.2; decisão 4 do PLANO). Cabeçalho `access_token` (não
 * `Authorization`) e `User-Agent` (obrigatório nas contas novas; pesquisa da etapa 13). Nunca lê nem repassa o corpo
 * de uma resposta de erro: pode ecoar o CPF/CNPJ ou o e-mail enviados.
 */
export interface OpcoesAsaas {
  /** `ASAAS_API_URL` (sandbox ou produção), sem barra no fim, com o `/v3`. */
  urlBase: string;
  /** `ASAAS_API_KEY` (segredo). */
  chaveApi: string;
  /** Injetável nos testes; por padrão o `fetch` global do Worker. */
  fetch?: typeof fetch;
  /** Tempo máximo de cada chamada. */
  tempoLimiteMs?: number;
}

export const USER_AGENT_ASAAS = 'controle-em-casa/1.0';

const TEMPO_LIMITE_PADRAO_MS = 10_000;

/** Centavos inteiros para o valor em reais que o Asaas espera (990 → 9.9). */
export function paraReais(centavos: number): number {
  return Math.round(centavos) / 100;
}

/** Reais do Asaas para centavos inteiros (9.9 → 990). */
export function paraCentavos(reais: number): number {
  return Math.round(reais * 100);
}

type Json = Record<string, unknown>;

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function lerCobranca(bruto: unknown): CobrancaAsaas {
  const o = (bruto ?? {}) as Json;
  const id = texto(o['id']);
  const vencimento = texto(o['dueDate']);
  const valor = o['value'];
  const status = texto(o['status']);
  if (!id || !vencimento || !/^\d{4}-\d{2}-\d{2}$/.test(vencimento) || typeof valor !== 'number' || !status) {
    throw new ErroAsaas('resposta');
  }
  return {
    id,
    assinaturaId: texto(o['subscription']),
    clienteId: texto(o['customer']),
    vencimento,
    valorCentavos: paraCentavos(valor),
    // Cobrança removida continua consultável com `deleted: true`: vale como removida, seja qual for o status.
    status: o['deleted'] === true ? 'DELETED' : status,
  };
}

export function criarClienteAsaas(opcoes: OpcoesAsaas): ClienteAsaas {
  const enviar = opcoes.fetch ?? ((entrada, init) => fetch(entrada, init));
  const tempoLimite = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;

  async function chamar(
    metodo: 'GET' | 'POST' | 'DELETE',
    caminho: string,
    corpo?: Json,
    aceitar404 = false,
  ): Promise<Json | null> {
    let resposta: Response;
    try {
      resposta = await enviar(`${opcoes.urlBase}${caminho}`, {
        method: metodo,
        headers: {
          access_token: opcoes.chaveApi,
          'User-Agent': USER_AGENT_ASAAS,
          Accept: 'application/json',
          ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(tempoLimite),
      });
    } catch {
      throw new ErroAsaas('rede');
    }
    if (aceitar404 && resposta.status === 404) {
      await resposta.body?.cancel();
      return null;
    }
    if (!resposta.ok) {
      await resposta.body?.cancel();
      throw new ErroAsaas('http', resposta.status);
    }
    try {
      return (await resposta.json()) as Json;
    } catch {
      throw new ErroAsaas('resposta');
    }
  }

  const exigirId = (o: Json | null): { id: string } => {
    const id = texto(o?.['id']);
    if (!id) throw new ErroAsaas('resposta');
    return { id };
  };

  return {
    async criarCliente(d: NovoClienteAsaas) {
      return exigirId(
        await chamar('POST', '/customers', {
          name: d.nome,
          email: d.email,
          cpfCnpj: d.cpfCnpj,
          externalReference: d.referenciaExterna,
          // Os avisos de cobrança saem pelo nosso e-mail (RN-24), não pelo do Asaas.
          notificationDisabled: true,
        }),
      );
    },

    async criarAssinatura(d: NovaAssinaturaAsaas) {
      return exigirId(
        await chamar('POST', '/subscriptions', {
          customer: d.clienteId,
          billingType: 'PIX',
          value: paraReais(d.valorCentavos),
          nextDueDate: d.vencimento,
          cycle: 'MONTHLY',
          description: d.descricao,
          externalReference: d.referenciaExterna,
        }),
      );
    },

    async listarCobrancasDaAssinatura(assinaturaId: string) {
      const r = await chamar('GET', `/subscriptions/${encodeURIComponent(assinaturaId)}/payments?limit=100`);
      const dados = r?.['data'];
      if (!Array.isArray(dados)) throw new ErroAsaas('resposta');
      return dados.map(lerCobranca);
    },

    async buscarCobranca(cobrancaId: string) {
      const r = await chamar('GET', `/payments/${encodeURIComponent(cobrancaId)}`, undefined, true);
      return r ? lerCobranca(r) : null;
    },

    async buscarPix(cobrancaId: string): Promise<PixAsaas> {
      const r = await chamar('GET', `/payments/${encodeURIComponent(cobrancaId)}/pixQrCode`);
      const copiaCola = texto(r?.['payload']);
      const qr = texto(r?.['encodedImage']);
      if (!copiaCola || !qr) throw new ErroAsaas('resposta');
      return { copiaCola, qrPngBase64: qr, expiraEm: texto(r?.['expirationDate']) };
    },

    async cancelarAssinatura(assinaturaId: string) {
      const r = await chamar('DELETE', `/subscriptions/${encodeURIComponent(assinaturaId)}`, undefined, true);
      return r ? 'cancelada' : 'inexistente';
    },
  };
}
