import { env } from 'cloudflare:workers';
import { sql } from 'kysely';
import { criarApp } from './app';
import type { Bindings } from './env';
import {
  ErroAsaas,
  type ClienteAsaas,
  type CobrancaAsaas,
  type NovaAssinaturaAsaas,
  type NovoClienteAsaas,
} from './infraestrutura/asaas';
import { chamar } from './testes-suporte';
import { caixaDeEmail, comoOwner, LIMITE_LIVRE, relogioControlado } from './testes-suporte-acesso';
import {
  convidarEAceitar,
  criarLarDe,
  json,
  linhasComoOwner,
  novaSessao,
  pedir,
  pessoa,
  type Pessoa,
} from './testes-suporte-lar';

/** Utilitários dos testes do plano e do webhook (etapa 13). Só para testes: fora da varredura de código de produção. */

export type App = ReturnType<typeof criarApp>;

/** Métodos do cliente que o teste pode derrubar (Asaas fora do ar). */
export type MetodoAsaas = keyof ClienteAsaas;

/**
 * Asaas falso, em memória. Nenhuma chamada sai da máquina e nenhuma chave real existe. Criar a assinatura já gera a 1ª
 * cobrança (PENDING) com vencimento no dia pedido. O teste muda o status das cobranças e cria as seguintes.
 */
export function asaasFalso() {
  const clientes: Array<NovoClienteAsaas & { id: string }> = [];
  const assinaturas: Array<NovaAssinaturaAsaas & { id: string }> = [];
  const cobrancas = new Map<string, CobrancaAsaas>();
  const canceladas: string[] = [];
  const chamadas: MetodoAsaas[] = [];
  const falhar = new Set<MetodoAsaas>();
  let seq = 0;
  const id = (prefixo: string) => `${prefixo}_${crypto.randomUUID().slice(0, 8)}${(seq += 1)}`;
  const talvezFalhe = (m: MetodoAsaas) => {
    chamadas.push(m);
    if (falhar.has(m)) throw new ErroAsaas('http', 503);
  };

  const cliente: ClienteAsaas = {
    async criarCliente(d) {
      talvezFalhe('criarCliente');
      const c = { ...d, id: id('cus') };
      clientes.push(c);
      return { id: c.id };
    },
    async criarAssinatura(d) {
      talvezFalhe('criarAssinatura');
      const a = { ...d, id: id('sub') };
      assinaturas.push(a);
      const pay: CobrancaAsaas = {
        id: id('pay'),
        assinaturaId: a.id,
        clienteId: d.clienteId,
        vencimento: d.vencimento,
        valorCentavos: d.valorCentavos,
        status: 'PENDING',
      };
      cobrancas.set(pay.id, pay);
      return { id: a.id };
    },
    async listarCobrancasDaAssinatura(assinaturaId) {
      talvezFalhe('listarCobrancasDaAssinatura');
      return [...cobrancas.values()].filter((c) => c.assinaturaId === assinaturaId).map((c) => ({ ...c }));
    },
    async buscarCobranca(cobrancaId) {
      talvezFalhe('buscarCobranca');
      const c = cobrancas.get(cobrancaId);
      return c ? { ...c } : null;
    },
    async buscarPix(cobrancaId) {
      talvezFalhe('buscarPix');
      return { copiaCola: `pix-copia-cola-${cobrancaId}`, qrPngBase64: `qr-${cobrancaId}`, expiraEm: null };
    },
    async cancelarAssinatura(assinaturaId) {
      talvezFalhe('cancelarAssinatura');
      canceladas.push(assinaturaId);
      return 'cancelada';
    },
  };

  return {
    cliente,
    clientes,
    assinaturas,
    cobrancas,
    canceladas,
    chamadas,
    falhar,
    /** Muda o status de uma cobrança no "Asaas" (ex.: `RECEIVED`, `OVERDUE`). */
    status(cobrancaId: string, status: string) {
      const c = cobrancas.get(cobrancaId);
      if (!c) throw new Error(`cobrança ${cobrancaId} não existe`);
      cobrancas.set(cobrancaId, { ...c, status });
    },
    /** Gera a próxima cobrança da assinatura. */
    novaCobranca(assinaturaId: string, vencimento: string, extra: Partial<CobrancaAsaas> = {}): string {
      const a = assinaturas.find((x) => x.id === assinaturaId);
      const c: CobrancaAsaas = {
        id: id('pay'),
        assinaturaId,
        clienteId: a?.clienteId ?? null,
        vencimento,
        valorCentavos: 990,
        status: 'PENDING',
        ...extra,
      };
      cobrancas.set(c.id, c);
      return c.id;
    },
    /** A 1ª cobrança (a única até o teste criar outras) de uma assinatura. */
    cobrancasDe(assinaturaId: string): CobrancaAsaas[] {
      return [...cobrancas.values()].filter((c) => c.assinaturaId === assinaturaId);
    },
  };
}

