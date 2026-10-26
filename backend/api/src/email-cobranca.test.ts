import { describe, expect, it } from 'vitest';
import { montarConteudo } from './infraestrutura/email';

/** E-mails de cobrança (RN-24: cobrança gerada, pagamento confirmado, atraso; G-36; CA-24.9). */

const LINK = 'https://app.exemplo/app/ajustes/plano';
const NOME = '<b>Ana</b> visite golpe.exemplo';

describe('modelos de cobrança', () => {
  it('cobrança gerada: valor em reais, vencimento em DD/MM/AAAA e o link de Meu plano', () => {
    const c = montarConteudo('cobranca_gerada', {
      nome: 'Ana',
      valorCentavos: 990,
      vencimento: '2026-11-24',
      link: LINK,
    });
    expect(c.assunto).toContain('cobrança');
    expect(c.texto).toContain('R$ 9,90');
    expect(c.texto).toContain('24/11/2026');
    expect(c.texto).toContain(LINK);
    expect(c.html).toContain(`href="${LINK}"`);
  });

  it('pagamento confirmado', () => {
    const c = montarConteudo('pagamento_confirmado', { nome: 'Ana', valorCentavos: 990, link: LINK });
    expect(c.assunto).toBe('Pagamento confirmado no Controle em Casa');
    expect(c.texto).toContain('Recebemos o pagamento de R$ 9,90');
  });

  it('atraso: diz o vencimento, a carência de 3 dias e que nada é apagado', () => {
    const c = montarConteudo('atraso', { nome: 'Ana', vencimento: '2026-11-24', diasCarencia: 3, link: LINK });
    expect(c.assunto).toContain('atraso');
    expect(c.texto).toContain('24/11/2026');
    expect(c.texto).toContain('3 dias');
    expect(c.texto).toContain('nada é apagado');
  });

  it('valores grandes ganham separador de milhar', () => {
    const c = montarConteudo('pagamento_confirmado', { nome: 'Ana', valorCentavos: 123_456_78, link: LINK });
    expect(c.texto).toContain('R$ 123.456,78');
  });

  it('o nome do titular é escapado e nunca vira link; só o link da API é clicável (G-36)', () => {
    for (const modelo of ['cobranca_gerada', 'pagamento_confirmado', 'atraso'] as const) {
      const dados = { nome: NOME, valorCentavos: 990, vencimento: '2026-11-24', diasCarencia: 3, link: LINK };
      const c = montarConteudo(modelo, dados);
      expect(c.html).not.toContain('<b>Ana</b>');
      expect(c.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
      expect(c.texto).not.toContain('golpe.exemplo');
      expect([...c.html.matchAll(/<a /g)]).toHaveLength(1);
      expect(c.assunto).not.toContain('Ana');
    }
  });
});
