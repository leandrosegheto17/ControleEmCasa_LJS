import { saida } from '@controle/contrato';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { comoOwner } from './testes-suporte-acesso';
import { contarPorId, criarCategoria, larParaCadastros, listar, novoId } from './testes-suporte-cadastros';
import { json, linhasComoOwner, pedir } from './testes-suporte-lar';

/**
 * Categorias (PRD-TECNICO RN-17; CA-17.1 a CA-17.3; SDD 6.1 #16 a #19; ADR-010).
 * O lar nasce com as 13 iniciais (etapa 6); aqui vale o cadastro.
 */

type Linha = ReturnType<typeof saida.LinhaCategorias.parse>;

const salvar = (app: Parameters<typeof pedir>[0], quem: Parameters<typeof pedir>[3], corpo: unknown, id = novoId()) =>
  pedir(app, 'PUT', `/api/categorias/${id}`, quem, corpo);

describe.skipIf(!bancoDisponivel)('GET /api/categorias', () => {
  it('cada membro vê as 6 conjuntas e as próprias 7 individuais, nunca as do outro', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.lista');
    const deAna = (await listar<unknown>(app, '/api/categorias', titular)).map((l) => saida.LinhaCategorias.parse(l));
    const deBruno = (await listar<unknown>(app, '/api/categorias', membro)).map((l) => saida.LinhaCategorias.parse(l));
    for (const lista of [deAna, deBruno]) {
      expect(lista.filter((c) => c.escopo === 'conjunto')).toHaveLength(6);
      expect(lista.filter((c) => c.escopo === 'individual')).toHaveLength(7);
    }
    expect(new Set(deAna.map((c) => c.id)).size).toBe(13);
    const idsAna = new Set(deAna.filter((c) => c.escopo === 'individual').map((c) => c.id));
    expect(deBruno.filter((c) => c.escopo === 'individual').some((c) => idsAna.has(c.id))).toBe(false);
  });

  it('arquivadas entram, com o campo arquivada', async () => {
    const { app, titular } = await larParaCadastros('cat.lista-arq');
    const id = await criarCategoria(app, titular, { nome: 'Antiga', tipo: 'despesa', escopo: 'individual' });
    await pedir(app, 'POST', `/api/categorias/${id}/arquivar`, titular);
    const lista = await listar<Linha>(app, '/api/categorias', titular);
    expect(lista.find((c) => c.id === id)).toMatchObject({ arquivada: true, pode_excluir: true });
  });
});