export type AsaasFalso = ReturnType<typeof asaasFalso>;

/** "Hoje" dos testes de plano: 24/10/2026, 12:00 em São Paulo. */
export const AGORA_PLANO = new Date('2026-10-24T15:00:00.000Z');
export const DIA = 24 * 60 * 60 * 1000;

/** App com relógio controlado, caixa de e-mail e Asaas falso. */
export function appDePlano(agora = AGORA_PLANO) {
  const relogio = relogioControlado(agora);
  const caixa = caixaDeEmail();
  const asaas = asaasFalso();
  const app = criarApp({ relogio: relogio.relogio, transporteEmail: caixa.transporte, asaas: asaas.cliente });
  return { app, relogio, caixa, asaas };
}

/** Lar com titular (e, se pedido, um convidado), no relógio do app. */
export async function larDePlano(
  prefixo: string,
  opcoes: { comMembro?: boolean; trialJaUsado?: boolean; agora?: Date } = {},
) {
  const base = appDePlano(opcoes.agora);
  const titular = await pessoa(`${prefixo}.titular`, `Titular ${prefixo}`, base.relogio.agora());
  if (opcoes.trialJaUsado) {
    await comoOwner((db) => sql`update app.usuario set trial_usado_em = now() where id = ${titular.id}`.execute(db));
  }
  const larId = await criarLarDe(base.app, titular);
  let membro: Pessoa | null = null;
  if (opcoes.comMembro) {
    membro = await pessoa(`${prefixo}.membro`, `Membro ${prefixo}`, base.relogio.agora());
    await convidarEAceitar(base.app, base.caixa, titular, membro);
  }
  /** Avança o relógio e renova as sessões (a inatividade de 15 min derrubaria as antigas). */
  async function avancar(ms: number) {
    base.relogio.avancar(ms);
    titular.cookie = await novaSessao(titular.id, base.relogio.agora());
    if (membro) membro.cookie = await novaSessao(membro.id, base.relogio.agora());
  }
  return { ...base, titular, membro, larId, avancar };
}

export const CPF_TESTE = '529.982.247-25';
export const CPF_DIGITOS = '52998224725';

export interface MeuPlanoVisto {
  plano: 'free' | 'pro';
  situacao: string;
  trial_ate: string;
  periodo_ate: string | null;
  preco_centavos: number;
  sou_titular: boolean;
  cobranca?: {
    vencimento: string;
    valor_centavos: number;
    situacao: string;
    pix_copia_cola: string | null;
    qr_png_base64: string | null;
  };
}

export async function meuPlano(app: App, quem: Pessoa): Promise<MeuPlanoVisto> {
  const r = await pedir(app, 'GET', '/api/plano', quem);
  if (r.status !== 200) throw new Error(`GET /api/plano falhou: ${r.status} ${await r.text()}`);
  return json<MeuPlanoVisto>(r);
}

export function assinarPlano(app: App, quem: Pessoa, cpf: unknown = CPF_TESTE): Promise<Response> {
  return pedir(app, 'POST', '/api/plano/assinar', quem, { cpf_cnpj: cpf });
}

export function cancelarPlano(app: App, quem: Pessoa): Promise<Response> {
  return pedir(app, 'POST', '/api/plano/cancelar', quem);
}

export interface LinhaAssinaturaVista {
  situacao: string;
  trial_ate: Date;
  periodo_ate: Date | null;
  asaas_cliente_id: string | null;
  asaas_assinatura_id: string | null;
  cobranca_id: string | null;
  cobranca_vencimento: string | null;
  cobranca_situacao: string | null;
  linha: string;
}

