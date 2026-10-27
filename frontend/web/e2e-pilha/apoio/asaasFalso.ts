import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Asaas simulado para os e2e da pilha real (etapa 16): um servidor HTTP local que responde as rotas que o cliente do
 * Worker usa (`backend/api/src/infraestrutura/asaas/cliente.ts`), no formato da API v3 do Asaas. Guarda cada pedido e
 * expõe `GET /__registro` (pedidos) e `POST /__pagar` (marca a 1ª cobrança como recebida) para os testes.
 * Nada sai para o Asaas de verdade.
 */

export const PIX_FALSO = '00020126580014br.gov.bcb.pix0136e2e-pix-copia-e-cola-falso5204000053039865802BR6304ABCD';
const QR_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export interface PedidoAsaas {
  metodo: string;
  caminho: string;
  corpo: unknown;
  chave: string | null;
}

interface Cobranca {
  id: string;
  subscription: string;
  customer: string;
  dueDate: string;
  value: number;
  status: string;
}

function lerCorpo(pedido: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let texto = '';
    pedido.on('data', (parte: Buffer) => (texto += parte.toString('utf8')));
    pedido.on('end', () => {
      try {
        resolve(texto ? JSON.parse(texto) : null);
      } catch {
        resolve(texto);
      }
    });
  });
}

export async function iniciarAsaasFalso(): Promise<{ servidor: Server; url: string }> {
  const pedidos: PedidoAsaas[] = [];
  const cobrancas = new Map<string, Cobranca>();
  let sequencia = 0;
  const novoId = (prefixo: string) => `${prefixo}_e2e${(sequencia += 1).toString().padStart(6, '0')}`;

  const servidor = createServer(async (pedido, resposta) => {
    const url = new URL(pedido.url ?? '/', 'http://asaas.falso');
    const corpo = await lerCorpo(pedido);
    const json = (status: number, dados: unknown) => {
      resposta.writeHead(status, { 'Content-Type': 'application/json' });
      resposta.end(JSON.stringify(dados));
    };

    if (url.pathname === '/__registro') return json(200, pedidos);
    if (url.pathname === '/__pagar' && pedido.method === 'POST') {
      const [primeira] = cobrancas.values();
      if (!primeira) return json(404, { erro: 'sem cobrança' });
      primeira.status = 'RECEIVED';
      return json(200, primeira);
    }

    const chave = pedido.headers['access_token'];
    pedidos.push({
      metodo: pedido.method ?? '',
      caminho: url.pathname,
      corpo,
      chave: typeof chave === 'string' ? chave : null,
    });
    const c = corpo as Record<string, unknown> | null;

    if (pedido.method === 'POST' && url.pathname === '/v3/customers') return json(200, { id: novoId('cus') });
    if (pedido.method === 'POST' && url.pathname === '/v3/subscriptions') {
      const assinatura = novoId('sub');
      const cobranca: Cobranca = {
        id: novoId('pay'),
        subscription: assinatura,
        customer: String(c?.['customer']),
        dueDate: String(c?.['nextDueDate']),
        value: Number(c?.['value']),
        status: 'PENDING',
      };
      cobrancas.set(cobranca.id, cobranca);
      return json(200, { id: assinatura, status: 'ACTIVE' });
    }
    const daAssinatura = /^\/v3\/subscriptions\/([^/]+)\/payments$/.exec(url.pathname);
    if (pedido.method === 'GET' && daAssinatura) {
      return json(200, { data: [...cobrancas.values()].filter((x) => x.subscription === daAssinatura[1]) });
    }
    const pix = /^\/v3\/payments\/([^/]+)\/pixQrCode$/.exec(url.pathname);
    if (pedido.method === 'GET' && pix && cobrancas.has(pix[1]!)) {
      return json(200, { payload: PIX_FALSO, encodedImage: QR_PNG, expirationDate: '2099-12-31 23:59:59' });
    }
    const cobranca = /^\/v3\/payments\/([^/]+)$/.exec(url.pathname);
    if (pedido.method === 'GET' && cobranca) {
      const achada = cobrancas.get(cobranca[1]!);
      return achada ? json(200, achada) : json(404, { errors: [] });
    }
    const cancelar = /^\/v3\/subscriptions\/([^/]+)$/.exec(url.pathname);
    if (pedido.method === 'DELETE' && cancelar) return json(200, { deleted: true, id: cancelar[1] });
    return json(404, { errors: [{ code: 'not_found' }] });
  });

  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const { port } = servidor.address() as AddressInfo;
  return { servidor, url: `http://127.0.0.1:${port}` };
}
