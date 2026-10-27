/**
 * Limpeza do que vai ao Sentry (GUARDRAILS G-45; THREAT-MODEL TM-OBS-01 e TM-ASA-05; etapa 16). A MESMA regra no Worker
 * (`@sentry/cloudflare`) e no front (`@sentry/react`), por isso mora no contrato. Não depende do SDK: trabalha sobre a
 * forma do evento e da migalha (breadcrumb).
 *
 * - Evento: a requisição fica só com método e URL sem query nem fragmento; saem usuário, `extra`, metadados internos,
 *   contextos fora da lista, variáveis locais dos frames e parâmetros de `logentry`; todo texto passa pela limpeza.
 * - Migalha: `console` sai inteira; fetch/xhr ficam com método, status e URL limpa; navegação com de/para limpos; as
 *   outras perdem `data` e ficam com a mensagem limpa.
 * - Texto: some e-mail, CPF/CNPJ, valor em reais, cookie `__Host-sid`, `Bearer`, chave do Asaas, sequência com cara de
 *   token (32+ caracteres; o UUID de correlação fica), query string e fragmento de URL, e o valor de campos sensíveis
 *   (`email`, `senha`, `token`, `cpf`, `cnpj`, `valor*`, `*centavos`, `saldo`, `descricao`, `nome`, `*sid`) em JSON,
 *   query ou `chave=valor`.
 */

const REMOVIDO = '[removido]';

/**
 * `dataCollection` do SDK v11 (os dois): no v11 o `sendDefaultPii` do G-45 deixou de existir e o padrão passou a
 * coletar tudo (usuário, cookies, cabeçalhos, corpos, query). Aqui tudo isso fica desligado. SPEC_DEVIATION: G-45 cita
 * `sendDefaultPii: false`; o equivalente no SDK atual é este objeto.
 */
export const DADOS_COLETADOS_SENTRY = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  frameContextLines: 0,
  queues: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
} as const;

