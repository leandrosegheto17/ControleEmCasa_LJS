import { saida } from '@controle/contrato';
import { sql, type RawBuilder } from 'kysely';
import { afterEach, describe, expect, inject, it, vi } from 'vitest';
import { criarApp } from './app';
import { criarDb } from './infraestrutura/db/cliente';
import { emTransacaoComo } from './infraestrutura/db/transacao';
import type { TransporteEmail } from './infraestrutura/email';
import { bancoDisponivel } from './testes-suporte';
import { assinaturaDaResposta, caixaDeEmail, MINUTO, relogioControlado, sha256 } from './testes-suporte-acesso';
import {
  appDeLar,
  comoApp,
  convidarEAceitar,
  criarLarDe,
  json,
  larComDois,
  linhasComoOwner,
  novaSessao,
  pedir,
  pessoa,
  tokenDoConvite,
  type Pessoa,
} from './testes-suporte-lar';

/**
 * Convite de membro (RN-23; SDD 8.4; G-14, G-19; THREAT-MODEL TM-API-06, TM-API-07, TM-API-16, TM-RES-03; ADR-009).
 * CA-23.1 a CA-23.11, CA-23.15, CA-11.1, CA-11.2. Token de 256 bits só como SHA-256, 7 dias, uso único,
 * amarrado ao e-mail da sessão; limite de 2 membros garantido no banco.
 */
afterEach(() => vi.restoreAllMocks());

const DIA = 24 * 60 * MINUTO;
type App = ReturnType<typeof appDeLar>['app'];

async function convidar(app: App, titular: Pessoa, email: string) {
  return pedir(app, 'POST', '/api/lar/convites', titular, { email });
}

async function situacaoDo(conviteId: string) {
  const r = await linhasComoOwner(sql<{ situacao: string }>`select situacao from app.convite where id = ${conviteId}`);
  return r[0]?.situacao;
}

async function vinculoDe(p: Pessoa) {
  return comoApp(p, async (_trx, v) => v);
}

