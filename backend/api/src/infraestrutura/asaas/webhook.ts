import type { EventoAsaas } from './tipos';

/** Cabeçalho em que o Asaas manda o token configurado no webhook (32 a 255 caracteres). */
export const CABECALHO_TOKEN_WEBHOOK = 'asaas-access-token';

const codificador = new TextEncoder();

async function resumo(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', codificador.encode(texto)));
}

/**
 * Confere o token do webhook em tempo constante (G-28; TM-ASA-01): compara os SHA-256 dos dois textos byte a byte,
 * sem parar no primeiro diferente. O tempo não depende do tamanho nem do conteúdo do token recebido.
 * Token esperado vazio (segredo ausente) nunca confere.
 */
export async function verificarWebhook(req: Request, tokenEsperado: string): Promise<boolean> {
  const recebido = req.headers.get(CABECALHO_TOKEN_WEBHOOK) ?? '';
  const [a, b] = await Promise.all([resumo(recebido), resumo(tokenEsperado)]);
  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) diferenca |= (a[i] as number) ^ (b[i] as number);
  return diferenca === 0 && tokenEsperado.length > 0 && recebido.length > 0;
}

const DATA_ASAAS = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

/**
 * `dateCreated` do Asaas ("AAAA-MM-DD HH:MM:SS", sem fuso). PREMISSA: horário de Brasília (UTC−3, sem horário de
 * verão desde 2019); a pesquisa da etapa 13 não confirmou o fuso. Com fuso explícito (ISO), vale o informado.
 */
export function lerDataAsaas(texto: string): Date | null {
  const m = DATA_ASAAS.exec(texto);
  const d = m
    ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}-03:00`)
    : /[zZ]|[+-]\d{2}:\d{2}$/.test(texto)
      ? new Date(texto)
      : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function textoCurto(v: unknown, maximo: number): string | null {
  return typeof v === 'string' && v.length > 0 && v.length <= maximo ? v : null;
}

/**
 * Lê o corpo do webhook (SDD 8.5): `id` do evento (chave de idempotência), `event`, `dateCreated` e os ids da
 * cobrança (`payment.id`, `payment.subscription`) ou da assinatura (`subscription.id`). Nada do pagador sai daqui.
 * Formato inválido → nulo.
 */
export function lerEvento(corpo: unknown): EventoAsaas | null {
  if (!corpo || typeof corpo !== 'object') return null;
  const o = corpo as Record<string, unknown>;
  const id = textoCurto(o['id'], 100);
  const tipo = textoCurto(o['event'], 60);
  const data = textoCurto(o['dateCreated'], 40);
  const ocorridoEm = data ? lerDataAsaas(data) : null;
  if (!id || !tipo || !ocorridoEm) return null;
  const pagamento = (o['payment'] ?? null) as Record<string, unknown> | null;
  const assinatura = (o['subscription'] ?? null) as Record<string, unknown> | null;
  const cobrancaId = pagamento && typeof pagamento === 'object' ? textoCurto(pagamento['id'], 100) : null;
  const assinaturaId =
    (pagamento && typeof pagamento === 'object' ? textoCurto(pagamento['subscription'], 100) : null) ??
    (assinatura && typeof assinatura === 'object' ? textoCurto(assinatura['id'], 100) : null);
  return { id, tipo, ocorridoEm, cobrancaId, assinaturaId };
}
