import type { SaidaMeuPlano } from '@controle/contrato';
import { chamar } from './transporte';

/**
 * Plano do lar (RN-24; SDD 6.2 "Plano"). Assinar e cancelar exigem rede e NÃO entram na fila offline: ficam fora de
 * `comum/fila`. O CPF/CNPJ só passa pelo corpo do POST: nunca vai a `localStorage`, à fila, ao log nem à URL (CA-24.11).
 */

/** `GET /api/plano`: plano, situação e, só para o titular, a cobrança em aberto com o Pix. */
export function buscarPlano(): Promise<SaidaMeuPlano> {
  return chamar<SaidaMeuPlano>('GET', '/api/plano', undefined, { saida: 'MeuPlano' });
}

/** `POST /api/plano/assinar` (titular; 201). `cpfCnpj` aceita pontuação. */
export function assinarPlano(cpfCnpj: string): Promise<SaidaMeuPlano> {
  return chamar<SaidaMeuPlano>('POST', '/api/plano/assinar', { cpf_cnpj: cpfCnpj }, { saida: 'MeuPlano' });
}

/** `POST /api/plano/cancelar` (titular; 204): o Pro continua até o fim do período pago. */
export async function cancelarPlano(): Promise<void> {
  await chamar('POST', '/api/plano/cancelar');
}
