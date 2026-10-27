import { ErroNavegador, type AssinaturaPush, type Preferencias } from '../comum/push';
import { registrarLimpeza } from './aparelho';
import { chamar } from './transporte';

/**
 * Web Push no navegador e na API (RN-27; ADR 014; G-39). Tudo aqui exige rede e NÃO entra na fila offline. A permissão
 * só é pedida por `ativarNesteAparelho`, que a tela chama no clique do usuário, nunca ao abrir o app.
 */

export type PermissaoPush = 'default' | 'granted' | 'denied';

export type ResultadoAtivar = 'ativada' | 'permissao_negada' | 'permissao_ignorada';

/** O navegador tem service worker, Push API e Notification? (No iOS só com o app instalado.) */
export function suportaPush(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function permissaoDoNavegador(): PermissaoPush {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission;
}

export type EstadoPush = 'sem_suporte' | 'negada' | 'inativa' | 'ativa';

/**
 * Situação do navegador para o aviso: sem suporte; permissão negada (só se desfaz nas configurações do navegador);
 * ativa (permissão dada e inscrição neste aparelho); ou inativa (ainda não pedida, ou sem inscrição).
 */
export async function lerEstadoPush(): Promise<EstadoPush> {
  if (!suportaPush()) return 'sem_suporte';
  if (permissaoDoNavegador() === 'denied') return 'negada';
  if (permissaoDoNavegador() === 'granted' && (await inscricaoDesteAparelho())) return 'ativa';
  return 'inativa';
}

const PRAZO_SERVICE_WORKER_MS = 10_000;

/** `serviceWorker.ready` nunca resolve sem service worker registrado (ex.: desenvolvimento): limita a espera. */
async function registroPronto(): Promise<ServiceWorkerRegistration> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new ErroNavegador('sem_service_worker')), PRAZO_SERVICE_WORKER_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, prazo]);
  } finally {
    clearTimeout(relogio);
  }
}

/** A inscrição deste aparelho, sem esperar um service worker que não existe. `null` se não houver. */
export async function inscricaoDesteAparelho(): Promise<PushSubscription | null> {
  if (!suportaPush()) return null;
  try {
    const registro = await navigator.serviceWorker.getRegistration();
    return (await registro?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** Chave pública VAPID em base64url → bytes, o formato que `applicationServerKey` pede. */
export function chaveParaBytes(chave: string): Uint8Array<ArrayBuffer> {
  const base64 = chave
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(chave.length / 4) * 4, '=');
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** `GET /api/push/chave`: 503 (`indisponivel`) quando o servidor não tem VAPID configurado. */
export async function buscarChavePublica(): Promise<string> {
  const { chave_publica } = await chamar<{ chave_publica: string }>('GET', '/api/push/chave', undefined, {
    saida: 'ChavePush',
  });
  return chave_publica;
}

/** Só `endpoint` e `keys`: o contrato é estrito e recusa `expirationTime`. */
export function corpoDaAssinatura(inscricao: PushSubscription): AssinaturaPush {
  const { endpoint, keys } = inscricao.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new ErroNavegador('assinar_falhou');
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** `POST /api/push/assinaturas` (204, idempotente). */
export async function enviarAssinatura(corpo: AssinaturaPush): Promise<void> {
  await chamar('POST', '/api/push/assinaturas', corpo);
}

/** `DELETE /api/push/assinaturas` (204; não exige lar). */
export async function removerAssinaturaNoServidor(endpoint: string, semAvisoDeSessao = false): Promise<void> {
  await chamar('DELETE', '/api/push/assinaturas', { endpoint }, { semAvisoDeSessao });
}

/**
 * Ativa o aviso neste aparelho. Chamar só dentro do clique do usuário: o navegador exige o gesto para pedir a permissão,
 * que por isso vem antes de buscar a chave. Falhas do servidor lançam `ErroDados`; as do navegador, `ErroNavegador`.
 */
export async function ativarNesteAparelho(): Promise<ResultadoAtivar> {
  if (!suportaPush()) throw new ErroNavegador('sem_suporte');
  if (Notification.permission !== 'granted') {
    const resposta = await Notification.requestPermission();
    if (resposta === 'denied') return 'permissao_negada';
    if (resposta !== 'granted') return 'permissao_ignorada';
  }
  const chave = await buscarChavePublica();
  const registro = await registroPronto();
  const anterior = await registro.pushManager.getSubscription();
  let inscricao: PushSubscription;
  try {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes(chave),
    });
  } catch {
    throw new ErroNavegador('assinar_falhou');
  }
  try {
    await enviarAssinatura(corpoDaAssinatura(inscricao));
  } catch (e) {
    // Sem o servidor saber da inscrição ela não serve: não deixa uma órfã no navegador (a que já existia fica).
    if (!anterior) await inscricao.unsubscribe().catch(() => false);
    throw e;
  }
  return 'ativada';
}

/** Desativa neste aparelho: avisa o servidor primeiro (se falhar, a inscrição fica e dá para tentar de novo) e cancela. */
export async function desativarNesteAparelho(): Promise<void> {
  const inscricao = await inscricaoDesteAparelho();
  if (!inscricao) return;
  await removerAssinaturaNoServidor(inscricao.endpoint);
  await inscricao.unsubscribe().catch(() => false);
}

/**
 * Ao sair deste aparelho (G-39): remove a inscrição no servidor e no navegador ANTES de revogar a sessão (o DELETE
 * precisa dela). Nada aqui impede a saída: falha de rede ou de navegador é registrada e a saída segue; um endpoint que
 * ficar no servidor é limpo pelo envio (404/410) ou pela limpeza diária.
 */
export async function removerInscricaoAoSair(): Promise<void> {
  const inscricao = await inscricaoDesteAparelho();
  if (!inscricao) return;
  try {
    await removerAssinaturaNoServidor(inscricao.endpoint, true);
  } catch (e) {
    console.warn('push_remocao_no_servidor_falhou', (e as { tipo?: unknown } | null)?.tipo);
  }
  await inscricao.unsubscribe().catch(() => false);
}

/** Cancela só a inscrição do navegador (o servidor já removeu, ou a sessão acabou): "sair de todos" e exclusão de conta. */
export async function cancelarInscricaoLocal(): Promise<void> {
  const inscricao = await inscricaoDesteAparelho();
  await inscricao?.unsubscribe().catch(() => false);
}

registrarLimpeza(cancelarInscricaoLocal);

/** `GET /api/notificacoes/preferencias`. */
export function buscarPreferencias(): Promise<Preferencias> {
  return chamar<Preferencias>('GET', '/api/notificacoes/preferencias', undefined, { saida: 'Preferencias' });
}

/** `PUT /api/notificacoes/preferencias` com o objeto completo (204). */
export async function salvarPreferencias(preferencias: Preferencias): Promise<void> {
  await chamar('PUT', '/api/notificacoes/preferencias', preferencias);
}
