import { describe, expect, it } from 'vitest';
import { montarConteudo } from './infraestrutura/email';

/**
 * E-mail do convite (RN-23 "não revela dado financeiro; só o nome do titular e o link"; G-36; TM-RES-02).
 * O nome do titular é texto do usuário: escapado no HTML, nunca vira link, e fica fora do assunto.
 */
const LINK = 'https://app.exemplo/convite#t=abc';

describe('modelo convite', () => {
  it('leva o nome do titular e o único link clicável é o da API', () => {
    const c = montarConteudo('convite', { nomeTitular: 'Ana', link: LINK });
    expect(c.texto).toContain('Ana');
    expect(c.texto).toContain(LINK);
    expect(c.texto).toMatch(/7 dias/);
    expect([...c.html.matchAll(/<a /g)]).toHaveLength(1);
    expect(c.html).toContain(`href="${LINK}"`);
  });

  it('TM-RES-02: nome com HTML e URL é escapado e não vira link, nem no assunto', () => {
    const nome = '<a href="https://golpe.exemplo">Banco</a> visite https://golpe.exemplo';
    const c = montarConteudo('convite', { nomeTitular: nome, link: LINK });
    expect(c.html).not.toContain('<a href="https://golpe');
    expect(c.html).toContain('&lt;a href=');
    expect(c.html).not.toContain('https://golpe.exemplo');
    expect(c.texto).not.toContain('https://golpe.exemplo');
    expect([...c.html.matchAll(/<a /g)]).toHaveLength(1);
    expect(c.assunto).not.toContain('golpe');
    expect(c.assunto).not.toContain('<');
  });

  it('não traz nome do lar, valor nem e-mail de ninguém (só o nome do titular e o link)', () => {
    const c = montarConteudo('convite', { nomeTitular: 'Ana', link: LINK });
    expect(c.texto).not.toMatch(/R\$|@/);
    expect(c.html).not.toMatch(/R\$|@/);
  });
});
