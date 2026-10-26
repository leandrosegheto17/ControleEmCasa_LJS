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

  // Motivo da mudança (etapa 15): o `scheduled` chegou. Os casos de uso dos crons (`aplicacao/agendadas/`: avisos de
  // push e limpeza diária) também abrem a transação de sistema, como o SDD 5.3 prevê; o "meta atingida" usa o mesmo
  // caso de uso, depois do COMMIT da rota (SDD 8.6). Nenhuma rota (`entrada/rotas/`) abre ou grava o contexto.
  it('só o webhook e os casos de uso agendados abrem transação de sistema; nenhuma rota de usuário', () => {
    const quem = producao
      .filter(
        ([caminho, c]) =>
          caminho !== './infraestrutura/db/transacao.ts' && /emTransacaoDeSistema\s*\(/.test(semComentarios(c)),
      )
      .map(([caminho]) => caminho)
      .sort();
    expect(quem).toEqual([
      './aplicacao/agendadas/limpeza.ts',
      './aplicacao/agendadas/push.ts',
      './aplicacao/plano/webhook.ts',
    ]);
    expect(quem.filter((c) => c.startsWith('./entrada/'))).toEqual([]);
  });
});
