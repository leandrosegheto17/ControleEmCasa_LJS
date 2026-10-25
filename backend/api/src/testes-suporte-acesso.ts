import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '@controle/contrato';
import { sql, type Kysely } from 'kysely';
import { inject } from 'vitest';
import { criarApp, type OpcoesDoApp } from './app';
import type { Bindings } from './env';
import { criarDb } from './infraestrutura/db/cliente';
import type { DB } from './infraestrutura/db/tipos';
import type { MensagemEmail, TransporteEmail } from './infraestrutura/email';
import { chamar, ESCRITA } from './testes-suporte';

/** Utilitários dos testes de acesso (etapa 4). Só para testes: fica fora da varredura de código de produção. */

export const ACEITE = { termos: VERSAO_TERMOS, privacidade: VERSAO_PRIVACIDADE };
export const SENHA_BOA = 'senha-muito-boa-123';

/** Binding de rate limit que sempre deixa passar (o miniflare simularia 10/min e os testes fazem dezenas). */
export const LIMITE_LIVRE = { limit: async () => ({ success: true }) } as unknown as RateLimit;
const SEM_LIMITE: Partial<Bindings> = { LIMITE_ENTRAR: LIMITE_LIVRE, LIMITE_PUBLICO: LIMITE_LIVRE };

let sequencia = 0;
export function emailAleatorio(prefixo = 'pessoa'): string {
  sequencia += 1;
  return `${prefixo}.${crypto.randomUUID().slice(0, 8)}${sequencia}@exemplo.com`;
}

export function ipAleatorio(): string {
  const b = crypto.getRandomValues(new Uint8Array(3));
  return `10.${b[0]}.${b[1]}.${b[2]}`;
}

/** Relógio controlado: começa num instante fixo e só anda quando o teste manda. */
export function relogioControlado(inicio = new Date('2026-10-24T12:00:00.000Z')) {
  let agora = new Date(inicio);
  return {
    relogio: () => new Date(agora),
    avancar(ms: number) {
      agora = new Date(agora.getTime() + ms);
    },
    agora: () => new Date(agora),
  };
}

export const MINUTO = 60 * 1000;
export const HORA = 60 * MINUTO;