const EMAIL = /[^\s@"'<>(),;:=]+@[^\s@"'<>(),;:]+\.[^\s@"'<>(),;:]+/g;
const CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g;
const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g;
const REAIS = /-?R\$\s?-?\d{1,3}(?:\.\d{3})*,\d{2}/g;
const BEARER = /\bBearer\s+[^\s,;"']+/gi;
const CHAVE_ASAAS = /\$aact_[A-Za-z0-9_$:-]+/g;
const TOKEN = /[A-Za-z0-9_-]{32,}/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const URL_ABSOLUTA = /(\bhttps?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/g;
const URL_RELATIVA = /(^|[\s("'=])(\/[^\s?#"'<>]*)[?#][^\s"'<>]*/g;
const CAMPO_SENSIVEL =
  /(["']?)\b([\w-]*(?:email|senha|password|token|cpf|cnpj|centavos|valor|saldo|descricao|nome|sid)[\w-]*)\1(\s*[:=]\s*)("(?:[^"\\]|\\.)*"|'[^']*'|[^\s,;&}\]]+)/gi;

export function limparTextoSentry(texto: string): string {
  return texto
    .replace(URL_ABSOLUTA, '$1')
    .replace(URL_RELATIVA, '$1$2')
    .replace(CAMPO_SENSIVEL, `$1$2$1$3${REMOVIDO}`)
    .replace(BEARER, `Bearer ${REMOVIDO}`)
    .replace(CHAVE_ASAAS, REMOVIDO)
    .replace(EMAIL, REMOVIDO)
    .replace(REAIS, REMOVIDO)
    .replace(CNPJ, REMOVIDO)
    .replace(CPF, REMOVIDO)
    .replace(TOKEN, (trecho) => (UUID.test(trecho) ? trecho : REMOVIDO));
}

/** URL sem query nem fragmento, e sem token no caminho. */
export function limparUrlSentry(url: string): string {
  return limparTextoSentry(url.split(/[?#]/)[0] ?? '');
}

type Objeto = Record<string, unknown>;
const ehObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown) => (typeof v === 'string' ? limparTextoSentry(v) : v);

const CONTEXTOS_PERMITIDOS = new Set([
  'runtime',
  'os',
  'browser',
  'device',
  'trace',
  'culture',
  'cloud_resource',
  'app',
]);

export interface MigalhaSentry {
  type?: string;
  category?: string;
  level?: string;
  message?: string;
  timestamp?: number;
  data?: Objeto;
}

export function limparMigalhaSentry<T extends MigalhaSentry>(migalha: T): T | null {
  if (migalha.category === 'console') return null;
  const { data, message, ...resto } = migalha;
  const limpa: Objeto = { ...resto };
  if (typeof message === 'string') limpa['message'] = limparTextoSentry(message);
  const http = migalha.type === 'http' || migalha.category === 'fetch' || migalha.category === 'xhr';
  if (http && data) {
    const d: Objeto = {};
    if (typeof data['method'] === 'string') d['method'] = data['method'];
    if (typeof data['status_code'] === 'number') d['status_code'] = data['status_code'];
    if (typeof data['url'] === 'string') d['url'] = limparUrlSentry(data['url']);
    limpa['data'] = d;
  } else if (migalha.category === 'navigation' && data) {
    const d: Objeto = {};
    if (typeof data['from'] === 'string') d['from'] = limparUrlSentry(data['from']);
    if (typeof data['to'] === 'string') d['to'] = limparUrlSentry(data['to']);
    limpa['data'] = d;
  }
  return limpa as T;
}

function limparExcecao(excecao: Objeto): Objeto {
  const limpa: Objeto = { ...excecao };
  if (typeof limpa['value'] === 'string') limpa['value'] = limparTextoSentry(limpa['value']);
  const pilha = limpa['stacktrace'];
  if (ehObjeto(pilha) && Array.isArray(pilha['frames'])) {
    limpa['stacktrace'] = {
      ...pilha,
      frames: pilha['frames'].map((frame: unknown) => {
        if (!ehObjeto(frame)) return frame;
        const f: Objeto = { ...frame };
        for (const campo of ['vars', 'pre_context', 'context_line', 'post_context']) delete f[campo];
        if (typeof f['filename'] === 'string') f['filename'] = limparUrlSentry(f['filename']);
        if (typeof f['abs_path'] === 'string') f['abs_path'] = limparUrlSentry(f['abs_path']);
        return f;
      }),
    };
  }
  return limpa;
}

/** Devolve uma cópia limpa do evento (o original não muda). */
export function limparEventoSentry<T extends object>(evento: T): T {
  const { request, contexts, tags, breadcrumbs, exception, logentry, ...resto } = evento as Objeto;
  const limpo: Objeto = { ...resto };
  for (const campo of ['user', 'extra', 'sdkProcessingMetadata']) delete limpo[campo];

  for (const campo of ['message', 'transaction', 'culprit']) {
    if (typeof limpo[campo] === 'string') limpo[campo] = limparTextoSentry(limpo[campo]);
  }
  if (ehObjeto(logentry)) {
    limpo['logentry'] =
      typeof logentry['message'] === 'string' ? { message: limparTextoSentry(logentry['message']) } : {};
  }
  if (ehObjeto(request)) {
    const r: Objeto = {};
    if (typeof request['method'] === 'string') r['method'] = request['method'];
    if (typeof request['url'] === 'string') r['url'] = limparUrlSentry(request['url']);
    limpo['request'] = r;
  }
  if (ehObjeto(contexts)) {
    limpo['contexts'] = Object.fromEntries(Object.entries(contexts).filter(([nome]) => CONTEXTOS_PERMITIDOS.has(nome)));
  }
  if (ehObjeto(tags)) {
    limpo['tags'] = Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, texto(v)]));
  }
  if (Array.isArray(breadcrumbs)) {
    limpo['breadcrumbs'] = breadcrumbs
      .filter(ehObjeto)
      .map((m) => limparMigalhaSentry(m as MigalhaSentry))
      .filter((m) => m !== null);
  }
  if (ehObjeto(exception) && Array.isArray(exception['values'])) {
    limpo['exception'] = {
      ...exception,
      values: exception['values'].map((v: unknown) => (ehObjeto(v) ? limparExcecao(v) : v)),
    };
  }
  return limpo as T;
}
