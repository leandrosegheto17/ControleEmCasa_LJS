import { describe, expect, it } from 'vitest';
import { linhasVapid } from './gerar-vapid';

/** Script do par VAPID (etapa 15; SDD 11.2; G-32): imprime um par válido e novo a cada execução, sem gravar nada. */

function chaves(linhas: string[]) {
  return Object.fromEntries(linhas.map((l) => l.split('=') as [string, string]));
}

describe('gerar-vapid', () => {
  it('imprime as três variáveis no formato do .dev.vars, com o par no formato do SDD 11.2', async () => {
    const v = chaves(await linhasVapid('mailto:operacao@exemplo.com'));
    expect(Object.keys(v)).toEqual(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']);
    expect(v['VAPID_PUBLIC_KEY']).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(Buffer.from(v['VAPID_PUBLIC_KEY']!, 'base64url')[0]).toBe(4);
    expect(v['VAPID_PRIVATE_KEY']).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(v['VAPID_SUBJECT']).toBe('mailto:operacao@exemplo.com');
  });

  it('o par combina: o que a privada assina, a pública confere', async () => {
    const v = chaves(await linhasVapid());
    const publica = Buffer.from(v['VAPID_PUBLIC_KEY']!, 'base64url');
    const privada = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: v['VAPID_PRIVATE_KEY'],
        x: publica.subarray(1, 33).toString('base64url'),
        y: publica.subarray(33).toString('base64url'),
      },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const dado = new TextEncoder().encode('teste');
    const assinatura = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privada, dado);
    const verificadora = await crypto.subtle.importKey('raw', publica, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ]);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verificadora, assinatura, dado)).toBe(true);
  });

  it('cada execução gera um par novo (nenhuma chave fixa no código)', async () => {
    const a = chaves(await linhasVapid());
    const b = chaves(await linhasVapid());
    expect(a['VAPID_PRIVATE_KEY']).not.toBe(b['VAPID_PRIVATE_KEY']);
    expect(a['VAPID_PUBLIC_KEY']).not.toBe(b['VAPID_PUBLIC_KEY']);
  });

  it('contato sem mailto/https é recusado', async () => {
    await expect(linhasVapid('contato@exemplo.com')).rejects.toThrow();
  });
});