/** A linha da assinatura do lar (owner), com o JSON da linha inteira para procurar o CPF. */
export async function assinaturaNoBanco(larId: string): Promise<LinhaAssinaturaVista | null> {
  const linhas = await linhasComoOwner(sql<LinhaAssinaturaVista>`
    select a.situacao, a.trial_ate, a.periodo_ate, a.asaas_cliente_id, a.asaas_assinatura_id, a.cobranca_id,
           a.cobranca_vencimento::text as cobranca_vencimento, a.cobranca_situacao, row_to_json(a)::text as linha
      from app.assinatura a where a.lar_id = ${larId}`);
  return linhas[0] ?? null;
}

/** `dateCreated` no formato do Asaas ("AAAA-MM-DD HH:MM:SS", horário de Brasília). */
export function dataAsaas(instante: Date): string {
  return new Date(instante.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

export const tokenWebhook = () => (env as unknown as Bindings).ASAAS_WEBHOOK_TOKEN as string;

/** POST do webhook como o Asaas faria (sem cookie e sem os cabeçalhos de CSRF). */
export function webhook(
  app: App,
  corpo: unknown,
  opcoes: { token?: string | null; ajustes?: Partial<Bindings> } = {},
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = opcoes.token === undefined ? tokenWebhook() : opcoes.token;
  if (token !== null) headers['asaas-access-token'] = token;
  return chamar(
    app,
    '/api/webhooks/asaas',
    { method: 'POST', headers, body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) },
    { LIMITE_WEBHOOK: LIMITE_LIVRE, ...opcoes.ajustes },
  );
}

/** Corpo de evento de cobrança do Asaas. */
export function eventoCobranca(
  tipo: string,
  cobranca: CobrancaAsaas,
  quando: Date,
  idEvento = `evt_${crypto.randomUUID()}`,
) {
  return {
    id: idEvento,
    event: tipo,
    dateCreated: dataAsaas(quando),
    payment: {
      id: cobranca.id,
      subscription: cobranca.assinaturaId,
      customer: cobranca.clienteId,
      value: cobranca.valorCentavos / 100,
      dueDate: cobranca.vencimento,
      status: cobranca.status,
      billingType: 'PIX',
    },
  };
}

/** Envia o webhook e falha o teste se não for 200; devolve o resultado informado. */
export async function webhookOk(app: App, corpo: unknown): Promise<string> {
  const r = await webhook(app, corpo);
  if (r.status !== 200) throw new Error(`webhook falhou: ${r.status} ${await r.text()}`);
  return (await json<{ resultado: string }>(r)).resultado;
}

/** Assina (201) e devolve a assinatura e a 1ª cobrança do Asaas falso. */
export async function assinarOk(l: { app: App; titular: Pessoa; asaas: AsaasFalso; larId: string }) {
  const r = await assinarPlano(l.app, l.titular);
  if (r.status !== 201) throw new Error(`assinar falhou: ${r.status} ${await r.text()}`);
  const linha = await assinaturaNoBanco(l.larId);
  const assinaturaId = linha!.asaas_assinatura_id!;
  const primeira = l.asaas.cobrancasDe(assinaturaId)[0]!;
  return { assinaturaId, primeira, corpo: await json<MeuPlanoVisto>(r) };
}

/** Assina e confirma o 1º pagamento pelo webhook: o lar fica `ativa`. */
export async function larAtivo(prefixo: string, opcoes: { comMembro?: boolean } = {}) {
  const l = await larDePlano(prefixo, opcoes);
  const { assinaturaId, primeira } = await assinarOk(l);
  l.asaas.status(primeira.id, 'RECEIVED');
  const r = await webhookOk(
    l.app,
    eventoCobranca('PAYMENT_RECEIVED', l.asaas.cobrancas.get(primeira.id)!, l.relogio.agora()),
  );
  if (r !== 'aplicado') throw new Error(`pagamento não aplicado: ${r}`);
  return { ...l, assinaturaId, primeira };
}

/** Categoria conjunta "Mercado" do lar (para os testes de orçamento). */
export async function mercadoDe(app: App, quem: Pessoa): Promise<string> {
  const r = await pedir(app, 'GET', '/api/categorias', quem);
  const lista = await json<Array<{ id: string; nome: string; escopo: string }>>(r);
  return lista.find((c) => c.nome === 'Mercado' && c.escopo === 'conjunto')!.id;
}