/** Caixa de e-mail em memória: o transporte injetado guarda as mensagens. */
export function caixaDeEmail() {
  const mensagens: MensagemEmail[] = [];
  const transporte: TransporteEmail = async (m) => {
    mensagens.push(m);
    return { ok: true };
  };
  return {
    transporte,
    mensagens,
    para: (email: string) => mensagens.filter((m) => m.para === email),
    /** Token do último link enviado ao e-mail (o link leva o token no fragmento `#t=`). */
    ultimoToken(email: string): string {
      const msgs = mensagens.filter((m) => m.para === email);
      const ultima = msgs[msgs.length - 1];
      const achado = ultima?.texto.match(/#t=([A-Za-z0-9_-]+)/);
      if (!achado?.[1]) throw new Error('sem link no último e-mail');
      return achado[1];
    },
  };
}

export type Caixa = ReturnType<typeof caixaDeEmail>;

export function appDeAcesso(opcoes: OpcoesDoApp & { caixa?: Caixa } = {}) {
  const caixa = opcoes.caixa ?? caixaDeEmail();
  const app = criarApp({ ...opcoes, transporteEmail: caixa.transporte });
  return { app, caixa };
}

type App = ReturnType<typeof criarApp>;

export interface OpcoesChamada {
  cookie?: string;
  ip?: string;
  cabecalhos?: Record<string, string>;
  ajustes?: Partial<Bindings>;
}

/** POST JSON com os cabeçalhos de CSRF, sem rate limit (salvo se `ajustes` trouxer outro binding). */
export function postar(app: App, caminho: string, corpo: unknown, op: OpcoesChamada = {}): Promise<Response> {
  const headers: Record<string, string> = { ...ESCRITA, 'Content-Type': 'application/json', ...op.cabecalhos };
  if (op.cookie) headers['Cookie'] = op.cookie;
  if (op.ip) headers['CF-Connecting-IP'] = op.ip;
  return chamar(
    app,
    caminho,
    { method: 'POST', headers, body: JSON.stringify(corpo) },
    { ...SEM_LIMITE, ...op.ajustes },
  );
}

export function obter(app: App, caminho: string, op: OpcoesChamada = {}): Promise<Response> {
  const headers: Record<string, string> = { ...op.cabecalhos };
  if (op.cookie) headers['Cookie'] = op.cookie;
  if (op.ip) headers['CF-Connecting-IP'] = op.ip;
  return chamar(app, caminho, { headers }, { ...SEM_LIMITE, ...op.ajustes });
}

/** Valor do `__Host-sid` definido na resposta (ou `null`). */
export function tokenDoCookie(r: Response): string | null {
  for (const linha of r.headers.getSetCookie()) {
    const achado = linha.match(/^__Host-sid=([^;]*)/);
    if (achado && achado[1]) return achado[1];
  }
  return null;
}

export const cookieSid = (token: string) => `__Host-sid=${token}`;

/** Executa com uma conexão de owner no banco descartável (só para preparar e inspecionar). */
export async function comoOwner<T>(fn: (db: Kysely<DB>) => Promise<T>): Promise<T> {
  const db = criarDb(inject('urlBancoOwner'));
  try {
    return await fn(db);
  } finally {
    await db.destroy();
  }
}

/**
 * Cria usuários confirmados direto no banco (owner). Um único bcrypt para todos: o hash é calculado uma vez
 * e reaproveitado, o que deixa a preparação barata sem mudar o custo da verificação (cost 12).
 */
export async function criarUsuariosConfirmados(emails: string[], senha = SENHA_BOA, confirmado = true): Promise<void> {
  await comoOwner(async (db) => {
    const r = await sql<{ h: string }>`select app.crypt(${senha}, app.gen_salt('bf', 12)) as h`.execute(db);
    const hash = r.rows[0]?.h;
    for (const email of emails) {
      await sql`insert into app.usuario (email, nome, senha_hash, email_confirmado_em)
                values (${email}, 'Pessoa de teste', ${hash}, ${confirmado ? sql`now()` : null})`.execute(db);
    }
  });
}

/** Cadastra pela API, confirma pelo link do e-mail e devolve a caixa (fluxo real, ponta a ponta). */
export async function cadastrarEConfirmar(app: App, caixa: Caixa, email: string, senha = SENHA_BOA): Promise<void> {
  const r = await postar(app, '/api/cadastro', { nome: 'Pessoa', email, senha, aceite: ACEITE });
  if (r.status !== 202) throw new Error(`cadastro falhou: ${r.status}`);
  const c = await postar(app, '/api/cadastro/confirmar', { token: caixa.ultimoToken(email) });
  if (c.status !== 204) throw new Error(`confirmação falhou: ${c.status}`);
}

/** Entra e devolve o token do cookie. */
export async function entrarComo(app: App, email: string, senha = SENHA_BOA, op: OpcoesChamada = {}): Promise<string> {
  const r = await postar(app, '/api/sessao/entrar', { email, senha }, op);
  const token = tokenDoCookie(r);
  if (r.status !== 204 || !token) throw new Error(`entrar falhou: ${r.status}`);
  return token;
}

export async function sha256(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
}

export function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? (v[meio] ?? 0) : ((v[meio - 1] ?? 0) + (v[meio] ?? 0)) / 2;
}

export async function cronometrar(fn: () => Promise<unknown>): Promise<number> {
  const inicio = performance.now();
  await fn();
  return performance.now() - inicio;
}

/** Resposta comparável byte a byte: status, corpo e cabeçalhos, sem o id de correlação (que muda sempre). */
export async function assinaturaDaResposta(r: Response) {
  const cabecalhos = [...r.headers.entries()].filter(([k]) => k.toLowerCase() !== 'x-request-id').sort();
  return { status: r.status, corpo: await r.text(), cabecalhos };
}
