import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import {
  contarPorId,
  criarCategoria,
  criarConta,
  criarForma,
  larParaCadastros,
  listar,
  novoId,
} from './testes-suporte-cadastros';
import {
  appDeLar,
  criarLarDe,
  json,
  linhasComoOwner,
  pedir,
  pessoa,
  tokenDoConvite,
  type Pessoa,
} from './testes-suporte-lar';
import { sql } from 'kysely';

/**
 * Idempotência pelo id do cliente (RT-03; ADR-010) e ordem das recusas (RT-02) nos cadastros.
 */

describe.skipIf(!bancoDisponivel)('idempotência pelo id do cliente (CA-T3.1 a CA-T3.3, ADR-010)', () => {
  it('CA-T3.3: duas escritas simultâneas com o mesmo id gravam uma só vez e respondem o mesmo { id } (201 e 200)', async () => {
    const { app, titular } = await larParaCadastros('idem.corrida');
    const dispara = async (caminho: string, corpo: unknown, tabela: 'conta' | 'forma_pagamento' | 'categoria') => {
      const id = novoId();
      const respostas = await Promise.all([
        pedir(app, 'PUT', `${caminho}/${id}`, titular, corpo),
        pedir(app, 'PUT', `${caminho}/${id}`, titular, corpo),
        pedir(app, 'PUT', `${caminho}/${id}`, titular, corpo),
      ]);
      expect(respostas.map((r) => r.status).sort(), caminho).toEqual([200, 200, 201]);
      for (const r of respostas) expect(await json(r)).toEqual({ id });
      expect(await contarPorId(tabela, id), caminho).toBe(1);
    };
    // Várias rodadas: a corrida entre índices únicos distintos só aparecia de vez em quando.
    for (let rodada = 0; rodada < 8; rodada++) {
      await dispara('/api/contas', { nome: 'Corrida' }, 'conta');
      await dispara('/api/formas', { nome: 'Cartão', tipo: 'credito', dia_vencimento: 9 }, 'forma_pagamento');
      await dispara('/api/categorias', { nome: `Corrida ${rodada}`, tipo: 'despesa', escopo: 'conjunto' }, 'categoria');
    }
  });

  it('CA-T3.2: o id já usado por outro membro do mesmo lar resulta em registro_invalido e não altera o original', async () => {
    const { app, titular, membro } = await larParaCadastros('idem.outro-membro');
    const conta = await criarConta(app, titular, { nome: 'Da Ana', saldo_inicial_centavos: 10 });
    const forma = await criarForma(app, titular, { nome: 'Cartão da Ana', tipo: 'credito', dia_vencimento: 1 });
    const categoria = await criarCategoria(app, titular, { nome: 'Da Ana', tipo: 'despesa', escopo: 'individual' });
    const tentativas = [
      pedir(app, 'PUT', `/api/contas/${conta}`, membro, { nome: 'Do Bruno' }),
      pedir(app, 'PUT', `/api/formas/${forma}`, membro, { nome: 'Do Bruno', tipo: 'credito', dia_vencimento: 2 }),
      pedir(app, 'PUT', `/api/categorias/${categoria}`, membro, {
        nome: 'Do Bruno',
        tipo: 'despesa',
        escopo: 'individual',
      }),
    ];
    for (const r of await Promise.all(tentativas)) {
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    }
    expect((await listar<{ nome: string }>(app, '/api/contas', titular))[0]?.nome).toBe('Da Ana');
    expect((await listar<{ nome: string }>(app, '/api/formas', titular))[0]?.nome).toBe('Cartão da Ana');
    expect(await listar<{ id: string }>(app, '/api/contas', membro)).toEqual([]);
  });

  it('o mesmo id, ao mesmo tempo, em dois lares: um cria, o outro recebe registro_invalido (nunca duplica)', async () => {
    const { app } = appDeLar();
    const ana = await pessoa('idem.lar.a');
    const bia = await pessoa('idem.lar.b');
    await criarLarDe(app, ana);
    await criarLarDe(app, bia);
    const id = novoId();
    const [a, b] = await Promise.all([
      pedir(app, 'PUT', `/api/contas/${id}`, ana, { nome: 'A' }),
      pedir(app, 'PUT', `/api/contas/${id}`, bia, { nome: 'B' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 404]);
    expect(await contarPorId('conta', id)).toBe(1);
  });

  it('a recusa por nome repetido desfaz a escrita inteira: reenviar depois de corrigir cria normalmente', async () => {
    const { app, titular } = await larParaCadastros('idem.rollback');
    const id = novoId();
    const ruim = await pedir(app, 'PUT', `/api/categorias/${id}`, titular, {
      nome: 'Mercado',
      tipo: 'despesa',
      escopo: 'conjunto',
    });
    expect(ruim.status).toBe(409);
    const boa = await pedir(app, 'PUT', `/api/categorias/${id}`, titular, {
      nome: 'Feira',
      tipo: 'despesa',
      escopo: 'conjunto',
    });
    expect(boa.status).toBe(201);
  });
});

describe.skipIf(!bancoDisponivel)(
  'ordem das recusas (RT-02): registro_invalido antes de *_arquivada e de valor_invalido',
  () => {
    it('conta ARQUIVADA do outro membro na forma: registro_invalido, não a recusa de conta arquivada (valor_invalido)', async () => {
      const { app, titular, membro } = await larParaCadastros('ordem.conta-alheia-arq');
      const dela = await criarConta(app, titular, { nome: 'Da Ana' });
      await pedir(app, 'POST', `/api/contas/${dela}/arquivar`, titular);
      const r = await pedir(app, 'PUT', `/api/formas/${novoId()}`, membro, {
        nome: 'Pix',
        tipo: 'pix',
        conta_id: dela,
      });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
      // a própria conta arquivada, essa sim, dá a recusa de conta arquivada (valor_invalido; RN-03)
      const minha = await criarConta(app, membro, { nome: 'Do Bruno' });
      await pedir(app, 'POST', `/api/contas/${minha}/arquivar`, membro);
      const propria = await pedir(app, 'PUT', `/api/formas/${novoId()}`, membro, {
        nome: 'Pix',
        tipo: 'pix',
        conta_id: minha,
      });
      expect(propria.status).toBe(400);
      expect(await json(propria)).toMatchObject({ code: 'valor_invalido' });
    });

    it('forma ARQUIVADA do outro membro como preferida: registro_invalido, não valor_invalido (CA-T2.1)', async () => {
      const { app, titular, membro } = await larParaCadastros('ordem.forma-alheia-arq');
      const dela = await criarForma(app, titular, { tipo: 'credito', dia_vencimento: 1 });
      await pedir(app, 'POST', `/api/formas/${dela}/arquivar`, titular);
      const r = await pedir(app, 'PUT', `/api/formas/${dela}/preferida`, membro, { preferida: true });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
      const propria = await pedir(app, 'PUT', `/api/formas/${dela}/preferida`, titular, { preferida: true });
      expect(propria.status).toBe(400);
      expect(await json(propria)).toMatchObject({ code: 'valor_invalido' });
    });

    it('categoria ARQUIVADA do outro membro: editar, arquivar e excluir dão registro_invalido', async () => {
      const { app, titular, membro } = await larParaCadastros('ordem.cat-alheia-arq');
      const dela = await criarCategoria(app, titular, { nome: 'Da Ana', tipo: 'despesa', escopo: 'individual' });
      await pedir(app, 'POST', `/api/categorias/${dela}/arquivar`, titular);
      const respostas = [
        await pedir(app, 'PUT', `/api/categorias/${dela}`, membro, {
          nome: 'X',
          tipo: 'despesa',
          escopo: 'individual',
        }),
        await pedir(app, 'POST', `/api/categorias/${dela}/arquivar`, membro),
        await pedir(app, 'DELETE', `/api/categorias/${dela}`, membro),
      ];
      for (const r of respostas) {
        expect(r.status).toBe(404);
        expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
      }
    });

    it('valor_invalido (regra do domínio) vem antes de em_uso e das demais regras: tipo trocado numa forma própria', async () => {
      const { app, titular } = await larParaCadastros('ordem.valor-antes');
      const conta = await criarConta(app, titular);
      const forma = await criarForma(app, titular, { tipo: 'pix', conta_id: conta });
      const r = await pedir(app, 'PUT', `/api/formas/${forma}`, titular, {
        nome: 'x',
        tipo: 'debito',
        conta_id: conta,
      });
      expect(r.status).toBe(400);
    });

    it('sessao_expirada vem antes de tudo: sem sessão, id malformado e corpo inválido dão 401', async () => {
      const { app } = appDeLar();
      for (const [metodo, caminho, corpo] of [
        ['PUT', '/api/contas/nao-e-uuid', { nome: '' }],
        ['POST', '/api/contas/nao-e-uuid/ajuste', {}],
        ['DELETE', '/api/formas/nao-e-uuid', undefined],
        ['PUT', `/api/categorias/${novoId()}`, { nome: 1 }],
      ] as const) {
        const r = await pedir(app, metodo, caminho, null, corpo);
        expect(r.status, `${metodo} ${caminho}`).toBe(401);
        expect(await json(r)).toMatchObject({ code: 'sessao_expirada' });
      }
    });

    it('id malformado (registro_invalido) vem antes de corpo inválido (valor_invalido)', async () => {
      const { app, titular } = await larParaCadastros('ordem.id-antes-corpo');
      const r = await pedir(app, 'PUT', '/api/contas/nao-e-uuid', titular, { nome: '' });
      expect(r.status).toBe(404);
      expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    });
  },
);

describe.skipIf(!bancoDisponivel)('convidado que já tem cadastros (CA-23.10; ADR-009 item 7)', () => {
  async function conviteDe(
    app: ReturnType<typeof appDeLar>['app'],
    caixa: ReturnType<typeof appDeLar>['caixa'],
    titular: Pessoa,
    alvo: Pessoa,
  ) {
    await pedir(app, 'POST', '/api/lar/convites', titular, { email: alvo.email });
    return tokenDoConvite(caixa, alvo.email);
  }

  it('titular sozinho com uma conta (ou forma) recebe ja_tem_lar ao aceitar, e os cadastros dele ficam', async () => {
    const { app, caixa } = appDeLar();
    for (const cadastro of ['conta', 'forma'] as const) {
      const ana = await pessoa(`aceite.${cadastro}.ana`);
      await criarLarDe(app, ana);
      const bruno = await pessoa(`aceite.${cadastro}.bruno`);
      await criarLarDe(app, bruno);
      const conta = await criarConta(app, bruno, { nome: 'Do Bruno' });
      if (cadastro === 'forma') await criarForma(app, bruno, { tipo: 'credito', dia_vencimento: 1 });
      if (cadastro === 'forma') await pedir(app, 'DELETE', `/api/contas/${conta}`, bruno);
      const token = await conviteDe(app, caixa, ana, bruno);
      const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token });
      expect(r.status, cadastro).toBe(409);
      expect(await json(r)).toMatchObject({ code: 'ja_tem_lar' });
      const itens = cadastro === 'conta' ? '/api/contas' : '/api/formas';
      expect(await listar<unknown>(app, itens, bruno)).toHaveLength(1);
    }
  });

  it('titular sozinho com as iniciais intactas e SEM cadastros ainda é descartado (CA-23.9 segue valendo)', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('aceite.livre.ana');
    await criarLarDe(app, ana);
    const bruno = await pessoa('aceite.livre.bruno');
    await criarLarDe(app, bruno);
    const token = await conviteDe(app, caixa, ana, bruno);
    expect((await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token })).status).toBe(204);
  });

  it('titular sozinho cuja única marca é um movimento de conta (conta apagada não, mas ajuste sim): ja_tem_lar', async () => {
    const { app, caixa } = appDeLar();
    const ana = await pessoa('aceite.mov.ana');
    await criarLarDe(app, ana);
    const bruno = await pessoa('aceite.mov.bruno');
    await criarLarDe(app, bruno);
    const conta = await criarConta(app, bruno, { nome: 'Itaú' });
    await pedir(app, 'POST', `/api/contas/${conta}/ajuste`, bruno, { saldo_real_centavos: 100 });
    const token = await conviteDe(app, caixa, ana, bruno);
    const r = await pedir(app, 'POST', '/api/convites/aceitar', bruno, { token });
    expect(r.status).toBe(409);
    const movimentos = await linhasComoOwner(
      sql<{ n: number }>`select count(*)::int as n from app.movimento_conta where conta_id = ${conta}`,
    );
    expect(movimentos).toEqual([{ n: 1 }]);
  });
});
