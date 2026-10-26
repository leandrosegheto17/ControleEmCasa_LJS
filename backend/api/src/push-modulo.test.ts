import { describe, expect, it, vi } from 'vitest';
import {
  chavePublica,
  configVapidValida,
  enviarPush,
  gerarParVapid,
  MAX_MENSAGEM_BYTES,
  VALIDADE_JWT_SEGUNDOS,
  type AssinaturaPush,
  type CargaPush,
  type ConfigVapid,
} from './infraestrutura/push';
import { deBase64Url, juntar, paraBase64Url, texto } from './infraestrutura/push/base64url';
import { cifrarAes128gcm } from './infraestrutura/push/cifra';

/**
 * Módulo isolado de Web Push (SDD 2.2; RN-27; G-46; TM-PUSH-03; ADR-014). O `fetch` é falso: nada sai para um serviço
 * de push. As chaves VAPID e as do "navegador" são geradas na hora; a criptografia é conferida com os vetores do
 * RFC 8291, apêndice A.
 */

const fontesPush = import.meta.glob('./infraestrutura/push/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('fronteira do módulo de push', () => {
  it('não importa nada fora da própria pasta (nem banco, nem Hono, nem o resto da API)', () => {
    const arquivos = Object.entries(fontesPush).filter(([c]) => !c.endsWith('.test.ts'));
    expect(arquivos.length).toBeGreaterThanOrEqual(5);
    for (const [caminho, codigo] of arquivos) {
      const imports = [...codigo.matchAll(/(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const alvo of imports) expect(alvo, `${caminho} importa ${alvo}`).toMatch(/^\.\/[^/]+$/);
    }
  });

  it('não usa SDK nem registra nada: só fetch e crypto.subtle', () => {
    const codigo = Object.values(fontesPush).join('\n');
    expect(codigo).not.toMatch(/from\s+['"]web-push/);
    expect(codigo).not.toMatch(/\bconsole\./);
    expect(codigo).not.toMatch(/from\s+['"]node:/);
  });
});

// RFC 8291, apêndice A.
const RFC = {
  mensagem: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPublica: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivada: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublica: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  sal: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  resultado:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};

describe('criptografia aes128gcm (RFC 8291)', () => {
  it('reproduz byte a byte o exemplo do apêndice A', async () => {
    const r = await cifrarAes128gcm(deBase64Url(RFC.mensagem), RFC.uaPublica, RFC.auth, {
      privadaEfemera: RFC.asPrivada,
      publicaEfemera: RFC.asPublica,
      sal: RFC.sal,
    });
    expect(paraBase64Url(r)).toBe(RFC.resultado);
  });

  it('sem material fixo, usa chave efêmera e sal novos a cada mensagem, e o navegador decifra', async () => {
    const navegador = await navegadorFalso();
    const msg = texto('{"titulo":"Teste"}');
    const a = await cifrarAes128gcm(msg, navegador.p256dh, navegador.auth);
    const b = await cifrarAes128gcm(msg, navegador.p256dh, navegador.auth);
    expect(paraBase64Url(a.subarray(0, 16))).not.toBe(paraBase64Url(b.subarray(0, 16)));
    expect(paraBase64Url(a.subarray(21, 86))).not.toBe(paraBase64Url(b.subarray(21, 86)));
    expect(new TextDecoder().decode(await navegador.decifrar(a))).toBe('{"titulo":"Teste"}');
  });

  it('recusa chaves do navegador malformadas e mensagem que não cabe num registro', async () => {
    const navegador = await navegadorFalso();
    await expect(cifrarAes128gcm(texto('x'), 'curta', navegador.auth)).rejects.toThrow();
    await expect(cifrarAes128gcm(texto('x'), navegador.p256dh, 'AAAA')).rejects.toThrow();
    await expect(
      cifrarAes128gcm(new Uint8Array(MAX_MENSAGEM_BYTES + 1), navegador.p256dh, navegador.auth),
    ).rejects.toThrow();
    await expect(
      cifrarAes128gcm(new Uint8Array(MAX_MENSAGEM_BYTES), navegador.p256dh, navegador.auth),
    ).resolves.toBeInstanceOf(Uint8Array);
  });
});

/** Um "navegador": par ECDH P-256 e segredo de 16 bytes; decifra como o RFC 8291 manda. */
async function navegadorFalso() {
  const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
  const par = (await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
  const publica = new Uint8Array((await crypto.subtle.exportKey('raw', par.publicKey)) as ArrayBuffer);
  const segredo = crypto.getRandomValues(new Uint8Array(16));
  const hkdf = async (
    ikm: Uint8Array<ArrayBuffer>,
    sal: Uint8Array<ArrayBuffer>,
    info: string | Uint8Array<ArrayBuffer>,
    n: number,
  ) => {
    const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const i = typeof info === 'string' ? texto(info) : info;
    return new Uint8Array(
      await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info: i }, k, n * 8),
    );
  };
  return {
    p256dh: paraBase64Url(publica),
    auth: paraBase64Url(segredo),
    async decifrar(corpo: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
      const sal = corpo.slice(0, 16);
      const rs = new DataView(corpo.buffer, corpo.byteOffset).getUint32(16);
      expect(rs).toBe(4096);
      expect(corpo[20]).toBe(65);
      const asPublica = corpo.slice(21, 86);
      const as = await crypto.subtle.importKey('raw', asPublica, ECDH, false, []);
      const algoritmo = { name: 'ECDH', public: as } as unknown as SubtleCryptoDeriveKeyAlgorithm;
      const ecdh = new Uint8Array(await crypto.subtle.deriveBits(algoritmo, par.privateKey, 256));
      const ikm = await hkdf(ecdh, segredo, juntar(texto('WebPush: info\0'), publica, asPublica), 32);
      const cek = await hkdf(ikm, sal, 'Content-Encoding: aes128gcm\0', 16);
      const nonce = await hkdf(ikm, sal, 'Content-Encoding: nonce\0', 12);
      const chave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
      const claro = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, chave, corpo.slice(86)),
      );
      expect(claro.at(-1)).toBe(0x02);
      return claro.slice(0, -1);
    },
  };
}

async function vapidDeTeste(): Promise<ConfigVapid> {
  const par = await gerarParVapid();
  return { ...par, assunto: 'mailto:operacao@exemplo.com' };
}

describe('VAPID (RFC 8292)', () => {
  it('gera um par no formato do SDD 11.2: pública de 65 bytes e privada de 32, base64url', async () => {
    const v = await vapidDeTeste();
    expect(v.chavePublica).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(deBase64Url(v.chavePublica)[0]).toBe(0x04);
    expect(v.chavePrivada).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(configVapidValida(v)).toBe(true);
    expect(chavePublica(v)).toBe(v.chavePublica);
  });

  it('configuração malformada é recusada (pública curta, privada errada, contato sem mailto/https)', async () => {
    const v = await vapidDeTeste();
    expect(configVapidValida({ ...v, chavePublica: v.chavePublica.slice(1) })).toBe(false);
    expect(configVapidValida({ ...v, chavePrivada: 'abc' })).toBe(false);
    expect(configVapidValida({ ...v, assunto: 'operacao@exemplo.com' })).toBe(false);
    expect(configVapidValida({ ...v, assunto: 'http://exemplo.com' })).toBe(false);
    expect(() => chavePublica({ ...v, chavePrivada: 'abc' })).toThrow();
  });
});

const CARGA: CargaPush = { titulo: 'Conta fixa vencendo', corpo: 'Uma despesa fixa vence amanhã.', url: '/app/fixas' };
const AGORA = new Date('2026-10-26T12:00:00.000Z');

interface Chamada {
  url: string;
  headers: Headers;
  corpo: Uint8Array<ArrayBuffer>;
}

function fetchFalso(resposta: Response | Error) {
  const chamadas: Chamada[] = [];
  const f = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({
      url: String(entrada),
      headers: new Headers(init?.headers),
      corpo: new Uint8Array(init?.body as Uint8Array<ArrayBuffer>),
    });
    if (resposta instanceof Error) throw resposta;
    return resposta.clone();
  }) as typeof fetch;
  return { f, chamadas };
}