describe.skipIf(!bancoDisponivel)('convidar (POST /api/lar/convites)', () => {
  it('CA-23.1: grava só o hash do token, expira em 7 dias e envia o link com o token no fragmento', async () => {
    const rel = relogioControlado(new Date());
    const { app, caixa } = appDeLar({ relogio: rel.relogio });
    const ana = await pessoa('ana', 'Ana', rel.agora());
    await criarLarDe(app, ana);
    const email = 'Bruno.Convidado@Exemplo.com';
    const r = await convidar(app, ana, email);
    expect(r.status).toBe(201);
    const texto = await r.text();
    const corpo = saida.ConviteCriado.parse(JSON.parse(texto));
    expect(corpo.email).toBe(email.toLowerCase());
    expect(new Date(corpo.expira_em).getTime()).toBe(rel.agora().getTime() + 7 * DIA);

    const msgs = caixa.para(email.toLowerCase());
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.texto).toContain('Ana');
    expect(msgs[0]?.texto).toMatch(/https:\/\/teste\.exemplo\.local\/convite#t=[A-Za-z0-9_-]{43}/);
    const token = tokenDoConvite(caixa, email.toLowerCase());
    expect(texto).not.toContain(token);
    const gravado = await linhasComoOwner(
      sql<{ token_hash: Uint8Array; situacao: string; convidado_por_nome: string }>`
        select token_hash, situacao, convidado_por_nome from app.convite where id = ${corpo.id}`,
    );
    expect(Buffer.from(gravado[0]!.token_hash).equals(Buffer.from(await sha256(token)))).toBe(true);
    expect(gravado[0]).toMatchObject({ situacao: 'pendente', convidado_por_nome: 'Ana' });
  });

  it('CA-23.2: quem não é titular recebe registro_invalido, antes até da validação do corpo', async () => {
    const { app, caixa } = appDeLar();
    const { membro } = await larComDois(app, caixa, 'naotitular');
    for (const corpo of [{ email: 'alguem@exemplo.com' }, { email: 'sem-arroba' }]) {
      const r = await convidar(app, membro, corpo.email);
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
  });

  it('CA-23.7: convidar o próprio e-mail (inclusive com outra caixa) é valor_invalido', async () => {
    const { app } = appDeLar();
    const ana = await pessoa('propria');
    await criarLarDe(app, ana);
    for (const email of [ana.email, ana.email.toUpperCase()]) {
      const r = await convidar(app, ana, email);
      expect(r.status).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });

  it('CA-11.1: com 2 membros, convidar é lar_cheio', async () => {
    const { app, caixa } = appDeLar();
    const { titular } = await larComDois(app, caixa, 'cheio');
    const r = await convidar(app, titular, 'terceiro@exemplo.com');
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'lar_cheio' });
  });

  it('G-14: o convite novo revoga o anterior (o link antigo deixa de servir)', async () => {
    const rel = relogioControlado(new Date());
    const { app, caixa } = appDeLar({ relogio: rel.relogio });
    const ana = await pessoa('revoga', 'Ana', rel.agora());
    await criarLarDe(app, ana);
    const x = await pessoa('x', 'X', rel.agora());
    const y = await pessoa('y', 'Y', rel.agora());
    const primeiro = await json<{ id: string }>(await convidar(app, ana, x.email));
    const segundo = await convidar(app, ana, y.email);
    expect(segundo.status).toBe(201);
    expect(await situacaoDo(primeiro.id)).toBe('cancelado');
    const antigo = await pedir(app, 'POST', '/api/convites/aceitar', x, { token: tokenDoConvite(caixa, x.email) });
    expect(antigo.status).toBe(404);
    expect(await json(antigo)).toMatchObject({ code: 'convite_invalido' });
    const novo = await pedir(app, 'POST', '/api/convites/aceitar', y, { token: tokenDoConvite(caixa, y.email) });
    expect(novo.status).toBe(204);
  });

  it('TM-API-16: o mesmo endereço só recebe outro convite depois de 2 min (convite_pendente antes disso)', async () => {
    const rel = relogioControlado(new Date());
    const { app, caixa } = appDeLar({ relogio: rel.relogio });
    const ana = await pessoa('reenvio', 'Ana', rel.agora());
    await criarLarDe(app, ana);
    const email = 'reenvio.alvo@exemplo.com';
    expect((await convidar(app, ana, email)).status).toBe(201);
    rel.avancar(MINUTO);
    const cedo = await convidar(app, ana, email);
    expect(cedo.status).toBe(409);
    expect(await json(cedo)).toMatchObject({ code: 'convite_pendente' });
    expect(caixa.para(email)).toHaveLength(1);
    rel.avancar(MINUTO);
    expect((await convidar(app, ana, email)).status).toBe(201);
    expect(caixa.para(email)).toHaveLength(2);
  });

  it('TM-API-16: até 5 convites por lar em 24 h; o 6º é muitas_tentativas; depois de 24 h volta a valer', async () => {
    const rel = relogioControlado(new Date());
    const { app } = appDeLar({ relogio: rel.relogio });
    const ana = await pessoa('cota', 'Ana', rel.agora());
    await criarLarDe(app, ana);
    for (let i = 0; i < 5; i += 1) {
      expect((await convidar(app, ana, `cota${i}@exemplo.com`)).status).toBe(201);
    }
    const sexto = await convidar(app, ana, 'cota5@exemplo.com');
    expect(sexto.status).toBe(429);
    expect(await json(sexto)).toMatchObject({ code: 'muitas_tentativas' });
    rel.avancar(DIA + 1000);
    ana.cookie = await novaSessao(ana.id, rel.agora());
    expect((await convidar(app, ana, 'cota6@exemplo.com')).status).toBe(201);
  });

  it('TM-API-07/D-6: a resposta não depende de o e-mail ter conta ou já estar noutro lar', async () => {
    const { app, caixa } = appDeLar();
    const { membro: jaTemLar } = await larComDois(app, caixa, 'enum');
    const comConta = await pessoa('enum.conta');
    const r = [];
    for (const email of [jaTemLar.email, comConta.email, 'ninguem.enum@exemplo.com']) {
      const ana = await pessoa('enum.titular');
      await criarLarDe(app, ana);
      const resp = await convidar(app, ana, email);
      const corpo = await json<Record<string, unknown>>(resp);
      r.push({ status: resp.status, chaves: Object.keys(corpo).sort(), email: corpo['email'] === email });
    }
    for (const x of r) expect(x).toEqual(r[0]);
    expect(r[0]).toEqual({ status: 201, chaves: ['email', 'expira_em', 'id'], email: true });
  });

  it('dois convites simultâneos do mesmo lar: o índice deixa um só pendente', async () => {
    const { app } = appDeLar();
    const ana = await pessoa('simultaneo');
    await criarLarDe(app, ana);
    const rs = await Promise.all([convidar(app, ana, 'um@exemplo.com'), convidar(app, ana, 'dois@exemplo.com')]);
    const status = rs.map((r) => r.status).sort();
    expect(status[0]).toBe(201);
    expect([201, 409]).toContain(status[1]);
    const pendentes = await comoApp(ana, async (trx) =>
      Number(
        (await sql<{ n: string }>`select count(*) as n from app.convite where situacao = 'pendente'`.execute(trx))
          .rows[0]?.n,
      ),
    );
    expect(pendentes).toBe(1);
  });
});