describe.skipIf(!bancoDisponivel)('PUT /api/categorias/:id (salvar)', () => {
  it('cria despesa conjunta (201): os dois membros a veem, sem dono; variável ausente vira falso', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.conjunta');
    const id = novoId();
    const r = await salvar(app, titular, { nome: '  Pet  ', tipo: 'despesa', escopo: 'conjunto' }, id);
    expect(r.status).toBe(201);
    expect(saida.IdSalvo.parse(await json(r))).toEqual({ id });
    for (const quem of [titular, membro]) {
      const c = (await listar<Linha>(app, '/api/categorias', quem)).find((l) => l.id === id);
      expect(c).toEqual({
        id,
        nome: 'Pet',
        tipo: 'despesa',
        escopo: 'conjunto',
        variavel: false,
        arquivada: false,
        pode_excluir: true,
      });
    }
    const dono = await linhasComoOwner(
      sql<{ dono_id: string | null }>`select dono_id from app.categoria where id = ${id}`,
    );
    expect(dono).toEqual([{ dono_id: null }]);
  });

  it('CA-17.1: receita conjunta é gravada como individual do membro, sem a marca variável', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.receita');
    const id = novoId();
    const r = await salvar(app, titular, { nome: 'Bônus', tipo: 'receita', escopo: 'conjunto', variavel: true }, id);
    expect(r.status).toBe(201);
    const c = (await listar<Linha>(app, '/api/categorias', titular)).find((l) => l.id === id);
    expect(c).toMatchObject({ tipo: 'receita', escopo: 'individual', variavel: null });
    expect((await listar<Linha>(app, '/api/categorias', membro)).some((l) => l.id === id)).toBe(false);
  });

  it('CA-17.2: "Mercado" despesa conjunta repetida no lar dá 409 nome_repetido (a criação é desfeita)', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.repetida');
    const id = novoId();
    for (const quem of [titular, membro]) {
      const r = await salvar(app, quem, { nome: 'Mercado', tipo: 'despesa', escopo: 'conjunto' }, id);
      expect(r.status).toBe(409);
      expect(await json(r)).toMatchObject({ code: 'nome_repetido' });
    }
    expect(await contarPorId('categoria', id)).toBe(0);
  });

  it('CA-17.3: cada membro cria a própria "Academia" individual; coexistem. Conjunta e individual podem ter o mesmo nome', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.coexistem');
    const a = await criarCategoria(app, titular, { nome: 'Academia', tipo: 'despesa', escopo: 'individual' });
    const b = await criarCategoria(app, membro, { nome: 'Academia', tipo: 'despesa', escopo: 'individual' });
    const c = await criarCategoria(app, titular, { nome: 'Academia', tipo: 'despesa', escopo: 'conjunto' });
    expect(new Set([a, b, c]).size).toBe(3);
    const repetida = await salvar(app, titular, { nome: 'Academia', tipo: 'despesa', escopo: 'individual' });
    expect(repetida.status).toBe(409);
    expect(await json(repetida)).toMatchObject({ code: 'nome_repetido' });
  });

  it('despesa e receita individuais podem ter o mesmo nome ("Outros" já existe nas iniciais dos dois tipos)', async () => {
    const { app, titular } = await larParaCadastros('cat.mesmonome-tipo');
    const lista = await listar<Linha>(app, '/api/categorias', titular);
    expect(
      lista
        .filter((c) => c.nome === 'Outros' && c.escopo === 'individual')
        .map((c) => c.tipo)
        .sort(),
    ).toEqual(['despesa', 'receita']);
  });

  it('CA-T3.1: reenviar o mesmo id não duplica (200); com outro corpo renomeia a mesma categoria', async () => {
    const { app, titular } = await larParaCadastros('cat.idem');
    const id = novoId();
    const corpo = { nome: 'Pet', tipo: 'despesa', escopo: 'conjunto', variavel: true };
    expect((await salvar(app, titular, corpo, id)).status).toBe(201);
    const de_novo = await salvar(app, titular, corpo, id);
    expect(de_novo.status).toBe(200);
    expect(await json(de_novo)).toEqual({ id });
    expect((await salvar(app, titular, { ...corpo, nome: 'Pets', variavel: false }, id)).status).toBe(200);
    expect(await contarPorId('categoria', id)).toBe(1);
    expect((await listar<Linha>(app, '/api/categorias', titular)).find((c) => c.id === id)).toMatchObject({
      nome: 'Pets',
      variavel: false,
    });
  });

  it('renomear para um nome que já existe no mesmo (lar, tipo, escopo, dono): 409 nome_repetido', async () => {
    const { app, titular } = await larParaCadastros('cat.renomear');
    const id = await criarCategoria(app, titular, { nome: 'Pet', tipo: 'despesa', escopo: 'conjunto' });
    const r = await salvar(app, titular, { nome: 'Mercado', tipo: 'despesa', escopo: 'conjunto' }, id);
    expect(r.status).toBe(409);
    expect(await json(r)).toMatchObject({ code: 'nome_repetido' });
  });

  it('RN-17: tipo e escopo não mudam depois de criada (400 valor_invalido)', async () => {
    const { app, titular } = await larParaCadastros('cat.imutavel');
    const id = await criarCategoria(app, titular, { nome: 'Pet', tipo: 'despesa', escopo: 'conjunto' });
    for (const corpo of [
      { nome: 'Pet', tipo: 'receita', escopo: 'conjunto' },
      { nome: 'Pet', tipo: 'despesa', escopo: 'individual' },
    ]) {
      const r = await salvar(app, titular, corpo, id);
      expect(r.status, JSON.stringify(corpo)).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'valor_invalido' });
    }
  });

  it('a conjunta é editável pelos dois membros; editar não desarquiva', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.conjunta-edicao');
    const id = await criarCategoria(app, titular, { nome: 'Pet', tipo: 'despesa', escopo: 'conjunto' });
    await pedir(app, 'POST', `/api/categorias/${id}/arquivar`, titular);
    expect((await salvar(app, membro, { nome: 'Pets', tipo: 'despesa', escopo: 'conjunto' }, id)).status).toBe(200);
    expect((await listar<Linha>(app, '/api/categorias', titular)).find((c) => c.id === id)).toMatchObject({
      nome: 'Pets',
      arquivada: true,
    });
  });

  it('CA-18.1 (nome): vazio, só espaços ou acima de 120 caracteres reais dá 400; 120 emojis passam', async () => {
    const { app, titular } = await larParaCadastros('cat.nome');
    const base = { tipo: 'despesa', escopo: 'conjunto' };
    expect((await salvar(app, titular, { ...base, nome: '   ' })).status).toBe(400);
    expect((await salvar(app, titular, { ...base, nome: 'a'.repeat(121) })).status).toBe(400);
    expect((await salvar(app, titular, { ...base, nome: '😀'.repeat(120) })).status).toBe(201);
    expect((await salvar(app, titular, { ...base, nome: '😀'.repeat(121) })).status).toBe(400);
  });

  it('tipo ou escopo desconhecidos, dono e arquivada vindos do cliente: 400', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.extras');
    const base = { nome: 'X', tipo: 'despesa', escopo: 'conjunto' };
    for (const extra of [{ tipo: 'outro' }, { escopo: 'casal' }, { dono_id: membro.id }, { arquivada: true }]) {
      expect((await salvar(app, titular, { ...base, ...extra })).status).toBe(400);
    }
  });

  it('individual do outro membro: PUT com o id dela dá 404 registro_invalido e nada muda', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.indiv-alheia');
    const id = await criarCategoria(app, titular, { nome: 'Segredo', tipo: 'despesa', escopo: 'individual' });
    const r = await salvar(app, membro, { nome: 'Invadida', tipo: 'despesa', escopo: 'individual' }, id);
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'registro_invalido' });
    expect((await listar<Linha>(app, '/api/categorias', titular)).find((c) => c.id === id)?.nome).toBe('Segredo');
  });
});

