import { readFileSync } from 'node:fs';
import type { PedidoAsaas } from './asaasFalso';

/** Endereço do Worker no `wrangler dev` dos e2e da pilha (é também a `URL_PUBLICA`, que o CSRF confere). */
export const PORTA_PILHA = Number(process.env['PORTA_PILHA'] ?? 8788);
export const URL_PILHA = `http://localhost:${PORTA_PILHA}`;

const variavel = (nome: string) => {
  const valor = process.env[nome];
  if (!valor) throw new Error(`${nome} ausente: a pilha não subiu pelo global.ts`);
  return valor;
};

/**
 * Último link de e-mail (transporte de console de `AMBIENTE=local`) com o caminho pedido, lido do log do wrangler.
 * O log não traz o destinatário: cada teste usa o próprio e-mail e lê o link logo depois de pedir o envio.
 */
export async function linkDoEmail(caminho: string, depoisDe = 0, limiteMs = 15_000): Promise<string> {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    const linhas = readFileSync(variavel('E2E_PILHA_LOG'), 'utf8').split(/\r?\n/).slice(depoisDe);
    for (const linha of linhas.reverse()) {
      const m = /\{"nivel":"info","evento":"email_local".*\}/.exec(linha);
      if (!m) continue;
      const link = (JSON.parse(m[0]) as { links: string[] }).links.find((l) => new URL(l).pathname === caminho);
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`nenhum e-mail com link para ${caminho} no log do wrangler`);
}

/** Número de linhas do log agora (para ler só os e-mails enviados depois). */
export const linhasDoLog = () => readFileSync(variavel('E2E_PILHA_LOG'), 'utf8').split(/\r?\n/).length - 1;

/** Pedidos que o Worker fez ao Asaas simulado. */
export async function pedidosAoAsaas(): Promise<PedidoAsaas[]> {
  return (await (await fetch(`${variavel('E2E_PILHA_ASAAS')}/__registro`)).json()) as PedidoAsaas[];
}

/** O "Asaas" recebe o Pix da 1ª cobrança e manda o webhook ao Worker, como o Asaas real faz. */
export async function pagarPrimeiraCobranca(): Promise<number> {
  const cobranca = (await (await fetch(`${variavel('E2E_PILHA_ASAAS')}/__pagar`, { method: 'POST' })).json()) as {
    id: string;
    subscription: string;
  };
  const resposta = await fetch(`${URL_PILHA}/api/webhooks/asaas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'asaas-access-token': variavel('E2E_PILHA_TOKEN_WEBHOOK') },
    body: JSON.stringify({
      id: `evt_e2e_${cobranca.id}`,
      event: 'PAYMENT_RECEIVED',
      dateCreated: new Date().toISOString(),
      payment: { id: cobranca.id, subscription: cobranca.subscription, status: 'RECEIVED' },
    }),
  });
  return resposta.status;
}