async function preparar(endpoint = 'https://fcm.googleapis.com/fcm/send/abc') {
  const navegador = await navegadorFalso();
  const assinatura: AssinaturaPush = { endpoint, p256dh: navegador.p256dh, auth: navegador.auth };
  return { navegador, assinatura, vapid: await vapidDeTeste() };
}

describe('enviarPush', () => {
  it('POST no endpoint com JWT ES256 válido (aud = origem, exp ≤ 12 h, sub mailto), aes128gcm, TTL, Urgency e Topic', async () => {
    const { navegador, assinatura, vapid } = await preparar();
    const { f, chamadas } = fetchFalso(new Response(null, { status: 201 }));
    const r = await enviarPush(assinatura, CARGA, vapid, {
      fetch: f,
      agora: AGORA,
      ttlSegundos: 3600,
      urgencia: 'high',
      topico: 'fixa-vencendo',
    });
    expect(r).toBe('ok');
    expect(chamadas).toHaveLength(1);
    const c = chamadas[0]!;
    expect(c.url).toBe(assinatura.endpoint);
    expect(c.headers.get('Content-Encoding')).toBe('aes128gcm');
    expect(c.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(c.headers.get('TTL')).toBe('3600');
    expect(c.headers.get('Urgency')).toBe('high');
    expect(c.headers.get('Topic')).toBe('fixa-vencendo');

    const auth = c.headers.get('Authorization')!;
    const achado = auth.match(/^vapid t=([^,]+), k=([A-Za-z0-9_-]+)$/);
    expect(achado).not.toBeNull();
    const [, jwt, k] = achado!;
    expect(k).toBe(vapid.chavePublica);
    const [cab, corpo, assin] = jwt!.split('.') as [string, string, string];
    expect(JSON.parse(new TextDecoder().decode(deBase64Url(cab)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    const claims = JSON.parse(new TextDecoder().decode(deBase64Url(corpo))) as Record<string, unknown>;
    expect(claims).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: Math.floor(AGORA.getTime() / 1000) + VALIDADE_JWT_SEGUNDOS,
      sub: 'mailto:operacao@exemplo.com',
    });
    expect(VALIDADE_JWT_SEGUNDOS).toBeLessThanOrEqual(12 * 60 * 60);
    // A assinatura confere com a chave pública VAPID (r || s, 64 bytes).
    const publica = await crypto.subtle.importKey(
      'raw',
      deBase64Url(vapid.chavePublica),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const assinatura64 = deBase64Url(assin);
    expect(assinatura64.length).toBe(64);
    expect(
      await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publica, assinatura64, texto(`${cab}.${corpo}`)),
    ).toBe(true);
    // Outra chave não confere.
    const outra = await vapidDeTeste();
    const publicaOutra = await crypto.subtle.importKey(
      'raw',
      deBase64Url(outra.chavePublica),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    expect(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicaOutra,
        assinatura64,
        texto(`${cab}.${corpo}`),
      ),
    ).toBe(false);

    // O navegador decifra a carga: só título, texto e caminho.
    const claro = JSON.parse(new TextDecoder().decode(await navegador.decifrar(c.corpo))) as unknown;
    expect(claro).toEqual(CARGA);
  });

  it('padrões: TTL 12 h, Urgency normal, sem Topic; Topic inválido é omitido', async () => {
    const { assinatura, vapid } = await preparar();
    const { f, chamadas } = fetchFalso(new Response(null, { status: 201 }));
    await enviarPush(assinatura, CARGA, vapid, { fetch: f });
    await enviarPush(assinatura, CARGA, vapid, { fetch: f, topico: 'tópico com espaço' });
    expect(chamadas[0]!.headers.get('TTL')).toBe(String(12 * 60 * 60));
    expect(chamadas[0]!.headers.get('Urgency')).toBe('normal');
    expect(chamadas[0]!.headers.has('Topic')).toBe(false);
    expect(chamadas[1]!.headers.has('Topic')).toBe(false);
  });

  it('o aud é a origem do serviço do endpoint (Mozilla, Apple)', async () => {
    for (const [endpoint, aud] of [
      ['https://updates.push.services.mozilla.com/wpush/v2/x', 'https://updates.push.services.mozilla.com'],
      ['https://web.push.apple.com/QGu', 'https://web.push.apple.com'],
    ] as const) {
      const { assinatura, vapid } = await preparar(endpoint);
      const { f, chamadas } = fetchFalso(new Response(null, { status: 201 }));
      await enviarPush(assinatura, CARGA, vapid, { fetch: f });
      const jwt = chamadas[0]!.headers.get('Authorization')!.match(/t=([^,]+)/)![1]!;
      const claims = JSON.parse(new TextDecoder().decode(deBase64Url(jwt.split('.')[1]!))) as { aud: string };
      expect(claims.aud).toBe(aud);
    }
  });

  it.each([
    [200, 'ok'],
    [201, 'ok'],
    [202, 'ok'],
    [404, 'expirada'],
    [410, 'expirada'],
    [400, 'falha'],
    [401, 'falha'],
    [403, 'falha'],
    [413, 'falha'],
    [429, 'falha'],
    [500, 'falha'],
    [503, 'falha'],
  ] as const)('status %i → %s', async (status, esperado) => {
    const { assinatura, vapid } = await preparar();
    const { f } = fetchFalso(new Response('detalhe do serviço', { status }));
    expect(await enviarPush(assinatura, CARGA, vapid, { fetch: f })).toBe(esperado);
  });

  it('erro de rede, endpoint http, chaves do navegador inválidas e VAPID inválido viram `falha`, sem lançar', async () => {
    const { assinatura, vapid } = await preparar();
    expect(await enviarPush(assinatura, CARGA, vapid, { fetch: fetchFalso(new TypeError('rede')).f })).toBe('falha');
    const ok = fetchFalso(new Response(null, { status: 201 }));
    expect(
      await enviarPush({ ...assinatura, endpoint: 'http://fcm.googleapis.com/x' }, CARGA, vapid, { fetch: ok.f }),
    ).toBe('falha');
    expect(await enviarPush({ ...assinatura, p256dh: 'B' + 'A'.repeat(86) }, CARGA, vapid, { fetch: ok.f })).toBe(
      'falha',
    );
    expect(await enviarPush(assinatura, CARGA, { ...vapid, chavePrivada: 'abc' }, { fetch: ok.f })).toBe('falha');
    expect(ok.chamadas).toHaveLength(0);
  });

  it('não escreve nada no console (o endpoint e as chaves nunca vão a log; G-46)', async () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    const { assinatura, vapid } = await preparar();
    await enviarPush(assinatura, CARGA, vapid, { fetch: fetchFalso(new TypeError('rede')).f });
    await enviarPush(assinatura, CARGA, vapid, { fetch: fetchFalso(new Response(null, { status: 410 })).f });
    for (const e of espioes) {
      expect(e).not.toHaveBeenCalled();
      e.mockRestore();
    }
  });
});
