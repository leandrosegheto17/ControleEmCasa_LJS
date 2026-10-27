/**
 * Espelho, para o bundle, do contrato do Web Push (`@controle/contrato`, `push.ts`; RN-27). O bundle não leva o Zod do
 * contrato, então estes valores são copiados aqui e `push.test.ts` confere que seguem iguais aos do contrato.
 */

/** Preferências de notificação (`GET`/`PUT /api/notificacoes/preferencias`). */
export interface Preferencias {
  fixas: boolean;
  lembrete_diario: boolean;
  /** Hora cheia (0 a 23) do lembrete diário, em São Paulo. */
  lembrete_hora: number;
  metas: boolean;
}

/** Preferências de quem nunca salvou (RN-27). */
export const PREFERENCIAS_PADRAO: Readonly<Preferencias> = {
  fixas: true,
  lembrete_diario: false,
  lembrete_hora: 20,
  metas: true,
};

/** Máximo de aparelhos inscritos por usuário: a inscrição além disso tira a mais antiga. */
export const MAX_ASSINATURAS_PUSH = 10;

/** Corpo de `POST /api/push/assinaturas`: o `PushSubscription.toJSON()` sem `expirationTime` (contrato estrito). */
export interface AssinaturaPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Falha do navegador (assinar recusado, service worker ausente): a tela mostra um texto próprio, sem detalhe técnico. */
export class ErroNavegador extends Error {
  constructor(readonly motivo: 'sem_suporte' | 'sem_service_worker' | 'assinar_falhou') {
    super(motivo);
  }
}