describe.skipIf(!bancoDisponivel)('ver o convite (GET /api/convites/atual)', () => {
  it('com a sessão do e-mail convidado: nome do lar e de quem convidou, sem o e-mail', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('ver', 'Ana');
    await criarLarDe(app, ana);
    const bruno = await pessoa('ver.bruno');
    await convidar(app, ana, bruno.email);
    const token = tokenDoConvite(caixa, bruno.email);
    const r = await pedir(app, 'GET', `/api/convites/atual?token=${token}`, bruno);
    expect(r.status).toBe(200);
    const corpo = saida.ConviteAtual.parse(await r.json());
    expect(corpo).toMatchObject({ lar_nome: 'Lar de Ana', convidado_por_nome: 'Ana' });
  });

  it('CA-23.5 e TM-RES-03: outro e-mail, token errado, sem token, expirado ou usado → a MESMA resposta convite_invalido', async () => {
    const rel = relogioControlado(new Date());
    const { app, caixa } = appDeLar({ relogio: rel.relogio });
    const ana = await pessoa('mesma', 'Ana', rel.agora());
    await criarLarDe(app, ana);
    const bruno = await pessoa('mesma.bruno', 'Bruno', rel.agora());
    const outra = await pessoa('mesma.outra', 'Outra', rel.agora());
    await convidar(app, ana, bruno.email);
    const token = tokenDoConvite(caixa, bruno.email);

    const respostas = [
      await pedir(app, 'GET', `/api/convites/atual?token=${token}`, outra),
      await pedir(app, 'GET', `/api/convites/atual?token=${'A'.repeat(43)}`, bruno),
      await pedir(app, 'GET', `/api/convites/atual?token=curto`, bruno),
      await pedir(app, 'GET', `/api/convites/atual`, bruno),
      // o titular, mesmo enxergando o convite do próprio lar, não usa o link (não é o e-mail convidado)
      await pedir(app, 'GET', `/api/convites/atual?token=${token}`, ana),
    ];
    rel.avancar(7 * DIA + 1000);
    bruno.cookie = await novaSessao(bruno.id, rel.agora());
    respostas.push(await pedir(app, 'GET', `/api/convites/atual?token=${token}`, bruno));

    const assinaturas = await Promise.all(respostas.map(assinaturaDaResposta));
    for (const a of assinaturas) expect(a).toEqual(assinaturas[0]);
    expect(assinaturas[0]?.status).toBe(404);
    expect(JSON.parse(assinaturas[0]?.corpo ?? '{}')).toMatchObject({ code: 'convite_invalido' });
    expect(assinaturas[0]?.corpo).not.toContain(bruno.email);
  });

  it('sem sessão: 401 (o convidado entra ou se cadastra antes; CA-22.2)', async () => {
    const { app } = appDeLar();
    const r = await pedir(app, 'GET', `/api/convites/atual?token=${'A'.repeat(43)}`, null);
    expect(r.status).toBe(401);
  });
});

