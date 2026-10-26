import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { comoOwner, SENHA_BOA } from './testes-suporte-acesso';
import { larParaCadastros } from './testes-suporte-cadastros';
import { pedir, type Pessoa } from './testes-suporte-lar';
import { larDePlano } from './testes-suporte-plano';
import { inscreverOk, inscricoesNoBanco } from './testes-suporte-push';

/**
 * Inscrições de push ao sair de todos e ao excluir a conta (CA-27.6; G-39, G-49; TM-PUSH-02; ADR-013, ADR-014).
 * Na exclusão, sempre; no "sair de todos", também. As inscrições dos OUTROS usuários ficam.
 */

async function definirSenha(quem: Pessoa): Promise<void> {
  await comoOwner((db) =>
    sql`update app.usuario set senha_hash = app.crypt(${SENHA_BOA}, app.gen_salt('bf', 4)) where id = ${quem.id}`.execute(
      db,
    ),
  );
}

/** Inscrição feita num vínculo ANTERIOR do usuário (lar que ele deixou), gravada como a API gravaria. */
async function inscricaoNumVinculoAntigo(quem: Pessoa): Promise<string> {
  const endpoint = `https://fcm.googleapis.com/fcm/send/antigo-${crypto.randomUUID()}`;
  await comoOwner(async (db) => {
    const lar = await sql<{ id: string }>`
      insert into app.lar (nome, criado_por) values ('Antigo', ${quem.id}) returning id`.execute(db);
    const larId = lar.rows[0]!.id;
    const m = await sql<{ id: string }>`
      insert into app.membro (lar_id, usuario_id, nome, papel, entrou_em, saiu_em)
      values (${larId}, ${quem.id}, 'Ex-membro', 'titular', now() - interval '2 days', now() - interval '1 day')
      returning id`.execute(db);
    await sql`
      insert into app.push_subscription (usuario_id, lar_id, membro_id, endpoint, p256dh, auth)
      values (${quem.id}, ${larId}, ${m.rows[0]!.id}, ${endpoint}, ${'B' + 'A'.repeat(86)}, ${'a'.repeat(22)})`.execute(
      db,
    );
  });
  return endpoint;
}

describe.skipIf(!bancoDisponivel)('sair de todos (CA-27.6; TM-PUSH-02)', () => {
  it('remove todas as inscrições do usuário (de qualquer vínculo); as do outro membro ficam', async () => {
    const l = await larParaCadastros('push.sairtodos');
    await inscreverOk(l.app, l.titular);
    await inscreverOk(l.app, l.titular);
    const antigo = await inscricaoNumVinculoAntigo(l.titular);
    const doBruno = await inscreverOk(l.app, l.membro);
    expect(await inscricoesNoBanco({ usuario: l.titular.id })).toHaveLength(3);
    const r = await pedir(l.app, 'POST', '/api/sessao/sair-de-todos', l.titular, {});
    expect(r.status).toBe(204);
    expect(await inscricoesNoBanco({ usuario: l.titular.id })).toEqual([]);
    expect(await inscricoesNoBanco({ endpoints: [antigo] })).toEqual([]);
    expect(await inscricoesNoBanco({ endpoints: [doBruno.endpoint] })).toHaveLength(1);
    // As sessões também foram revogadas (CA-20.5).
    expect((await pedir(l.app, 'GET', '/api/sessao', l.titular)).status).toBe(401);
  });
});

describe.skipIf(!bancoDisponivel)('confirmação da exclusão de conta (G-49; CA-27.6)', () => {
  async function excluir(l: Awaited<ReturnType<typeof larDePlano>>, quem: Pessoa): Promise<void> {
    await definirSenha(quem);
    const p = await pedir(l.app, 'POST', '/api/conta/exclusao', quem, { senha: SENHA_BOA });
    expect(p.status).toBe(202);
    const token = l.caixa.ultimoToken(quem.email);
    const c = await pedir(l.app, 'POST', '/api/conta/exclusao/confirmar', null, { token });
    expect(c.status).toBe(204);
  }

  it('titular: todas as inscrições dele somem na hora; as do convidado ficam', async () => {
    const l = await larDePlano('push.exc.tit', { comMembro: true });
    await inscreverOk(l.app, l.titular);
    const antigo = await inscricaoNumVinculoAntigo(l.titular);
    const doMembro = await inscreverOk(l.app, l.membro!);
    await excluir(l, l.titular);
    expect(await inscricoesNoBanco({ usuario: l.titular.id })).toEqual([]);
    expect(await inscricoesNoBanco({ endpoints: [antigo] })).toEqual([]);
    expect(await inscricoesNoBanco({ endpoints: [doMembro.endpoint] })).toHaveLength(1);
  });

  it('convidado: as inscrições dele somem; as do titular ficam', async () => {
    const l = await larDePlano('push.exc.conv', { comMembro: true });
    const doTitular = await inscreverOk(l.app, l.titular);
    await inscreverOk(l.app, l.membro!);
    await excluir(l, l.membro!);
    expect(await inscricoesNoBanco({ usuario: l.membro!.id })).toEqual([]);
    expect(await inscricoesNoBanco({ endpoints: [doTitular.endpoint] })).toHaveLength(1);
  });

  it('link inválido: nada muda', async () => {
    const l = await larDePlano('push.exc.link');
    const nav = await inscreverOk(l.app, l.titular);
    const c = await pedir(l.app, 'POST', '/api/conta/exclusao/confirmar', null, { token: 'x'.repeat(43) });
    expect(c.status).toBe(400);
    expect(await inscricoesNoBanco({ endpoints: [nav.endpoint] })).toHaveLength(1);
  });
});
