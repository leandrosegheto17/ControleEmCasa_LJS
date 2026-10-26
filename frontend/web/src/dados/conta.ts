import { fila } from './fila/fila';
import { encerrarNoAparelho } from './sessao';
import { chamar } from './transporte';

/**
 * Exclusão da própria conta (RN-26; ADR 013). Pedir exige rede e NÃO entra na fila offline. A senha só passa pelo corpo
 * do POST: nunca vai a `localStorage`, à fila, ao log nem à URL.
 */

/** `POST /api/conta/exclusao` (202): o link de confirmação vai por e-mail; nada muda até confirmar (CA-26.1). */
export async function pedirExclusao(senha: string): Promise<void> {
  await chamar('POST', '/api/conta/exclusao', { senha });
}

/** Chave da `sessionStorage` do convite em espera (a mesma de `useTokenDoConvite`). */
const CHAVE_CONVITE = 'controle.convite-em-espera';

/**
 * `POST /api/conta/exclusao/confirmar` (204; pública). Em sucesso o servidor já revogou as sessões e limpou o cookie;
 * o aparelho também é limpo: fila do usuário, dono lembrado, cache local e convite em espera.
 */
export async function confirmarExclusao(token: string): Promise<void> {
  await chamar('POST', '/api/conta/exclusao/confirmar', { token });
  await fila.apagarDoDono().catch(() => undefined);
  await encerrarNoAparelho();
  try {
    globalThis.sessionStorage?.removeItem(CHAVE_CONVITE);
  } catch {
    // sem armazenamento: nada a apagar
  }
}
