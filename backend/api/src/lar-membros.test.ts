import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { assinaturaDaResposta } from './testes-suporte-acesso';
import {
  appDeLar,
  comoApp,
  convidarEAceitar,
  criarLarDe,
  json,
  larComDois,
  linhasComoOwner,
  pedir,
  pessoa,
} from './testes-suporte-lar';

/**
 * Membros do lar (RN-22, RN-23; SDD 6.2; D2/E-2; CA-23.12 a CA-23.14; PRD-TECNICO §2 privacidade).
 * Nesta etapa só existem as categorias: a parte privada das tabelas das etapas 7 a 10 entra depois.
 */

describe.skipIf(!bancoDisponivel)('GET /api/lar', () => {
  it('titular sozinho com convite pendente: vê o convite; a chave some quando não há convite (G-11)', async () => {
    const { app } = appDeLar();
    const ana = await pessoa('detalhe', 'Ana');
    await criarLarDe(app, ana);
    const sem = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', ana)));
    expect('convite_pendente' in sem).toBe(false);
    expect(sem.membros).toEqual([{ id: expect.any(String), nome: 'Ana', papel: 'titular', sou_eu: true }]);
    await pedir(app, 'POST', '/api/lar/convites', ana, { email: 'alvo.detalhe@exemplo.com' });
    const com = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', ana)));
    expect(com.convite_pendente).toMatchObject({ email: 'alvo.detalhe@exemplo.com' });
  });

  it('o membro vê os dois membros pelo nome (sou_eu certo), sem e-mail de ninguém e sem dados de convite', async () => {
    const { app, caixa } = appDeLar();
    const { titular, membro } = await larComDois(app, caixa, 'detalhe2');
    const texto = await (await pedir(app, 'GET', '/api/lar', membro)).text();
    const corpo = saida.LarDetalhe.parse(JSON.parse(texto));
    expect(corpo.membros.map((m) => [m.papel, m.sou_eu])).toEqual([
      ['titular', false],
      ['membro', true],
    ]);
    expect(texto).not.toContain(titular.email);
    expect(texto).not.toContain(membro.email);
    expect('convite_pendente' in corpo).toBe(false);
  });
});

describe.skipIf(!bancoDisponivel)('PATCH /api/lar (titular)', () => {
  it('titular renomeia (204); membro recebe titular_obrigatorio antes da validação; nome inválido é valor_invalido', async () => {
    const { app, caixa } = appDeLar();
    const { titular, membro } = await larComDois(app, caixa, 'renomear');
    expect((await pedir(app, 'PATCH', '/api/lar', titular, { nome: '  Nossa casa ' })).status).toBe(204);
    const detalhe = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', membro)));
    expect(detalhe.lar.nome).toBe('Nossa casa');

    for (const corpo of [{ nome: 'Minha casa' }, { nome: '' }]) {
      const r = await pedir(app, 'PATCH', '/api/lar', membro, corpo);
      expect(r.status).toBe(403);
      expect(await json(r)).toMatchObject({ code: 'titular_obrigatorio' });
    }
    const invalido = await pedir(app, 'PATCH', '/api/lar', titular, { nome: 'x'.repeat(61) });
    expect(invalido.status).toBe(400);
    expect(await json(invalido)).toMatchObject({ code: 'valor_invalido' });
  });
});