describe.skipIf(!bancoDisponivel)('aceitar (POST /api/convites/aceitar)', () => {
  it('CA-23.3: vira membro do lar, ganha as 7 individuais, vê as conjuntas e o convite fica usado', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('aceita', 'Ana');
    const larId = await criarLarDe(app, ana);
    const bruno = await pessoa('aceita.bruno', 'Bruno');
    const conv = await json<{ id: string }>(await convidar(app, ana, bruno.email));
    const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token: tokenDoConvite(caixa, bruno.email) });
    expect(r.status).toBe(204);

    const sessao = saida.SessaoAtual.parse(await json(await pedir(app, 'GET', '/api/sessao', bruno)));
    expect(sessao.lar).toEqual({ id: larId, nome: 'Lar de Ana' });
    expect(sessao.membro).toMatchObject({ nome: 'Bruno', papel: 'membro' });
    expect(await situacaoDo(conv.id)).toBe('aceito');

    const visto = await comoApp(bruno, async (trx, v) => ({
      v,
      categorias: (
        await sql<{ escopo: string; dono_id: string | null }>`select escopo, dono_id from app.categoria`.execute(trx)
      ).rows,
    }));
    expect(visto.categorias.filter((c) => c.escopo === 'conjunto')).toHaveLength(6);
    const minhas = visto.categorias.filter((c) => c.escopo === 'individual');
    expect(minhas).toHaveLength(7);
    expect(minhas.every((c) => c.dono_id === visto.v?.membroId)).toBe(true);

    const lar = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', ana)));
    expect(lar.membros.map((m) => [m.nome, m.papel])).toEqual([
      ['Ana', 'titular'],
      ['Bruno', 'membro'],
    ]);
  });

  it('CA-23.4: o mesmo link usado de novo (aceitar ou recusar) é convite_invalido', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('reuso');
    await criarLarDe(app, ana);
    const bruno = await pessoa('reuso.bruno');
    const token = await convidarEAceitar(app, caixa, ana, bruno);
    for (const rota of ['/api/convites/aceitar', '/api/convites/recusar']) {
      const r = await pedir(app, 'POST', rota, bruno, { token });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'convite_invalido' });
    }
  });

  it('CA-23.5: link aberto com a sessão de outro e-mail é convite_invalido e não cria membro', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('outro');
    await criarLarDe(app, ana);
    const bruno = await pessoa('outro.bruno');
    const intruso = await pessoa('outro.intruso');
    await convidar(app, ana, bruno.email);
    const r = await pedir(app, 'POST', '/api/convites/aceitar', intruso, { token: tokenDoConvite(caixa, bruno.email) });
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'convite_invalido' });
    expect(await vinculoDe(intruso)).toBeNull();
    // e o convite continua valendo para o e-mail certo
    const certo = await pedir(app, 'POST', '/api/convites/aceitar', bruno, {
      token: tokenDoConvite(caixa, bruno.email),
    });
    expect(certo.status).toBe(204);
  });

  it('convite expirado (7 dias) ou revogado pelo titular: convite_invalido', async () => {
    const rel = relogioControlado(new Date());
    const { app, caixa } = appDeLar({ relogio: rel.relogio });
    const ana = await pessoa('expira', 'Ana', rel.agora());
    await criarLarDe(app, ana);
    const bruno = await pessoa('expira.bruno', 'Bruno', rel.agora());
    const conv = await json<{ id: string }>(await convidar(app, ana, bruno.email));
    const token = tokenDoConvite(caixa, bruno.email);

    expect((await pedir(app, 'DELETE', `/api/lar/convites/${conv.id}`, ana)).status).toBe(204);
    expect(await situacaoDo(conv.id)).toBe('cancelado');
    const revogado = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token });
    expect(revogado.status).toBe(404);

    rel.avancar(3 * MINUTO);
    await convidar(app, ana, bruno.email);
    const token2 = tokenDoConvite(caixa, bruno.email);
    rel.avancar(7 * DIA + 1000);
    bruno.cookie = await novaSessao(bruno.id, rel.agora());
    const vencido = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token: token2 });
    expect(vencido.status).toBe(404);
    expect(await json(vencido)).toMatchObject({ code: 'convite_invalido' });
    expect(await vinculoDe(bruno)).toBeNull();
  });

  it('CA-23.6 (rota): dois aceites simultâneos do mesmo link: um entra, o outro é convite_invalido', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('corrida');
    await criarLarDe(app, ana);
    const bruno = await pessoa('corrida.bruno');
    await convidar(app, ana, bruno.email);
    const token = tokenDoConvite(caixa, bruno.email);
    const rs = await Promise.all([1, 2].map(() => pedir(app, 'POST', '/api/convites/aceitar', bruno, { token })));
    expect(rs.map((r) => r.status).sort()).toEqual([204, 404]);
    const ativos = await comoApp(ana, async (trx) =>
      Number(
        (await sql<{ n: string }>`select count(*) as n from app.membro where saiu_em is null`.execute(trx)).rows[0]?.n,
      ),
    );
    expect(ativos).toBe(2);
  });

  it('CA-11.1 (aceite): lar que já ficou com 2 membros recusa o aceite com lar_cheio e não muda nada', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('vaga');
    const larId = await criarLarDe(app, ana);
    const bruno = await pessoa('vaga.bruno');
    await convidar(app, ana, bruno.email);
    const token = tokenDoConvite(caixa, bruno.email);
    // Um terceiro ocupa a vaga direto no banco, como `app`, com a política satisfeita pelo convite pendente:
    // só o índice `membro_um_convidado` pode segurar o aceite do Bruno.
    const zeca = await pessoa('vaga.zeca');
    await comoOwner_inserirMembro(larId, zeca.id, bruno.email);
    const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token });
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'lar_cheio' });
    expect(await vinculoDe(bruno)).toBeNull();
    const conv = await linhasComoOwner(
      sql<{ situacao: string }>`select situacao from app.convite where lar_id = ${larId}`,
    );
    expect(conv).toEqual([{ situacao: 'pendente' }]);
  });

  it('CA-23.9 e CA-23.15: quem tem lar só com as categorias iniciais tem esse lar descartado e entra limpo', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('descarte', 'Ana');
    const larA = await criarLarDe(app, ana);
    const bruno = await pessoa('descarte.bruno', 'Bruno');
    const larAntigo = await criarLarDe(app, bruno);
    await convidar(app, ana, bruno.email);
    const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token: tokenDoConvite(caixa, bruno.email) });
    expect(r.status).toBe(204);

    const v = await vinculoDe(bruno);
    expect(v).toMatchObject({ larId: larA, papel: 'membro' });
    const antigo = await linhasComoOwner(
      sql<{ categorias: number; ativos: number }>`
        select (select count(*)::int from app.categoria where lar_id = ${larAntigo}) as categorias,
               (select count(*)::int from app.membro where lar_id = ${larAntigo} and saiu_em is null) as ativos`,
    );
    expect(antigo).toEqual([{ categorias: 0, ativos: 0 }]);
    const visto = await comoApp(
      bruno,
      async (trx) => (await sql<{ lar_id: string }>`select distinct lar_id from app.categoria`.execute(trx)).rows,
    );
    expect(visto).toEqual([{ lar_id: larA }]);
  });

  it('CA-23.10: quem tem lar com qualquer dado (categoria criada ou inicial renomeada) recebe ja_tem_lar e nada muda', async () => {
    const { app, caixa } = appDeLar();
    for (const alterar of [
      sql`insert into app.categoria (lar_id, tipo, escopo, dono_id, nome, variavel)
          values (app.lar_atual(), 'despesa', 'individual', app.membro_atual(), 'Academia', false)`,
      sql`update app.categoria set nome = 'Feira' where nome = 'Mercado'`,
    ]) {
      const ana = await pessoa('comdado');
      await criarLarDe(app, ana);
      const bruno = await pessoa('comdado.bruno');
      const larBruno = await criarLarDe(app, bruno);
      await comoAppConfirmando(bruno, alterar);
      await convidar(app, ana, bruno.email);
      const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token: tokenDoConvite(caixa, bruno.email) });
      expect(r.status).toBe(409);
      expect(await json(r)).toMatchObject({ code: 'ja_tem_lar' });
      expect(await vinculoDe(bruno)).toMatchObject({ larId: larBruno, papel: 'titular' });
    }
  });

  it('CA-23.11 e CA-11.2: titular de lar com membro, ou membro de outro lar, recebe ja_tem_lar', async () => {
    const { app, caixa } = appDeLar();
    const outro = await larComDois(app, caixa, 'ocupado');
    for (const quem of [outro.titular, outro.membro]) {
      const ana = await pessoa('ocupado.convidante');
      await criarLarDe(app, ana);
      await convidar(app, ana, quem.email);
      const r = await pedir(app, 'POST', '/api/convites/aceitar', quem, { token: tokenDoConvite(caixa, quem.email) });
      expect(r.status).toBe(409);
      expect(await json(r)).toMatchObject({ code: 'ja_tem_lar' });
      expect(await vinculoDe(quem)).toMatchObject({ larId: outro.larId });
    }
  });
});

