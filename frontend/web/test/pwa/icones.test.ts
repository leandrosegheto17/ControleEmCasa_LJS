// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ICONES = new URL('../../public/icones/', import.meta.url);
const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Lê largura, altura e tipo de cor do chunk IHDR (logo após a assinatura). */
function lerIhdr(nome: string) {
  const b = readFileSync(new URL(nome, ICONES));
  expect(b.subarray(0, 8).equals(ASSINATURA_PNG), `${nome} não é PNG`).toBe(true);
  expect(b.toString('ascii', 12, 16)).toBe('IHDR');
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20), tipoCor: b.readUInt8(25) };
}

function temTransparencia(nome: string): boolean {
  const b = readFileSync(new URL(nome, ICONES));
  const { tipoCor } = lerIhdr(nome);
  return tipoCor === 4 || tipoCor === 6 || b.includes(Buffer.from('tRNS', 'ascii'));
}

describe('ícones do PWA', () => {
  it.each([
    ['icone-192.png', 192],
    ['icone-512.png', 512],
    ['icone-maskable-512.png', 512],
    ['apple-touch-icon.png', 180],
  ])('%s existe com %ipx', (nome, lado) => {
    expect(existsSync(new URL(nome, ICONES)), nome).toBe(true);
    const { largura, altura } = lerIhdr(nome);
    expect([largura, altura]).toEqual([lado, lado]);
  });

  it('apple-touch-icon não tem canal alfa', () => {
    expect(temTransparencia('apple-touch-icon.png')).toBe(false);
  });

  it('a fonte versionada dos ícones existe', () => {
    expect(existsSync(new URL('../../assets/icone.svg', import.meta.url))).toBe(true);
  });
});
