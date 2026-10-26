import { describe, expect, it } from 'vitest';

/**
 * SDD 5.3: `app.sistema` (webhook, cron, purga) só é gravado pelo webhook, pelo `scheduled` e pelo `purgar.ts`;
 * nenhuma rota de usuário o define. Varre os fontes de produção: só a transação de sistema grava o GUC e só o
 * caso de uso do webhook abre essa transação.
 */
const fontes = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;
const producao = Object.entries(fontes).filter(
  ([caminho]) => !caminho.endsWith('.test.ts') && !caminho.includes('testes-suporte'),
);

function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('varredura de app.sistema', () => {
  it("só infraestrutura/db/transacao.ts grava 'app.sistema'", () => {
    const quem = producao.filter(([, c]) => /'app\.sistema'/.test(semComentarios(c))).map(([caminho]) => caminho);
    expect(quem).toEqual(['./infraestrutura/db/transacao.ts']);
  });

  it('só o webhook abre transação de sistema; nenhuma rota de usuário', () => {
    const quem = producao
      .filter(
        ([caminho, c]) =>
          caminho !== './infraestrutura/db/transacao.ts' && /emTransacaoDeSistema\s*\(/.test(semComentarios(c)),
      )
      .map(([caminho]) => caminho);
    expect(quem).toEqual(['./aplicacao/plano/webhook.ts']);
  });
});