describe.skipIf(!bancoDisponivel)(
  'recusar (POST /api/convites/recusar) e revogar (DELETE /api/lar/convites/:id)',
  () => {
    it('recusar encerra o convite (uso único): depois, aceitar ou recusar de novo é convite_invalido', async () => {
      const { app, caixa } = appDeLar();
      const ana = await pessoa('recusa');
      await criarLarDe(app, ana);
      const bruno = await pessoa('recusa.bruno');
      const conv = await json<{ id: string }>(await convidar(app, ana, bruno.email));
      const token = tokenDoConvite(caixa, bruno.email);
      expect((await pedir(app, 'POST', '/api/convites/recusar', bruno, { token })).status).toBe(204);
      expect(await situacaoDo(conv.id)).toBe('recusado');
      for (const rota of ['/api/convites/aceitar', '/api/convites/recusar']) {
        expect((await pedir(app, 'POST', rota, bruno, { token })).status).toBe(404);
      }
    });

    it('recusar com a sessão de outro e-mail não encerra o convite', async () => {
      const { app, caixa } = appDeLar();
      const ana = await pessoa('recusa2');
      await criarLarDe(app, ana);
      const bruno = await pessoa('recusa2.bruno');
      const intruso = await pessoa('recusa2.intruso');
      const conv = await json<{ id: string }>(await convidar(app, ana, bruno.email));
      const r = await pedir(app, 'POST', '/api/convites/recusar', intruso, {
        token: tokenDoConvite(caixa, bruno.email),
      });
      expect(r.status).toBe(404);
      expect(await situacaoDo(conv.id)).toBe('pendente');
    });

    it('revogar: titular 204 (repetir é sucesso sem efeito); membro, id de outro lar, inexistente ou malformado → registro_invalido', async () => {
      const { app, caixa } = appDeLar();
      const ana = await pessoa('revogar');
      await criarLarDe(app, ana);
      const conv = await json<{ id: string }>(await convidar(app, ana, 'alvo.revogar@exemplo.com'));
      expect((await pedir(app, 'DELETE', `/api/lar/convites/${conv.id}`, ana)).status).toBe(204);
      expect((await pedir(app, 'DELETE', `/api/lar/convites/${conv.id}`, ana)).status).toBe(204);

      const outro = await larComDois(app, caixa, 'revogar.outro');
      const convOutro = await json<{ id: string }>(await convidar(app, ana, 'mais.um@exemplo.com'));
      const casos = [
        await pedir(app, 'DELETE', `/api/lar/convites/${convOutro.id}`, outro.titular),
        await pedir(app, 'DELETE', `/api/lar/convites/${crypto.randomUUID()}`, ana),
        await pedir(app, 'DELETE', `/api/lar/convites/nao-e-uuid`, ana),
      ];
      const assinaturas = await Promise.all(casos.map(assinaturaDaResposta));
      for (const a of assinaturas) expect(a).toEqual(assinaturas[0]);
      expect(assinaturas[0]?.status).toBe(404);
      expect(JSON.parse(assinaturas[0]!.corpo)).toMatchObject({ code: 'registro_invalido' });
      expect(await situacaoDo(convOutro.id)).toBe('pendente');

      // o membro do lar (não titular) também não revoga um convite do próprio lar
      const doLarDoMembro = await linhasComoOwner(
        sql<{ id: string }>`select id from app.convite where lar_id = ${outro.larId}`,
      );
      const membroTentando = await pedir(app, 'DELETE', `/api/lar/convites/${doLarDoMembro[0]!.id}`, outro.membro);
      expect(await assinaturaDaResposta(membroTentando)).toEqual(assinaturas[0]);
    });
  },
);

