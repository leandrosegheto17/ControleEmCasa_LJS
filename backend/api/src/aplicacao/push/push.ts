import type { EntradaAssinaturaPush, Preferencias } from '@controle/contrato';
import {
  inscrever,
  lerPreferencias,
  removerInscricao,
  salvarPreferencias,
} from '../../infraestrutura/db/repositorios/push';
import { vinculoDe, type DepsLar } from '../lar/comum';

/**
 * Inscrições e preferências de push do usuário da sessão (SDD 6.2 "Push"; RN-27; TM-PUSH-04; ADR-014). O dono, o lar e o
 * membro vêm do vínculo derivado no banco (G-03), nunca do corpo; a RLS confere de novo.
 */

/** `POST /api/push/assinaturas`: idempotente pelo endpoint (o mesmo aparelho de novo não duplica). */
export async function inscreverAparelho(deps: DepsLar, dados: EntradaAssinaturaPush): Promise<void> {
  vinculoDe(deps);
  await inscrever(deps.tx, { endpoint: dados.endpoint, p256dh: dados.keys.p256dh, auth: dados.keys.auth });
}

/** `DELETE /api/push/assinaturas`: remove a inscrição do endpoint se for do usuário; a de outro fica (204 igual). */
export async function removerAparelho(deps: DepsLar, endpoint: string): Promise<void> {
  await removerInscricao(deps.tx, endpoint);
}

export async function obterPreferencias(deps: DepsLar): Promise<Preferencias> {
  vinculoDe(deps);
  return lerPreferencias(deps.tx);
}

export async function definirPreferencias(deps: DepsLar, p: Preferencias): Promise<void> {
  vinculoDe(deps);
  await salvarPreferencias(deps.tx, p, deps.agora);
}
