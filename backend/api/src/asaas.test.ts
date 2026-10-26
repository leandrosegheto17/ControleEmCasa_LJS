import { describe, expect, it } from 'vitest';
import {
  criarClienteAsaas,
  ErroAsaas,
  lerDataAsaas,
  lerEvento,
  paraCentavos,
  paraReais,
  USER_AGENT_ASAAS,
  verificarWebhook,
} from './infraestrutura/asaas';

/**
 * Módulo isolado do Asaas (SDD 2.2; G-28, G-34; TM-ASA-01; CA-24.7, CA-24.11). O `fetch` é falso: nenhuma chamada
 * sai para o Asaas e nenhuma chave real é usada.
 */

const fontesAsaas = import.meta.glob('./infraestrutura/asaas/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('fronteira do módulo do Asaas', () => {
  it('não importa nada fora da própria pasta (nem banco, nem Hono, nem o resto da API)', () => {
    const arquivos = Object.entries(fontesAsaas).filter(([c]) => !c.endsWith('.test.ts'));
    expect(arquivos.length).toBeGreaterThanOrEqual(4);
    for (const [caminho, codigo] of arquivos) {
      const imports = [...codigo.matchAll(/(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const alvo of imports) expect(alvo, `${caminho} importa ${alvo}`).toMatch(/^\.\/[^/]+$/);
    }
  });

  it('não usa SDK: só fetch', () => {
    const codigo = Object.values(fontesAsaas).join('\n');
    expect(codigo).not.toMatch(/from\s+['"]asaas/);
  });
});

interface Chamada {
  url: string;
  metodo: string;
  headers: Headers;
  corpo: Record<string, unknown> | null;
}

const CHAVE = 'chave-falsa-de-teste';
const URL_BASE = 'https://asaas.teste.invalid/v3';

function fetchFalso(respostas: Array<Response | Error>) {
  const chamadas: Chamada[] = [];
  const f = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({
      url: String(entrada),
      metodo: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      corpo: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
    });
    const r = respostas.shift();
    if (!r) throw new Error('sem resposta preparada');
    if (r instanceof Error) throw r;
    return r;
  }) as typeof fetch;
  return { f, chamadas };
}

const ok = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

const cliente = (f: typeof fetch) => criarClienteAsaas({ urlBase: URL_BASE, chaveApi: CHAVE, fetch: f });

describe('cliente REST', () => {
  it('valores: centavos ↔ reais sem erro de arredondamento (990 ↔ 9.9)', () => {
    expect(paraReais(990)).toBe(9.9);
    expect(paraCentavos(9.9)).toBe(990);
    expect(paraCentavos(0.29)).toBe(29);
  });

  it('criarCliente: POST /customers com access_token e User-Agent; o CPF vai no corpo e não volta', async () => {
    const { f, chamadas } = fetchFalso([ok({ id: 'cus_1', cpfCnpj: '52998224725', name: 'Ana' })]);
    const r = await cliente(f).criarCliente({
      nome: 'Ana',
      email: 'ana@exemplo.com',
      cpfCnpj: '52998224725',
      referenciaExterna: 'lar-1',
    });
    expect(r).toEqual({ id: 'cus_1' });
    const c = chamadas[0]!;
    expect(c.url).toBe(`${URL_BASE}/customers`);
    expect(c.metodo).toBe('POST');
    expect(c.headers.get('access_token')).toBe(CHAVE);
    expect(c.headers.get('Authorization')).toBeNull();
    expect(c.headers.get('User-Agent')).toBe(USER_AGENT_ASAAS);
    expect(c.corpo).toMatchObject({
      name: 'Ana',
      email: 'ana@exemplo.com',
      cpfCnpj: '52998224725',
      externalReference: 'lar-1',
    });
  });

  it('criarAssinatura: Pix, mensal, R$ 9,90 (CA-24.7), primeiro vencimento e referência do lar', async () => {
    const { f, chamadas } = fetchFalso([ok({ id: 'sub_1' })]);
    const r = await cliente(f).criarAssinatura({
      clienteId: 'cus_1',
      valorCentavos: 990,
      vencimento: '2026-10-24',
      descricao: 'Controle em Casa Pro',
      referenciaExterna: 'lar-1',
    });
    expect(r).toEqual({ id: 'sub_1' });
    expect(chamadas[0]!.url).toBe(`${URL_BASE}/subscriptions`);
    expect(chamadas[0]!.corpo).toEqual({
      customer: 'cus_1',
      billingType: 'PIX',
      value: 9.9,
      nextDueDate: '2026-10-24',
      cycle: 'MONTHLY',
      description: 'Controle em Casa Pro',
      externalReference: 'lar-1',
    });
  });

  it('lista as cobranças da assinatura e lê só o que importa', async () => {
    const { f, chamadas } = fetchFalso([
      ok({
        data: [
          {
            id: 'pay_1',
            subscription: 'sub_1',
            customer: 'cus_1',
            dueDate: '2026-10-24',
            value: 9.9,
            status: 'PENDING',
          },
        ],
      }),
    ]);
    expect(await cliente(f).listarCobrancasDaAssinatura('sub_1')).toEqual([
      {
        id: 'pay_1',
        assinaturaId: 'sub_1',
        clienteId: 'cus_1',
        vencimento: '2026-10-24',
        valorCentavos: 990,
        status: 'PENDING',
      },
    ]);
    expect(chamadas[0]!.url).toBe(`${URL_BASE}/subscriptions/sub_1/payments?limit=100`);
    expect(chamadas[0]!.metodo).toBe('GET');
  });

  it('buscarCobranca: 404 vira nulo; buscarPix devolve copia-e-cola e QR', async () => {
    const { f, chamadas } = fetchFalso([
      ok({ errors: [] }, 404),
      ok({ payload: '00020126...', encodedImage: 'iVBORw0K', expirationDate: '2026-10-25 23:59:59' }),
    ]);
    const c = cliente(f);
    expect(await c.buscarCobranca('pay_x')).toBeNull();
    expect(await c.buscarPix('pay_1')).toEqual({
      copiaCola: '00020126...',
      qrPngBase64: 'iVBORw0K',
      expiraEm: '2026-10-25 23:59:59',
    });
    expect(chamadas.map((x) => x.url)).toEqual([`${URL_BASE}/payments/pay_x`, `${URL_BASE}/payments/pay_1/pixQrCode`]);
  });

  it('cancelarAssinatura: DELETE; 404 = já não existe', async () => {
    const { f, chamadas } = fetchFalso([ok({ deleted: true, id: 'sub_1' }), ok({}, 404)]);
    const c = cliente(f);
    expect(await c.cancelarAssinatura('sub_1')).toBe('cancelada');
    expect(await c.cancelarAssinatura('sub_1')).toBe('inexistente');
    expect(chamadas[0]!.metodo).toBe('DELETE');
  });

  it('erro HTTP, queda de rede e resposta sem id viram ErroAsaas sem o corpo da resposta', async () => {
    const corpoComDados = { errors: [{ code: 'invalid_cpfCnpj', description: 'CPF 52998224725 inválido' }] };
    const { f } = fetchFalso([ok(corpoComDados, 400), new TypeError('falha de rede'), ok({}), ok({ id: 'x' }, 401)]);
    const c = cliente(f);
    const dados = { nome: 'Ana', email: 'a@b.c', cpfCnpj: '52998224725', referenciaExterna: 'l' };
    const e1 = await c.criarCliente(dados).catch((e: unknown) => e);
    expect(e1).toBeInstanceOf(ErroAsaas);
    expect((e1 as ErroAsaas).status).toBe(400);
    expect(String((e1 as Error).message)).not.toContain('52998224725');
    expect(await c.criarCliente(dados).catch((e: unknown) => (e as ErroAsaas).motivo)).toBe('rede');
    expect(await c.criarCliente(dados).catch((e: unknown) => (e as ErroAsaas).motivo)).toBe('resposta');
    expect(await c.buscarCobranca('pay_1').catch((e: unknown) => (e as ErroAsaas).status)).toBe(401);
  });
});

describe('verificarWebhook (G-28; TM-ASA-01)', () => {
  const TOKEN = 'token-do-webhook-de-teste-com-mais-de-32-caracteres';
  const pedido = (token?: string) =>
    new Request('https://x/api/webhooks/asaas', {
      method: 'POST',
      headers: token === undefined ? {} : { 'asaas-access-token': token },
    });

  it('aceita só o token exato', async () => {
    expect(await verificarWebhook(pedido(TOKEN), TOKEN)).toBe(true);
  });

  it('recusa token ausente, vazio, errado, prefixo, com sobra e de outro tamanho', async () => {
    for (const t of [undefined, '', 'errado', TOKEN.slice(0, -1), `${TOKEN}x`, TOKEN.toUpperCase(), 'x'.repeat(300)]) {
      expect(await verificarWebhook(pedido(t), TOKEN), String(t)).toBe(false);
    }
  });

  it('segredo ausente nunca confere (falha fechada)', async () => {
    expect(await verificarWebhook(pedido(''), '')).toBe(false);
  });

  it('compara em tempo constante: SHA-256 dos dois e XOR de todos os bytes, sem saída antecipada', () => {
    const codigo = Object.entries(fontesAsaas).find(([c]) => c.endsWith('/webhook.ts'))![1];
    expect(codigo).toMatch(/digest\('SHA-256'/);
    expect(codigo).toMatch(/diferenca \|= /);
    expect(codigo).not.toMatch(/recebido\s*===\s*tokenEsperado/);
  });
});

describe('lerEvento', () => {
  it('lê id, tipo, data e os ids da cobrança e da assinatura; nada do pagador', () => {
    const e = lerEvento({
      id: 'evt_1',
      event: 'PAYMENT_RECEIVED',
      dateCreated: '2026-10-24 12:00:00',
      payment: { id: 'pay_1', subscription: 'sub_1', customer: 'cus_1', value: 9.9, cpfCnpj: '52998224725' },
    });
    expect(e).toEqual({
      id: 'evt_1',
      tipo: 'PAYMENT_RECEIVED',
      ocorridoEm: new Date('2026-10-24T15:00:00.000Z'),
      cobrancaId: 'pay_1',
      assinaturaId: 'sub_1',
    });
    expect(JSON.stringify(e)).not.toContain('52998224725');
  });

  it('evento de assinatura usa subscription.id', () => {
    expect(
      lerEvento({
        id: 'evt_2',
        event: 'SUBSCRIPTION_DELETED',
        dateCreated: '2026-10-24 12:00:00',
        subscription: { id: 'sub_1' },
      }),
    ).toMatchObject({ cobrancaId: null, assinaturaId: 'sub_1' });
  });

  it('formato inválido → nulo', () => {
    for (const corpo of [
      null,
      'texto',
      {},
      { id: 'evt', event: 'X' },
      { id: '', event: 'X', dateCreated: '2026-10-24 12:00:00' },
      { id: 'evt', event: 'X', dateCreated: 'ontem' },
      { id: 'e'.repeat(101), event: 'X', dateCreated: '2026-10-24 12:00:00' },
    ]) {
      expect(lerEvento(corpo), JSON.stringify(corpo)).toBeNull();
    }
  });

  it('data do Asaas sem fuso é lida como horário de Brasília; com fuso, vale o fuso', () => {
    expect(lerDataAsaas('2026-10-24 00:00:00')?.toISOString()).toBe('2026-10-24T03:00:00.000Z');
    expect(lerDataAsaas('2026-10-24T00:00:00Z')?.toISOString()).toBe('2026-10-24T00:00:00.000Z');
    expect(lerDataAsaas('2026-13-40 00:00:00')).toBeNull();
  });
});
