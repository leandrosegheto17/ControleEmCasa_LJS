import { describe, expect, it } from 'vitest';
import {
  endpointPushPermitido,
  entrada,
  LEMBRETE_HORA_PADRAO,
  MAX_ASSINATURAS_PUSH,
  PREFERENCIAS_PADRAO,
  saida,
} from './index';

/** Critérios: RN-27 (preferências e padrões), CA-27.8 (horário), SDD 3.6 (endpoint https, 1024), TM-PUSH-04. */

const P256DH = 'B' + 'A'.repeat(86);
const AUTH = 'a'.repeat(22);
const FCM = 'https://fcm.googleapis.com/fcm/send/abc123';

describe('endpointPushPermitido', () => {
  it('aceita os serviços de push dos navegadores', () => {
    for (const e of [
      FCM,
      'https://android.googleapis.com/gcm/send/x',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
      'https://web.push.apple.com/QGuQyavXutnMH',
      'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB',
    ]) {
      expect(endpointPushPermitido(e), e).toBe(true);
    }
  });

  it('recusa http, outro host, host parecido, porta, credencial na URL e tamanho acima de 1024', () => {
    for (const e of [
      'http://fcm.googleapis.com/fcm/send/x',
      'https://exemplo.com/push',
      'https://fcm.googleapis.com.exemplo.com/x',
      'https://evilpush.apple.com.exemplo.com/x',
      'https://push.apple.com/x',
      'https://fcm.googleapis.com:8443/x',
      'https://usuario:senha@fcm.googleapis.com/x',
      'https://127.0.0.1/x',
      'não é url',
      `${FCM}/${'x'.repeat(1024)}`,
    ]) {
      expect(endpointPushPermitido(e), e).toBe(false);
    }
  });
});

describe('entrada.AssinaturaPush', () => {
  it('aceita o PushSubscription do navegador', () => {
    expect(entrada.AssinaturaPush.safeParse({ endpoint: FCM, keys: { p256dh: P256DH, auth: AUTH } }).success).toBe(
      true,
    );
  });

  it('recusa endpoint fora da lista, chaves malformadas e campos extras (inclusive dono vindo do corpo)', () => {
    const base = { endpoint: FCM, keys: { p256dh: P256DH, auth: AUTH } };
    expect(entrada.AssinaturaPush.safeParse({ ...base, endpoint: 'https://exemplo.com/x' }).success).toBe(false);
    expect(entrada.AssinaturaPush.safeParse({ ...base, keys: { p256dh: 'curta', auth: AUTH } }).success).toBe(false);
    expect(entrada.AssinaturaPush.safeParse({ ...base, keys: { p256dh: P256DH, auth: 'a+b/' } }).success).toBe(false);
    expect(entrada.AssinaturaPush.safeParse({ ...base, usuario_id: 'outro' }).success).toBe(false);
    expect(entrada.AssinaturaPush.safeParse({ ...base, expirationTime: null }).success).toBe(false);
    expect(entrada.AssinaturaPush.safeParse({ endpoint: FCM }).success).toBe(false);
  });
});

describe('entrada.RemoverAssinaturaPush', () => {
  it('leva só o endpoint', () => {
    expect(entrada.RemoverAssinaturaPush.safeParse({ endpoint: FCM }).success).toBe(true);
    expect(entrada.RemoverAssinaturaPush.safeParse({ endpoint: '' }).success).toBe(false);
    expect(entrada.RemoverAssinaturaPush.safeParse({ endpoint: FCM, membro_id: 'x' }).success).toBe(false);
  });
});

describe('preferências (RN-27, CA-27.8)', () => {
  it('padrões: fixas e metas ligadas, lembrete desligado às 20h', () => {
    expect(PREFERENCIAS_PADRAO).toEqual({ fixas: true, lembrete_diario: false, lembrete_hora: 20, metas: true });
    expect(LEMBRETE_HORA_PADRAO).toBe(20);
    expect(saida.Preferencias.safeParse(PREFERENCIAS_PADRAO).success).toBe(true);
  });

  it('a hora do lembrete vai de 0 a 23, inteira; todos os campos são obrigatórios', () => {
    const ok = { ...PREFERENCIAS_PADRAO };
    expect(entrada.Preferencias.safeParse({ ...ok, lembrete_hora: 0 }).success).toBe(true);
    expect(entrada.Preferencias.safeParse({ ...ok, lembrete_hora: 23 }).success).toBe(true);
    expect(entrada.Preferencias.safeParse({ ...ok, lembrete_hora: 24 }).success).toBe(false);
    expect(entrada.Preferencias.safeParse({ ...ok, lembrete_hora: -1 }).success).toBe(false);
    expect(entrada.Preferencias.safeParse({ ...ok, lembrete_hora: 8.5 }).success).toBe(false);
    expect(entrada.Preferencias.safeParse({ fixas: true }).success).toBe(false);
    expect(entrada.Preferencias.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });
});

describe('saida.ChavePush', () => {
  it('é a chave pública VAPID em base64url (65 bytes)', () => {
    expect(saida.ChavePush.safeParse({ chave_publica: P256DH }).success).toBe(true);
    expect(saida.ChavePush.safeParse({ chave_publica: 'x' }).success).toBe(false);
  });
});

it('limite de aparelhos por usuário', () => expect(MAX_ASSINATURAS_PUSH).toBe(10));
