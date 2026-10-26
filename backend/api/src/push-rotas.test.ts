import { MAX_ASSINATURAS_PUSH, PREFERENCIAS_PADRAO } from '@controle/contrato';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import type { Bindings } from './env';
import { bancoDisponivel, chamar } from './testes-suporte';
import { larParaCadastros } from './testes-suporte-cadastros';
import { appDeLar, json, pedir, pessoa } from './testes-suporte-lar';
import { inscrever, inscreverOk, inscricoesNoBanco, navegador } from './testes-suporte-push';

/**
 * Rotas do push (SDD 6.2 "Push"; RN-27; CA-27.5; CA-T3.4; TM-PUSH-02, TM-PUSH-04; ADR-014). A chave pública VAPID dos
 * testes é aleatória (vitest.config.ts); nenhum serviço de push é chamado aqui.
 */

describe.skipIf(!bancoDisponivel)('GET /api/push/chave', () => {
  it('exige sessão; com sessão devolve a chave pública VAPID configurada (sem lar também)', async () => {
    const { app } = appDeLar();
    expect((await pedir(app, 'GET', '/api/push/chave', null)).status).toBe(401);
    const sozinha = await pessoa('push.chave');
    const r = await pedir(app, 'GET', '/api/push/chave', sozinha);
    expect(r.status).toBe(200);
    expect(await json(r)).toEqual({ chave_publica: (env as unknown as Bindings).VAPID_PUBLIC_KEY });
  });

  it('sem VAPID configurado: 503 indisponivel (nada de chave inventada)', async () => {
    const { app } = appDeLar();
    const p = await pessoa('push.semchave');
    const r = await chamar(app, '/api/push/chave', { headers: { Cookie: p.cookie } }, { VAPID_PUBLIC_KEY: '' });
    expect(r.status).toBe(503);
    expect(await json(r)).toMatchObject({ code: 'indisponivel' });
  });
});

describe.skipIf(!bancoDisponivel)('POST /api/push/assinaturas', () => {
  it('204 e grava no vínculo da sessão; repetir o mesmo aparelho é idempotente (CA-T3.4)', async () => {
    const l = await larParaCadastros('push.ins');
    const nav = navegador();
    expect((await inscrever(l.app, l.titular, nav)).status).toBe(204);
    expect((await inscrever(l.app, l.titular, nav)).status).toBe(204);
    const linhas = await inscricoesNoBanco({ endpoints: [nav.endpoint] });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      usuario_id: l.titular.id,
      lar_id: l.larId,
      p256dh: nav.keys.p256dh,
      auth: nav.keys.auth,
      falhas: 0,
    });
  });

  it('o mesmo endpoint com chaves novas troca as chaves (sem duplicar)', async () => {
    const l = await larParaCadastros('push.troca');
    const nav = await inscreverOk(l.app, l.titular);
    const novo = { ...nav, keys: navegador().keys };
    await inscreverOk(l.app, l.titular, novo);
    const linhas = await inscricoesNoBanco({ endpoints: [nav.endpoint] });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.p256dh).toBe(novo.keys.p256dh);
  });

  it('aparelho compartilhado: quando outro usuário inscreve o mesmo endpoint, a inscrição passa a ser dele (TM-PUSH-02)', async () => {
    const a = await larParaCadastros('push.comp.a');
    const b = await larParaCadastros('push.comp.b');
    const nav = await inscreverOk(a.app, a.titular);
    await inscreverOk(b.app, b.membro, nav);
    const linhas = await inscricoesNoBanco({ endpoints: [nav.endpoint] });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ usuario_id: b.membro.id, lar_id: b.larId });
    // A outra inscrição do usuário anterior (outro aparelho) não é tocada.
    const outro = await inscreverOk(a.app, a.titular);
    await inscreverOk(b.app, b.membro);
    expect(await inscricoesNoBanco({ endpoints: [outro.endpoint] })).toHaveLength(1);
  });

  it(`no máximo ${MAX_ASSINATURAS_PUSH} aparelhos por usuário: o mais antigo sai, o novo fica`, async () => {
    const l = await larParaCadastros('push.limite');
    const navs = [];
    for (let i = 0; i < MAX_ASSINATURAS_PUSH + 1; i += 1) navs.push(await inscreverOk(l.app, l.titular));
    const linhas = await inscricoesNoBanco({ usuario: l.titular.id });
    expect(linhas).toHaveLength(MAX_ASSINATURAS_PUSH);
    const endpoints = linhas.map((x) => x.endpoint);
    expect(endpoints).toContain(navs.at(-1)!.endpoint);
    expect(endpoints).not.toContain(navs[0]!.endpoint);
  });

  it('recusa endpoint fora dos serviços de push, http, chaves malformadas e dono no corpo: 400 valor_invalido', async () => {
    const l = await larParaCadastros('push.invalido');
    const nav = navegador();
    for (const corpo of [
      { ...nav, endpoint: 'https://exemplo.com/push' },
      { ...nav, endpoint: nav.endpoint.replace('https:', 'http:') },
      { ...nav, endpoint: `${nav.endpoint}/${'x'.repeat(1024)}` },
      { ...nav, keys: { ...nav.keys, p256dh: 'curta' } },
      { ...nav, keys: { ...nav.keys, auth: '' } },
      { ...nav, usuario_id: l.membro.id },
      { endpoint: nav.endpoint },
    ]) {
      const r = await inscrever(l.app, l.titular, corpo);
      expect(r.status, JSON.stringify(corpo).slice(0, 80)).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
    expect(await inscricoesNoBanco({ usuario: l.titular.id })).toHaveLength(0);
  });

  it('sem sessão: 401; sem lar: 409 sem_lar', async () => {
    const { app } = appDeLar();
    expect((await inscrever(app, null as never, navegador())).status).toBe(401);
    const sozinha = await pessoa('push.semlar');
    const r = await inscrever(app, sozinha, navegador());
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'sem_lar' });
  });
});

