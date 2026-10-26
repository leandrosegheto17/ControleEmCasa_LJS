import { describe, expect, it } from 'vitest';
import { montarConteudo } from './infraestrutura/email';

/**
 * E-mails da exclusão de conta (RN-26; CA-26.7; RNF-15 "e-mails sem dado financeiro"; G-36; TM-RES-02).
 * O nome é texto do usuário: escapado no HTML e nunca vira link; o único link clicável é o montado pela API.
 */
const LINK = 'https://app.exemplo/confirmar-exclusao#t=abc';
const NOME_HOSTIL = '<a href="https://golpe.exemplo">Banco</a> visite https://golpe.exemplo';

describe('modelo exclusao', () => {
  it('leva o link de 30 min, explica o efeito da confirmação e diz o que fazer se não foi você', () => {
    const c = montarConteudo('exclusao', { nome: 'Ana', link: LINK });
    expect(c.assunto).toMatch(/exclusão/i);
    expect(c.texto).toContain(LINK);
    expect(c.texto).toMatch(/30 minutos/);
    expect(c.texto).toMatch(/apagados em 30 dias/);
    expect(c.texto).toMatch(/Se não foi você/);
    expect([...c.html.matchAll(/<a /g)]).toHaveLength(1);
    expect(c.html).toContain(`href="${LINK}"`);
  });

  it('nome hostil é escapado e não vira link', () => {
    const c = montarConteudo('exclusao', { nome: NOME_HOSTIL, link: LINK });
    expect(c.html).not.toContain('https://golpe.exemplo');
    expect(c.texto).not.toContain('https://golpe.exemplo');
    expect([...c.html.matchAll(/<a /g)]).toHaveLength(1);
    expect(c.assunto).not.toContain('<');
  });
});

describe('modelo lar_encerrado (D1, CA-26.7)', () => {
  const dados = { nome: 'Bia', dataPurga: '2026-11-23', link: 'https://app.exemplo/app' };

  it('diz com clareza que o lar, o conjunto e o individual do membro somem na data da purga (dd/mm/aaaa)', () => {
    const c = montarConteudo('lar_encerrado', dados);
    expect(c.assunto).toMatch(/encerrado/i);
    expect(c.texto).toContain('23/11/2026');
    expect(c.texto).toMatch(/conjuntos/);
    expect(c.texto).toMatch(/dados individuais/);
    expect(c.texto).toMatch(/lar novo e vazio/);
    expect(c.html).toContain('23/11/2026');
  });

  it('sem valor nem e-mail de ninguém; nome hostil escapado', () => {
    const c = montarConteudo('lar_encerrado', { ...dados, nome: NOME_HOSTIL });
    expect(c.texto).not.toMatch(/R\$|@/);
    expect(c.html).not.toContain('https://golpe.exemplo');
    expect([...c.html.matchAll(/<a /g)]).toHaveLength(1);
  });
});
