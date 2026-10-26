import { env } from 'cloudflare:workers';
import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';
import { MENSAGENS, rodarAvisosDoCron, type DepsAvisos } from './aplicacao/agendadas/push';
import { lerConfigPush } from './config';
import { bancoDisponivel } from './testes-suporte';
import { comoOwner } from './testes-suporte-acesso';
import { criarFixa, larParaFixas, ocorrenciaDe, pagarOk } from './testes-suporte-fixas';
import { lancarDespesa } from './testes-suporte-lancamentos';
import { linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';
import { dbDoApp, enviadorFalso, inscreverOk, inscricoesNoBanco, type Navegador } from './testes-suporte-push';

/**
 * Cron de push (RN-27; SDD 8.6; CA-27.1, CA-27.2, CA-27.4, CA-27.5, CA-27.7, CA-27.8; TM-PUSH-01, TM-PUSH-06;
 * ADR-014). O cron roda de verdade contra o Postgres (lar a lar, no contexto de sistema), com um envio falso no
 * lugar do serviço de push. "Hoje" é 24/10/2026 em São Paulo; as horas são de São Paulo (UTC−3).
 * O banco é compartilhado: cada teste só olha os aparelhos que ele mesmo inscreveu.
 */

const em = (horaSaoPaulo: number, dia = '2026-10-24') =>
  new Date(`${dia}T${String(horaSaoPaulo + 3).padStart(2, '0')}:00:00.000Z`);
const AS_9H = em(9);

const vapid = lerConfigPush(env as unknown as Record<string, unknown>);
const db = dbDoApp();
afterAll(() => db.destroy());

function rodar(agora: Date, enviar: DepsAvisos['enviar'], extra: Partial<DepsAvisos> = {}) {
  return rodarAvisosDoCron({ db, agora, vapid, enviar, ...extra });
}

/** Lar com Ana e Bruno, cada um com um aparelho inscrito; o envio falso só olha esses aparelhos. */
async function larComAparelhos(prefixo: string, agora = AS_9H) {
  const l = await larParaFixas(prefixo, agora);
  const ana = await inscreverOk(l.app, l.titular);
  const bruno = await inscreverOk(l.app, l.membro);
  const meus = new Set([ana.endpoint, bruno.endpoint]);
  const falso = enviadorFalso(() => meus);
  return { ...l, aparelhos: { ana, bruno }, meus, falso };
}

const tipos = (envios: { carga: { titulo: string } }[]) => envios.map((e) => e.carga.titulo).sort();

describe.skipIf(!bancoDisponivel || !vapid)('fixa vencendo e atrasada (RN-27)', () => {
  it('fixa que vence amanhã: às 9h os dois membros recebem o aviso, uma vez por aparelho', async () => {
    const l = await larComAparelhos('cron.vence');
    await criarFixa(l.app, l.titular, { categoria_id: l.moradia, dia_vencimento: 25 });
    await rodar(AS_9H, l.falso.enviar);
    expect(l.falso.para(l.aparelhos.ana.endpoint).map((e) => e.carga)).toEqual([MENSAGENS.fixa_vencendo.carga]);
    expect(l.falso.para(l.aparelhos.bruno.endpoint).map((e) => e.carga)).toEqual([MENSAGENS.fixa_vencendo.carga]);
    expect(l.falso.envios[0]!.opcoes).toMatchObject({ topico: 'fixa-vencendo', urgencia: 'normal' });
  });

  it('rodar de novo (no mesmo horário ou depois, no mesmo dia) não repete o aviso (CA-27.4)', async () => {
    const l = await larComAparelhos('cron.repete');
    await criarFixa(l.app, l.titular, { categoria_id: l.moradia, dia_vencimento: 25 });
    await rodar(AS_9H, l.falso.enviar);
    await rodar(AS_9H, l.falso.enviar);
    await rodar(em(10), l.falso.enviar);
    expect(l.falso.envios).toHaveLength(2);
  });

  it('antes das 9h nada sai; a ocorrência paga antes do aviso não é avisada (CA-27.1)', async () => {
    const l = await larComAparelhos('cron.paga');
    const fixa = await criarFixa(l.app, l.titular, { categoria_id: l.moradia, dia_vencimento: 25 });
    await rodar(em(8), l.falso.enviar);
    expect(l.falso.envios).toEqual([]);
    const o = await ocorrenciaDe(l.app, l.titular, fixa, '2026-10-01');
    await pagarOk(l.app, l.titular, o.id, { forma_id: l.ana.pix });
    await rodar(AS_9H, l.falso.enviar);
    expect(l.falso.envios).toEqual([]);
  });

  it('fixa que venceu ontem sem pagamento: aviso de atraso, uma vez; a de dois dias atrás não', async () => {
    const l = await larComAparelhos('cron.atraso');
    await criarFixa(l.app, l.titular, { categoria_id: l.moradia, dia_vencimento: 23 });
    await rodar(AS_9H, l.falso.enviar);
    await rodar(em(15), l.falso.enviar);
    expect(tipos(l.falso.envios)).toEqual([MENSAGENS.fixa_atrasada.carga.titulo, MENSAGENS.fixa_atrasada.carga.titulo]);
    // No dia seguinte (já com 2 dias de atraso), não avisa de novo.
    await rodar(em(9, '2026-10-25'), l.falso.enviar);
    expect(l.falso.envios).toHaveLength(2);
  });

  it('quem desligou "fixas" não recebe em nenhum aparelho; o outro membro recebe (CA-27.5)', async () => {
    const l = await larComAparelhos('cron.pref');
    const segundo = await inscreverOk(l.app, l.membro);
    l.meus.add(segundo.endpoint);
    const r = await pedir(l.app, 'PUT', '/api/notificacoes/preferencias', l.membro, {
      fixas: false,
      lembrete_diario: false,
      lembrete_hora: 20,
      metas: true,
    });
    expect(r.status).toBe(204);
    await criarFixa(l.app, l.titular, { categoria_id: l.moradia, dia_vencimento: 25 });
    await rodar(AS_9H, l.falso.enviar);
    expect(l.falso.envios.map((e) => e.endpoint)).toEqual([l.aparelhos.ana.endpoint]);
  });

  it('o aviso do lar A não chega aos aparelhos do lar B (TM-PUSH-01); membro que saiu não recebe', async () => {
    const a = await larComAparelhos('cron.iso.a');
    const b = await larComAparelhos('cron.iso.b');
    await criarFixa(a.app, a.titular, { categoria_id: a.moradia, dia_vencimento: 25 });
    await comoOwner((d) => sql`update app.membro set saiu_em = now() where usuario_id = ${a.membro.id}`.execute(d));
    const todos = new Set([...a.meus, ...b.meus]);
    const falso = enviadorFalso(() => todos);
    await rodar(AS_9H, falso.enviar);
    expect(falso.envios.map((e) => e.endpoint)).toEqual([a.aparelhos.ana.endpoint]);
  });

  it('a carga é texto fixo: sem descrição, valor nem nome (CA-27.7; G-36)', async () => {
    const l = await larComAparelhos('cron.carga');
    await criarFixa(l.app, l.titular, {
      categoria_id: l.moradia,
      dia_vencimento: 25,
      descricao: 'Aluguel do apartamento secreto',
      valor_previsto_centavos: 987_654,
    });
    await rodar(AS_9H, l.falso.enviar);
    expect(l.falso.envios.length).toBeGreaterThan(0);
    for (const e of l.falso.envios) {
      const texto = JSON.stringify(e.carga);
      expect(Object.keys(e.carga).sort()).toEqual(['corpo', 'titulo', 'url']);
      expect(texto).not.toMatch(/secreto|Aluguel|9876|9\.876|R\$/);
      expect(texto).not.toContain(l.titular.nome);
      expect(texto).not.toContain(l.membro.nome);
      expect(e.carga.url).toMatch(/^\/app\//);
    }
  });
});

describe.skipIf(!bancoDisponivel || !vapid)('lembrete diário (RN-27; CA-27.2, CA-27.8)', () => {
  async function ligarLembrete(app: Parameters<typeof pedir>[0], quem: Pessoa, hora: number) {
    const r = await pedir(app, 'PUT', '/api/notificacoes/preferencias', quem, {
      fixas: true,
      lembrete_diario: true,
      lembrete_hora: hora,
      metas: true,
    });
    expect(r.status).toBe(204);
  }

  it('desligado (padrão): nada sai em hora nenhuma', async () => {
    const l = await larComAparelhos('lemb.padrao');
    for (const h of [0, 9, 20, 23]) await rodar(em(h), l.falso.enviar);
    expect(l.falso.envios).toEqual([]);
  });

  it('ligado às 20h: sai só às 20h, só para quem ligou, e uma vez no dia', async () => {
    const l = await larComAparelhos('lemb.20h');
    await ligarLembrete(l.app, l.titular, 20);
    await rodar(em(19), l.falso.enviar);
    expect(l.falso.envios).toEqual([]);
    await rodar(em(20), l.falso.enviar);
    await rodar(em(20), l.falso.enviar);
    await rodar(em(21), l.falso.enviar);
    expect(l.falso.envios.map((e) => [e.endpoint, e.carga])).toEqual([
      [l.aparelhos.ana.endpoint, MENSAGENS.lembrete_diario.carga],
    ]);
    // No dia seguinte, de novo às 20h.
    await rodar(em(20, '2026-10-25'), l.falso.enviar);
    expect(l.falso.envios).toHaveLength(2);
  });

  it('mudou o horário: vale só o novo (CA-27.8)', async () => {
    const l = await larComAparelhos('lemb.muda');
    await ligarLembrete(l.app, l.titular, 20);
    await ligarLembrete(l.app, l.titular, 7);
    await rodar(em(20), l.falso.enviar);
    expect(l.falso.envios).toEqual([]);
    await rodar(em(7, '2026-10-25'), l.falso.enviar);
    expect(l.falso.envios).toHaveLength(1);
  });

  it('quem já lançou no dia não recebe (CA-27.2); o lançamento do outro membro não conta', async () => {
    const l = await larComAparelhos('lemb.lancou');
    await ligarLembrete(l.app, l.titular, 20);
    await ligarLembrete(l.app, l.membro, 20);
    // Bruno lança hoje (às 9h, o relógio do app); Ana não.
    await lancarDespesa(l.app, l.membro, {
      valor_centavos: 1000,
      categoria_id: l.bruno.lazer,
      forma_id: l.bruno.pix,
    } as Parameters<typeof lancarDespesa>[2]);
    await rodar(em(20), l.falso.enviar);
    expect(l.falso.envios.map((e) => e.endpoint)).toEqual([l.aparelhos.ana.endpoint]);
  });
});

describe.skipIf(!bancoDisponivel || !vapid)('resultado do envio e lotes (SDD 3.6; TM-PUSH-06)', () => {
  it('inscrição recusada como expirada (404/410) é removida; as outras ficam', async () => {
    const l = await larComAparelhos('cron.expira');
    l.falso.responder(l.aparelhos.ana.endpoint, 'expirada');
    await criarFixa(l.app, l.titular, { categoria_id: l.moradia, dia_vencimento: 25 });
    await rodar(AS_9H, l.falso.enviar);
    expect(await inscricoesNoBanco({ endpoints: [l.aparelhos.ana.endpoint] })).toEqual([]);
    expect(await inscricoesNoBanco({ endpoints: [l.aparelhos.bruno.endpoint] })).toHaveLength(1);
  });

  it('falha soma; a 5ª falha seguida remove; envio aceito zera as falhas', async () => {
    const l = await larComAparelhos('cron.falhas');
    const definirFalhas = (nav: Navegador, n: number) =>
      comoOwner((d) => sql`update app.push_subscription set falhas = ${n} where endpoint = ${nav.endpoint}`.execute(d));
    await definirFalhas(l.aparelhos.ana, 4);
    await definirFalhas(l.aparelhos.bruno, 2);
    l.falso.responder(l.aparelhos.ana.endpoint, 'falha');
    l.falso.responder(l.aparelhos.bruno.endpoint, 'falha');
    await criarFixa(l.app, l.titular, { categoria_id: l.moradia, dia_vencimento: 25 });
    await rodar(AS_9H, l.falso.enviar);
    expect(await inscricoesNoBanco({ endpoints: [l.aparelhos.ana.endpoint] })).toEqual([]);
    expect((await inscricoesNoBanco({ endpoints: [l.aparelhos.bruno.endpoint] }))[0]!.falhas).toBe(3);
    // No dia seguinte (fixa atrasada), o envio passa: falhas zeram.
    l.falso.responder(l.aparelhos.bruno.endpoint, 'ok');
    await rodar(em(9, '2026-10-26'), l.falso.enviar);
    expect((await inscricoesNoBanco({ endpoints: [l.aparelhos.bruno.endpoint] }))[0]!.falhas).toBe(0);
  });

  it('erro de rede num aparelho não derruba o lote: os outros lares e aparelhos recebem', async () => {
    const a = await larComAparelhos('cron.rede.a');
    const b = await larComAparelhos('cron.rede.b');
    await criarFixa(a.app, a.titular, { categoria_id: a.moradia, dia_vencimento: 25 });
    await criarFixa(b.app, b.titular, { categoria_id: b.moradia, dia_vencimento: 25 });
    const todos = new Set([...a.meus, ...b.meus]);
    const falso = enviadorFalso(() => todos);
    falso.responder(a.aparelhos.ana.endpoint, 'lancar');
    falso.responder(b.aparelhos.ana.endpoint, 'lancar');
    const resumo = await rodar(AS_9H, falso.enviar);
    expect(falso.envios.map((e) => e.endpoint).sort()).toEqual([...todos].sort());
    expect(resumo.laresComErro).toBe(0);
    expect((await inscricoesNoBanco({ endpoints: [a.aparelhos.ana.endpoint] }))[0]!.falhas).toBe(1);
    expect((await inscricoesNoBanco({ endpoints: [a.aparelhos.bruno.endpoint] }))[0]!.falhas).toBe(0);
  });

  it('em lotes de 1 lar por página, todos os lares com aparelho são processados', async () => {
    const a = await larComAparelhos('cron.lote.a');
    const b = await larComAparelhos('cron.lote.b');
    await criarFixa(a.app, a.titular, { categoria_id: a.moradia, dia_vencimento: 25 });
    await criarFixa(b.app, b.titular, { categoria_id: b.moradia, dia_vencimento: 25 });
    const todos = new Set([...a.meus, ...b.meus]);
    const falso = enviadorFalso(() => todos);
    const resumo = await rodar(AS_9H, falso.enviar, { tamanhoLote: 1 });
    expect(falso.envios).toHaveLength(4);
    expect(resumo.lares).toBeGreaterThanOrEqual(2);
  });

  it('sem VAPID configurado: nada sai e nada é marcado como avisado (sai quando a configuração chega)', async () => {
    const l = await larComAparelhos('cron.semvapid');
    await criarFixa(l.app, l.titular, { categoria_id: l.moradia, dia_vencimento: 25 });
    await rodar(AS_9H, l.falso.enviar, { vapid: null });
    expect(l.falso.envios).toEqual([]);
    const avisos = await linhasComoOwner(
      sql<{ n: number }>`select count(*)::int as n from app.aviso_push where lar_id = ${l.larId}`,
    );
    expect(avisos[0]!.n).toBe(0);
    await rodar(AS_9H, l.falso.enviar);
    expect(l.falso.envios).toHaveLength(2);
  });
});
