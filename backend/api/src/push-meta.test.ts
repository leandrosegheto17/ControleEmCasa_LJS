import { describe, expect, it, vi } from 'vitest';
import { MENSAGENS } from './aplicacao/agendadas/push';
import { criarApp } from './app';
import { emTransacao } from './middleware/transacao';
import { bancoDisponivel } from './testes-suporte';
import { larParaCadastros } from './testes-suporte-cadastros';
import { pedir, pessoa } from './testes-suporte-lar';
import { criarMeta, movimentar, movimentarOk } from './testes-suporte-orcamento-metas';
import { enviadorFalso, inscreverOk } from './testes-suporte-push';

/**
 * "Meta atingida" (RN-27; SDD 8.6; CA-27.3, CA-27.4, CA-27.5, CA-27.7; TM-PUSH-05; ADR-014): sai depois do COMMIT do
 * aporte (ou da edição do alvo) que marca `atingida_em`, só para quem vê a meta. O envio é falso; a espera usa
 * `vi.waitFor`, porque o envio corre em `waitUntil`, fora da resposta.
 */

/** Espera curta para provar que NADA saiu (o trabalho depois do COMMIT leva alguns milissegundos). */
const ESPERA_NEGATIVA_MS = 1500;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function larComMetas(prefixo: string) {
  const falso = enviadorFalso();
  const l = await larParaCadastros(prefixo, { push: falso.enviar });
  const ana = await inscreverOk(l.app, l.titular);
  const bruno = await inscreverOk(l.app, l.membro);
  return { ...l, falso, aparelhos: { ana, bruno } };
}

describe.skipIf(!bancoDisponivel)('meta atingida', () => {
  it('meta conjunta atingida no aporte: os dois membros são avisados, com texto fixo', async () => {
    const l = await larComMetas('meta.conj');
    const meta = await criarMeta(l.app, l.titular, { nome: 'Viagem secreta', alvo_centavos: 5000, escopo: 'conjunto' });
    await movimentarOk(l.app, l.membro, meta, { valor_centavos: 4999 });
    await esperar(ESPERA_NEGATIVA_MS);
    expect(l.falso.envios).toEqual([]);
    await movimentarOk(l.app, l.membro, meta, { valor_centavos: 1 });
    await vi.waitFor(() => expect(l.falso.envios).toHaveLength(2), { timeout: 10_000 });
    expect(l.falso.envios.map((e) => e.endpoint).sort()).toEqual(
      [l.aparelhos.ana.endpoint, l.aparelhos.bruno.endpoint].sort(),
    );
    for (const e of l.falso.envios) {
      expect(e.carga).toEqual(MENSAGENS.meta_atingida.carga);
      expect(JSON.stringify(e.carga)).not.toMatch(/Viagem|secreta|5000|50,00/);
    }
  });

  it('meta individual de Ana atingida: só os aparelhos de Ana (CA-27.3; TM-PUSH-05)', async () => {
    const l = await larComMetas('meta.ind');
    const meta = await criarMeta(l.app, l.titular, { alvo_centavos: 1000, escopo: 'individual' });
    await movimentarOk(l.app, l.titular, meta, { valor_centavos: 1000 });
    await vi.waitFor(() => expect(l.falso.envios).toHaveLength(1), { timeout: 10_000 });
    await esperar(ESPERA_NEGATIVA_MS);
    expect(l.falso.envios.map((e) => e.endpoint)).toEqual([l.aparelhos.ana.endpoint]);
  });

  it('cair abaixo do alvo e atingir de novo no mesmo dia não repete o aviso (CA-27.4)', async () => {
    const l = await larComMetas('meta.repete');
    const meta = await criarMeta(l.app, l.titular, { alvo_centavos: 1000, escopo: 'individual' });
    await movimentarOk(l.app, l.titular, meta, { valor_centavos: 1000 });
    await vi.waitFor(() => expect(l.falso.envios).toHaveLength(1), { timeout: 10_000 });
    await movimentarOk(l.app, l.titular, meta, { tipo: 'retirada', valor_centavos: 500 });
    await movimentarOk(l.app, l.titular, meta, { valor_centavos: 500 });
    await esperar(ESPERA_NEGATIVA_MS);
    expect(l.falso.envios).toHaveLength(1);
  });

  it('quem desligou "metas" não recebe; o outro membro recebe (CA-27.5)', async () => {
    const l = await larComMetas('meta.pref');
    const r = await pedir(l.app, 'PUT', '/api/notificacoes/preferencias', l.membro, {
      fixas: true,
      lembrete_diario: false,
      lembrete_hora: 20,
      metas: false,
    });
    expect(r.status).toBe(204);
    const meta = await criarMeta(l.app, l.titular, { alvo_centavos: 1000, escopo: 'conjunto' });
    await movimentarOk(l.app, l.titular, meta, { valor_centavos: 1000 });
    await vi.waitFor(() => expect(l.falso.envios).toHaveLength(1), { timeout: 10_000 });
    await esperar(ESPERA_NEGATIVA_MS);
    expect(l.falso.envios.map((e) => e.endpoint)).toEqual([l.aparelhos.ana.endpoint]);
  });

  it('baixar o alvo até o guardado também é atingir: avisa', async () => {
    const l = await larComMetas('meta.alvo');
    const meta = await criarMeta(l.app, l.titular, { alvo_centavos: 5000, escopo: 'individual' });
    await movimentarOk(l.app, l.titular, meta, { valor_centavos: 2000 });
    const r = await pedir(l.app, 'PUT', `/api/metas/${meta}`, l.titular, { nome: 'Viagem', alvo_centavos: 2000 });
    expect(r.status).toBe(200);
    await vi.waitFor(() => expect(l.falso.envios).toHaveLength(1), { timeout: 10_000 });
  });

  it('o trabalho de depois do COMMIT só roda com COMMIT: resposta de erro (ROLLBACK) não dispara nada', async () => {
    let rodou = 0;
    const app = criarApp({
      rotas: (a) => {
        a.post('/api/teste-apos-commit/:status', emTransacao, async (c) => {
          c.get('aposCommit').push(async () => {
            rodou += 1;
          });
          return c.json({}, Number(c.req.param('status')) as 200);
        });
      },
    });
    const p = await pessoa('apos.commit');
    expect((await pedir(app, 'POST', '/api/teste-apos-commit/422', p, {})).status).toBe(422);
    expect((await pedir(app, 'POST', '/api/teste-apos-commit/500', p, {})).status).toBe(500);
    await esperar(ESPERA_NEGATIVA_MS);
    expect(rodou).toBe(0);
    expect((await pedir(app, 'POST', '/api/teste-apos-commit/200', p, {})).status).toBe(200);
    await vi.waitFor(() => expect(rodou).toBe(1), { timeout: 10_000 });
  });

  it('retirada recusada (422) não avisa', async () => {
    const l = await larComMetas('meta.recusa');
    const meta = await criarMeta(l.app, l.titular, { alvo_centavos: 1000, escopo: 'individual' });
    const r = await movimentar(l.app, l.titular, meta, { tipo: 'retirada', valor_centavos: 1 });
    expect(r.status).toBe(422);
    await esperar(ESPERA_NEGATIVA_MS);
    expect(l.falso.envios).toEqual([]);
  });
});