describe.skipIf(!bancoDisponivel)('saída e remoção do membro (CA-23.12 a CA-23.14)', () => {
  it('CA-23.12/13: o membro sai, vira "Ex-membro", cai no primeiro acesso e ganha um lar novo vazio como titular', async () => {
    const { app, caixa } = appDeLar();
    const { titular, membro, larId } = await larComDois(app, caixa, 'sair');
    const vinculoAntes = await comoApp(membro, async (_t, v) => v);
    expect((await pedir(app, 'POST', '/api/lar/sair', membro)).status).toBe(204);

    const sessao = saida.SessaoAtual.parse(await json(await pedir(app, 'GET', '/api/sessao', membro)));
    expect(sessao).toMatchObject({ membro: null, lar: null });
    const semLar = await pedir(app, 'GET', '/api/lar', membro);
    expect(semLar.status).toBe(409);
    expect(await json(semLar)).toMatchObject({ code: 'sem_lar' });

    const linha = await linhasComoOwner(
      sql<{
        nome: string;
        saiu: boolean;
      }>`select nome, saiu_em is not null as saiu from app.membro where id = ${vinculoAntes!.membroId}`,
    );
    expect(linha).toEqual([{ nome: 'Ex-membro', saiu: true }]);
    const doTitular = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', titular)));
    expect(doTitular.membros).toHaveLength(1);

    // o individual do ex-membro fica guardado para a purga (30 dias) e invisível ao titular
    const individuaisDoEx = await linhasComoOwner(
      sql<{ n: number }>`select count(*)::int as n from app.categoria where dono_id = ${vinculoAntes!.membroId}`,
    );
    expect(individuaisDoEx).toEqual([{ n: 7 }]);
    const vistoPeloTitular = await comoApp(titular, async (trx) =>
      Number(
        (
          await sql<{
            n: string;
          }>`select count(*) as n from app.categoria where dono_id = ${vinculoAntes!.membroId}`.execute(trx)
        ).rows[0]?.n,
      ),
    );
    expect(vistoPeloTitular).toBe(0);

    const novo = await pedir(app, 'POST', '/api/lar', membro, {});
    expect(novo.status).toBe(201);
    const novoLar = await json<{ id: string }>(novo);
    expect(novoLar.id).not.toBe(larId);
    const visto = await comoApp(membro, async (trx, v) => ({
      v,
      lares: (await sql<{ lar_id: string }>`select distinct lar_id from app.categoria`.execute(trx)).rows,
    }));
    expect(visto.v).toMatchObject({ larId: novoLar.id, papel: 'titular' });
    expect(visto.lares).toEqual([{ lar_id: novoLar.id }]);
  });

  it('o titular não sai por aqui: registro_invalido', async () => {
    const { app } = appDeLar();
    const ana = await pessoa('titular.sai');
    await criarLarDe(app, ana);
    const r = await pedir(app, 'POST', '/api/lar/sair', ana);
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
  });

  it('CA-23.14: o titular remove o membro (mesmo efeito da saída) e pode convidar de novo', async () => {
    const { app, caixa } = appDeLar();
    const { titular, membro } = await larComDois(app, caixa, 'remover');
    const alvo = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', titular))).membros.find(
      (m) => m.papel === 'membro',
    )!;
    expect((await pedir(app, 'DELETE', `/api/lar/membros/${alvo.id}`, titular)).status).toBe(204);
    expect((await pedir(app, 'GET', '/api/lar', membro)).status).toBe(409);
    const linha = await linhasComoOwner(sql<{ nome: string }>`select nome from app.membro where id = ${alvo.id}`);
    expect(linha).toEqual([{ nome: 'Ex-membro' }]);

    const novo = await pessoa('remover.novo');
    await convidarEAceitar(app, caixa, titular, novo);
    const depois = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', titular)));
    expect(depois.membros).toHaveLength(2);
  });

  it('CA-23.14: não titular removendo, titular removendo a si, membro já removido, de outro lar, inexistente ou malformado → a MESMA resposta registro_invalido', async () => {
    const { app, caixa } = appDeLar();
    const a = await larComDois(app, caixa, 'remover.a');
    const b = await larComDois(app, caixa, 'remover.b');
    const membrosA = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', a.titular))).membros;
    const titularA = membrosA.find((m) => m.papel === 'titular')!;
    const membroA = membrosA.find((m) => m.papel === 'membro')!;
    const membroB = saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', b.titular))).membros.find(
      (m) => m.papel === 'membro',
    )!;

    const respostas = [
      await pedir(app, 'DELETE', `/api/lar/membros/${titularA.id}`, a.membro),
      await pedir(app, 'DELETE', `/api/lar/membros/${titularA.id}`, a.titular),
      await pedir(app, 'DELETE', `/api/lar/membros/${membroB.id}`, a.titular),
      await pedir(app, 'DELETE', `/api/lar/membros/${crypto.randomUUID()}`, a.titular),
      await pedir(app, 'DELETE', `/api/lar/membros/nao-e-uuid`, a.titular),
    ];
    expect((await pedir(app, 'DELETE', `/api/lar/membros/${membroA.id}`, a.titular)).status).toBe(204);
    respostas.push(await pedir(app, 'DELETE', `/api/lar/membros/${membroA.id}`, a.titular));

    const assinaturas = await Promise.all(respostas.map(assinaturaDaResposta));
    for (const x of assinaturas) expect(x).toEqual(assinaturas[0]);
    expect(assinaturas[0]?.status).toBe(404);
    expect(JSON.parse(assinaturas[0]!.corpo)).toMatchObject({ code: 'registro_invalido' });
    // o membro do lar B continua lá
    expect(saida.LarDetalhe.parse(await json(await pedir(app, 'GET', '/api/lar', b.membro))).membros).toHaveLength(2);
  });
});