describe.skipIf(!bancoDisponivel)('DELETE /api/push/assinaturas', () => {
  it('remove a inscrição do próprio usuário; a de outro (mesmo lar ou outro lar) fica, com o mesmo 204 (TM-PUSH-04)', async () => {
    const l = await larParaCadastros('push.del');
    const outro = await larParaCadastros('push.del.outro');
    const daAna = await inscreverOk(l.app, l.titular);
    const doBruno = await inscreverOk(l.app, l.membro);
    const deFora = await inscreverOk(outro.app, outro.titular);
    for (const alvo of [daAna, deFora]) {
      const r = await pedir(l.app, 'DELETE', '/api/push/assinaturas', l.membro, { endpoint: alvo.endpoint });
      expect(r.status).toBe(204);
    }
    expect(await inscricoesNoBanco({ endpoints: [daAna.endpoint, deFora.endpoint] })).toHaveLength(2);
    const r = await pedir(l.app, 'DELETE', '/api/push/assinaturas', l.membro, { endpoint: doBruno.endpoint });
    expect(r.status).toBe(204);
    expect(await inscricoesNoBanco({ endpoints: [doBruno.endpoint] })).toHaveLength(0);
    // Repetir é sucesso sem efeito.
    expect(
      (await pedir(l.app, 'DELETE', '/api/push/assinaturas', l.membro, { endpoint: doBruno.endpoint })).status,
    ).toBe(204);
  });

  it('sem sessão: 401 e nada muda', async () => {
    const l = await larParaCadastros('push.del.anon');
    const nav = await inscreverOk(l.app, l.titular);
    expect((await pedir(l.app, 'DELETE', '/api/push/assinaturas', null, { endpoint: nav.endpoint })).status).toBe(401);
    expect(await inscricoesNoBanco({ endpoints: [nav.endpoint] })).toHaveLength(1);
  });
});

describe.skipIf(!bancoDisponivel)('preferências (RN-27, CA-27.5, CA-27.8)', () => {
  it('sem nada salvo: os padrões (fixas e metas ligadas, lembrete desligado às 20h)', async () => {
    const l = await larParaCadastros('pref.padrao');
    const r = await pedir(l.app, 'GET', '/api/notificacoes/preferencias', l.titular);
    expect(r.status).toBe(200);
    expect(await json(r)).toEqual(PREFERENCIAS_PADRAO);
  });

  it('PUT grava (204) e GET devolve; salvar de novo atualiza; cada membro tem as suas', async () => {
    const l = await larParaCadastros('pref.salvar');
    const minhas = { fixas: false, lembrete_diario: true, lembrete_hora: 7, metas: true };
    expect((await pedir(l.app, 'PUT', '/api/notificacoes/preferencias', l.titular, minhas)).status).toBe(204);
    expect(await json(await pedir(l.app, 'GET', '/api/notificacoes/preferencias', l.titular))).toEqual(minhas);
    const outra = { ...minhas, lembrete_hora: 22, metas: false };
    expect((await pedir(l.app, 'PUT', '/api/notificacoes/preferencias', l.titular, outra)).status).toBe(204);
    expect(await json(await pedir(l.app, 'GET', '/api/notificacoes/preferencias', l.titular))).toEqual(outra);
    // O outro membro não vê as de Ana: vê as próprias (padrão).
    expect(await json(await pedir(l.app, 'GET', '/api/notificacoes/preferencias', l.membro))).toEqual(
      PREFERENCIAS_PADRAO,
    );
  });

  it('valor inválido: 400; sem lar: 409; sem sessão: 401', async () => {
    const l = await larParaCadastros('pref.invalida');
    for (const corpo of [
      { ...PREFERENCIAS_PADRAO, lembrete_hora: 24 },
      { ...PREFERENCIAS_PADRAO, fixas: 'sim' },
      { fixas: true },
      { ...PREFERENCIAS_PADRAO, membro_id: l.membro.id },
    ]) {
      expect((await pedir(l.app, 'PUT', '/api/notificacoes/preferencias', l.titular, corpo)).status).toBe(400);
    }
    const sozinha = await pessoa('pref.semlar');
    expect((await pedir(l.app, 'GET', '/api/notificacoes/preferencias', sozinha)).status).toBe(409);
    expect((await pedir(l.app, 'GET', '/api/notificacoes/preferencias', null)).status).toBe(401);
  });
});