describe.skipIf(!bancoDisponivel)('arquivar e excluir categoria (RN-17)', () => {
  it('arquivar é idempotente (204 duas vezes); conjunta pelos dois, individual só pelo dono', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.arquivar');
    const conj = await criarCategoria(app, titular, { nome: 'Pet', tipo: 'despesa', escopo: 'conjunto' });
    const ind = await criarCategoria(app, titular, { nome: 'Academia', tipo: 'despesa', escopo: 'individual' });
    expect((await pedir(app, 'POST', `/api/categorias/${conj}/arquivar`, titular)).status).toBe(204);
    expect((await pedir(app, 'POST', `/api/categorias/${conj}/arquivar`, membro)).status).toBe(204);
    const alheia = await pedir(app, 'POST', `/api/categorias/${ind}/arquivar`, membro);
    expect(alheia.status).toBe(404);
    expect(await json(alheia)).toMatchObject({ code: 'registro_invalido' });
    expect((await pedir(app, 'POST', `/api/categorias/${novoId()}/arquivar`, titular)).status).toBe(404);
    const lista = await listar<Linha>(app, '/api/categorias', titular);
    expect(lista.find((c) => c.id === conj)?.arquivada).toBe(true);
    expect(lista.find((c) => c.id === ind)?.arquivada).toBe(false);
  });

  it('excluir sem vínculo: 204 e some; de novo, 404; individual do outro: 404 e fica', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.excluir');
    const conj = await criarCategoria(app, titular, { nome: 'Pet', tipo: 'despesa', escopo: 'conjunto' });
    const ind = await criarCategoria(app, titular, { nome: 'Academia', tipo: 'despesa', escopo: 'individual' });
    expect((await pedir(app, 'DELETE', `/api/categorias/${ind}`, membro)).status).toBe(404);
    expect(await contarPorId('categoria', ind)).toBe(1);
    expect((await pedir(app, 'DELETE', `/api/categorias/${conj}`, membro)).status).toBe(204);
    expect(await contarPorId('categoria', conj)).toBe(0);
    expect((await pedir(app, 'DELETE', `/api/categorias/${conj}`, titular)).status).toBe(404);
  });

  it('renomear ou excluir uma inicial não a recria (CA-17.4)', async () => {
    const { app, titular } = await larParaCadastros('cat.inicial');
    const lista = await listar<Linha>(app, '/api/categorias', titular);
    const mercado = lista.find((c) => c.nome === 'Mercado' && c.escopo === 'conjunto')!;
    expect((await pedir(app, 'DELETE', `/api/categorias/${mercado.id}`, titular)).status).toBe(204);
    const depois = await listar<Linha>(app, '/api/categorias', titular);
    expect(depois).toHaveLength(12);
    expect(depois.some((c) => c.nome === 'Mercado')).toBe(false);
  });
});

describe.skipIf(!bancoDisponivel)('excluir categoria com vínculo (categoria_em_uso)', () => {
  // Nenhuma tabela da etapa 7 referencia categoria (lançamento, orçamento e fixa são das etapas 8 a 10): uma
  // tabela de teste com FK para categoria, criada como owner, prova a tradução do 23503 em categoria_em_uso.
  const TABELA = `teste_vinculo_categoria_${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    await comoOwner((db) =>
      sql`create table ${sql.table(`app.${TABELA}`)} (categoria_id uuid not null references app.categoria (id))`.execute(
        db,
      ),
    );
  });
  afterAll(async () => {
    if (!bancoDisponivel) return;
    await comoOwner((db) => sql`drop table if exists ${sql.table(`app.${TABELA}`)}`.execute(db));
  });

  it('com vínculo: 409 categoria_em_uso e a categoria fica; a alheia responde registro_invalido antes (CA-T1.3)', async () => {
    const { app, titular, membro } = await larParaCadastros('cat.em-uso');
    const ind = await criarCategoria(app, titular, { nome: 'Academia', tipo: 'despesa', escopo: 'individual' });
    const conj = await criarCategoria(app, titular, { nome: 'Pet', tipo: 'despesa', escopo: 'conjunto' });
    for (const id of [ind, conj]) {
      await linhasComoOwner(sql`insert into ${sql.table(`app.${TABELA}`)} (categoria_id) values (${id})`);
    }
    const alheia = await pedir(app, 'DELETE', `/api/categorias/${ind}`, membro);
    expect(alheia.status).toBe(404);
    expect(await json(alheia)).toMatchObject({ code: 'registro_invalido' });
    for (const [id, quem] of [
      [ind, titular],
      [conj, membro],
    ] as const) {
      const r = await pedir(app, 'DELETE', `/api/categorias/${id}`, quem);
      expect(r.status).toBe(409);
      expect(await json(r)).toMatchObject({ code: 'categoria_em_uso' });
      expect(await contarPorId('categoria', id)).toBe(1);
    }
  });
});