describe.skipIf(!bancoDisponivel)('logs sem e-mail nem token (G-46; CA-20.8)', () => {
  it('convidar (com falha no envio), ver, aceitar e reaceitar não escrevem e-mail nem token no console', async () => {
    const linhas: string[] = [];
    for (const nivel of ['info', 'warn', 'error', 'log'] as const) {
      vi.spyOn(console, nivel).mockImplementation((...args: unknown[]) => {
        linhas.push(args.map(String).join(' '));
      });
    }
    // transporte que guarda a mensagem mas responde falha: o aviso `email_falhou` não pode levar o destinatário
    const caixa = caixaDeEmail();
    const falha: TransporteEmail = async (m) => {
      await caixa.transporte(m);
      return { ok: false, motivo: 'http', status: 500 };
    };
    const app = criarApp({ transporteEmail: falha });
    const ana = await pessoa('log');
    await criarLarDe(app, ana);
    const bruno = await pessoa('log.bruno');
    await convidar(app, ana, bruno.email);
    const token = tokenDoConvite(caixa, bruno.email);
    await pedir(app, 'GET', `/api/convites/atual?token=${token}`, bruno);
    await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token });
    await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token });
    await new Promise((r) => setTimeout(r, 20));
    const tudo = linhas.join(' | ');
    expect(tudo).toContain('email_falhou');
    expect(tudo).not.toContain(bruno.email);
    expect(tudo).not.toContain(ana.email);
    expect(tudo).not.toContain(token);
  });
});

/** Ocupa a vaga de convidado do lar com outro usuário, como `app`, usando o convite pendente de `email`. */
async function comoOwner_inserirMembro(larId: string, usuarioId: string, email: string): Promise<void> {
  const db = criarDb(inject('urlBancoApp'));
  try {
    await db.transaction().execute(async (trx) => {
      await sql`select set_config('app.usuario_id', ${usuarioId}, true), set_config('app.email', ${email}, true)`.execute(
        trx,
      );
      await sql`insert into app.membro (lar_id, usuario_id, nome, papel) values (${larId}, ${usuarioId}, 'Zeca', 'membro')`.execute(
        trx,
      );
    });
  } finally {
    await db.destroy();
  }
}

/** Executa uma escrita como `app` com a identidade da pessoa e CONFIRMA (prepara um lar "com dados"). */
async function comoAppConfirmando(p: Pessoa, escrita: RawBuilder<unknown>): Promise<void> {
  const db = criarDb(inject('urlBancoApp'));
  try {
    await emTransacaoComo(db, { usuarioId: p.id, email: p.email }, async (trx) => {
      await escrita.execute(trx);
    });
  } finally {
    await db.destroy();
  }
}
