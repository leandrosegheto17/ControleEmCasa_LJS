import { describe, expect, it } from 'vitest';
import {
  avaliarEdicao,
  detectarMudancas,
  edicaoRecalculaParcelas,
  permissoesEdicao,
  podeAlterarDataParcela,
  podeExcluir,
  verificarDescarteDeAjustes,
  type ContextoEdicao,
  type EstadoLancamento,
  type MudancasEdicao,
} from './permissoes';

const ok = { ok: true, valor: undefined };
const registroInvalido = { ok: false, erro: 'registro_invalido' };
const semPermissao = { ok: false, erro: 'sem_permissao' };

const ctx = (c: Partial<ContextoEdicao>): ContextoEdicao => ({
  souDono: true,
  escopo: 'conjunto',
  formaCredito: false,
  pagamentoDeFixa: false,
  ...c,
});

const nenhuma: MudancasEdicao = {
  descricao: false,
  valor: false,
  data: false,
  forma: false,
  parcelas: false,
  categoria: false,
  trocaEscopo: false,
};
const muda = (m: Partial<MudancasEdicao>): MudancasEdicao => ({ ...nenhuma, ...m });

// Os 7 booleanos do legado, na ordem (descricao, valor, data, categoria_mesmo_escopo, troca_escopo, forma, parcelas).
const legado = (c: ContextoEdicao) => {
  const r = permissoesEdicao(c);
  if (!r.ok) return r;
  const p = r.valor;
  return [p.descricao, p.valor, p.data, p.categoriaMesmoEscopo, p.trocaEscopo, p.forma, p.parcelas];
};

// Casos portados de MyMoney/backend/supabase/tests/lancamentos/permissoes_edicao.sql.
describe('permissoesEdicao: casos do pgTAP', () => {
  const tudo = [true, true, true, true, true, true, true];
  it('A na própria conjunta Pix: tudo', () => expect(legado(ctx({}))).toEqual(tudo));
  it('A na própria conjunta crédito 3x: tudo', () => expect(legado(ctx({ formaCredito: true }))).toEqual(tudo));
  it('A na própria individual: tudo', () => expect(legado(ctx({ escopo: 'individual' }))).toEqual(tudo));
  it('A na própria receita (individual): tudo', () => expect(legado(ctx({ escopo: 'individual' }))).toEqual(tudo));
  it('outro membro na conjunta Pix: descrição, valor, data e categoria conjunta; sem escopo, forma e parcelas', () => {
    expect(legado(ctx({ souDono: false }))).toEqual([true, true, true, true, false, false, false]);
  });
  it('outro membro na conjunta crédito (3x ou à vista): sem data', () => {
    expect(legado(ctx({ souDono: false, formaCredito: true }))).toEqual([true, true, false, true, false, false, false]);
  });
  it('outro membro na individual (ou receita) do dono: registro_invalido', () => {
    expect(permissoesEdicao(ctx({ souDono: false, escopo: 'individual' }))).toEqual(registroInvalido);
  });
  it('outro membro no pagamento de fixa: nada (tests/lancamentos/lancamento_de_fixa.sql)', () => {
    expect(legado(ctx({ souDono: false, pagamentoDeFixa: true }))).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

// Matriz da RN-06 (PRD-TECNICO), com as colunas novas (data de uma parcela e excluir) e a RN-28.
describe('permissoesEdicao: matriz da RN-06 e RN-28', () => {
  it('dono: data de uma parcela só no Crédito', () => {
    expect(permissoesEdicao(ctx({ formaCredito: true }))).toMatchObject({ ok: true, valor: { dataParcela: true } });
    expect(permissoesEdicao(ctx({ formaCredito: false }))).toMatchObject({ ok: true, valor: { dataParcela: false } });
  });
  it('dono: exclui sempre; outro membro: exclui a conjunta comum, não o pagamento de fixa', () => {
    expect(permissoesEdicao(ctx({}))).toMatchObject({ valor: { excluir: true } });
    expect(permissoesEdicao(ctx({ souDono: false }))).toMatchObject({ valor: { excluir: true } });
    expect(permissoesEdicao(ctx({ souDono: false, pagamentoDeFixa: true }))).toMatchObject({
      valor: { excluir: false },
    });
  });
  it('RN-28: pagador no pagamento de fixa muda valor, descrição, data, forma e categoria conjunta; não troca escopo nem ajusta parcela', () => {
    expect(permissoesEdicao(ctx({ pagamentoDeFixa: true, formaCredito: true }))).toEqual({
      ok: true,
      valor: {
        descricao: true,
        valor: true,
        data: true,
        categoriaMesmoEscopo: true,
        trocaEscopo: false,
        forma: true,
        parcelas: true,
        dataParcela: false,
        excluir: true,
      },
    });
  });
});

describe('avaliarEdicao (RN-06, RN-07, RN-28)', () => {
  it('CA-06.1: outro membro edita descrição e valor de uma conjunta Pix → aceita', () => {
    expect(avaliarEdicao(ctx({ souDono: false }), muda({ descricao: true, valor: true }))).toEqual(ok);
  });
  it('outro membro troca a data de uma conjunta Pix → aceita', () => {
    expect(avaliarEdicao(ctx({ souDono: false }), muda({ data: true }))).toEqual(ok);
  });
  it('outro membro troca para outra categoria conjunta → aceita', () => {
    expect(avaliarEdicao(ctx({ souDono: false }), muda({ categoria: true }))).toEqual(ok);
  });
  it('CA-06.2: outro membro, conjunta no Crédito, data nova junto com descrição nova → sem_permissao (recusa inteira)', () => {
    expect(avaliarEdicao(ctx({ souDono: false, formaCredito: true }), muda({ data: true, descricao: true }))).toEqual(
      semPermissao,
    );
  });
  it('CA-06.3: outro membro muda a forma → sem_permissao', () => {
    expect(avaliarEdicao(ctx({ souDono: false }), muda({ forma: true }))).toEqual(semPermissao);
  });
  it('CA-06.3: outro membro muda o nº de parcelas → sem_permissao', () => {
    expect(avaliarEdicao(ctx({ souDono: false, formaCredito: true }), muda({ parcelas: true }))).toEqual(semPermissao);
  });
  it('mudança permitida junto com proibida é recusada inteira (editar_permissoes.sql)', () => {
    expect(
      avaliarEdicao(ctx({ souDono: false, formaCredito: true }), muda({ descricao: true, parcelas: true })),
    ).toEqual(semPermissao);
  });
  it('CA-07.2: outro membro troca a conjunta para uma categoria individual → sem_permissao', () => {
    expect(avaliarEdicao(ctx({ souDono: false }), muda({ categoria: true, trocaEscopo: true }))).toEqual(semPermissao);
  });
  it('CA-07.1: o dono troca a conjunta para individual dele → aceita', () => {
    expect(avaliarEdicao(ctx({}), muda({ categoria: true, trocaEscopo: true }))).toEqual(ok);
  });
  it('dono muda tudo de uma conjunta no Crédito → aceita', () => {
    expect(
      avaliarEdicao(
        ctx({ formaCredito: true }),
        muda({ descricao: true, valor: true, data: true, forma: true, parcelas: true, categoria: true }),
      ),
    ).toEqual(ok);
  });
  it('edição sem nenhuma mudança efetiva → aceita (até para o outro membro no pagamento de fixa)', () => {
    expect(avaliarEdicao(ctx({ souDono: false, pagamentoDeFixa: true }), nenhuma)).toEqual(ok);
  });
  it('outro membro em lançamento individual do dono → registro_invalido, mesmo com mudança proibida', () => {
    expect(avaliarEdicao(ctx({ souDono: false, escopo: 'individual' }), muda({ forma: true }))).toEqual(
      registroInvalido,
    );
  });
  it.each([
    ['valor', { valor: true }],
    ['data', { data: true }],
    ['descrição', { descricao: true }],
    ['categoria', { categoria: true }],
  ])('CA-28.7: outro membro muda %s do pagamento de fixa → sem_permissao', (_campo, m) => {
    expect(avaliarEdicao(ctx({ souDono: false, pagamentoDeFixa: true }), muda(m))).toEqual(semPermissao);
  });
  it('CA-28.1/28.2/28.6: pagador muda valor, data e forma do pagamento de fixa → aceita', () => {
    expect(avaliarEdicao(ctx({ pagamentoDeFixa: true }), muda({ valor: true, data: true, forma: true }))).toEqual(ok);
  });
  it('RN-28: pagador troca para outra categoria conjunta → aceita', () => {
    expect(avaliarEdicao(ctx({ pagamentoDeFixa: true }), muda({ categoria: true }))).toEqual(ok);
  });
  it('CA-28.3: pagador troca o pagamento de fixa para uma categoria individual dele → sem_permissao', () => {
    expect(avaliarEdicao(ctx({ pagamentoDeFixa: true }), muda({ categoria: true, trocaEscopo: true }))).toEqual(
      semPermissao,
    );
  });
  it('CA-28.4: pagador muda o nº de parcelas do pagamento de fixa → valor_invalido', () => {
    expect(avaliarEdicao(ctx({ pagamentoDeFixa: true, formaCredito: true }), muda({ parcelas: true }))).toEqual({
      ok: false,
      erro: 'valor_invalido',
    });
  });
  it('ordem: sem_permissao vem antes de valor_invalido no pagamento de fixa', () => {
    expect(
      avaliarEdicao(ctx({ pagamentoDeFixa: true }), muda({ parcelas: true, categoria: true, trocaEscopo: true })),
    ).toEqual(semPermissao);
  });
});

// Detecção de mudanças: A editar_lancamento.sql:78-85; tests/lancamentos/editar_permissoes.sql.
describe('detectarMudancas', () => {
  const estado: EstadoLancamento = {
    descricao: 'Sofá',
    valorTotalCentavos: 30000,
    dataOperacao: '2031-03-06',
    formaId: 'f1',
    numParcelas: 3,
    categoriaId: 'c1',
    escopo: 'conjunto',
  };
  const det = (pedido: Parameters<typeof detectarMudancas>[1]) => detectarMudancas(estado, pedido);

  it('parâmetro ausente (undefined ou null) não muda', () => {
    expect(det({})).toEqual(nenhuma);
    expect(
      det({ descricao: null, valorTotalCentavos: null, data: null, formaId: null, numParcelas: null, categoria: null }),
    ).toEqual(nenhuma);
  });
  it('parâmetro igual ao gravado não conta como mudança', () => {
    expect(
      det({ numParcelas: 3, descricao: 'Sofá', valorTotalCentavos: 30000, data: '2031-03-06', formaId: 'f1' }),
    ).toEqual(nenhuma);
  });
  it('descrição com espaços em volta igual à gravada não muda; descrição nova muda', () => {
    expect(det({ descricao: '  Sofá  ' }).descricao).toBe(false);
    expect(det({ descricao: 'Sofá novo' }).descricao).toBe(true);
  });
  it('descrição vazia limpa (é mudança quando havia descrição)', () => {
    expect(det({ descricao: '   ' }).descricao).toBe(true);
    expect(detectarMudancas({ ...estado, descricao: null }, { descricao: '' }).descricao).toBe(false);
  });
  it('cada campo diferente é mudança', () => {
    expect(det({ valorTotalCentavos: 30001 })).toEqual(muda({ valor: true }));
    expect(det({ data: '2031-03-20' })).toEqual(muda({ data: true }));
    expect(det({ formaId: 'f2' })).toEqual(muda({ forma: true }));
    expect(det({ numParcelas: 6 })).toEqual(muda({ parcelas: true }));
  });
  it('categoria do mesmo escopo muda a categoria sem trocar escopo; de outro escopo troca', () => {
    expect(det({ categoria: { id: 'c2', escopo: 'conjunto' } })).toEqual(muda({ categoria: true }));
    expect(det({ categoria: { id: 'c3', escopo: 'individual' } })).toEqual(
      muda({ categoria: true, trocaEscopo: true }),
    );
    expect(det({ categoria: { id: 'c1', escopo: 'conjunto' } })).toEqual(nenhuma);
  });
});

describe('recálculo e descarte de ajustes (RN-06, CA-06.4)', () => {
  it('valor, parcelas, data, forma ou categoria recalculam; só descrição não', () => {
    expect(edicaoRecalculaParcelas(muda({ descricao: true }))).toBe(false);
    for (const campo of ['valor', 'parcelas', 'data', 'forma', 'categoria'] as const) {
      expect(edicaoRecalculaParcelas(muda({ [campo]: true }))).toBe(true);
    }
  });
  it('CA-06.4: recalcular com parcela ajustada sem confirmar → confirmar_descarte_ajustes', () => {
    expect(verificarDescarteDeAjustes({ recalcula: true, haParcelaAjustada: true, confirmarDescarte: false })).toEqual({
      ok: false,
      erro: 'confirmar_descarte_ajustes',
    });
  });
  it('CA-06.4: com confirmar_descarte = true, segue', () => {
    expect(verificarDescarteDeAjustes({ recalcula: true, haParcelaAjustada: true, confirmarDescarte: true })).toEqual(
      ok,
    );
  });
  it('sem recálculo (só descrição) não pede confirmação', () => {
    expect(verificarDescarteDeAjustes({ recalcula: false, haParcelaAjustada: true, confirmarDescarte: false })).toEqual(
      ok,
    );
  });
  it('sem parcela ajustada não pede confirmação', () => {
    expect(verificarDescarteDeAjustes({ recalcula: true, haParcelaAjustada: false, confirmarDescarte: false })).toEqual(
      ok,
    );
  });
});

// CA-06.7 e CA-28.5; legado A alterar_data_parcela.sql.
describe('podeAlterarDataParcela (CA-06.7, CA-28.5)', () => {
  it('o pagador altera a data de uma parcela de compra no Crédito', () => {
    expect(podeAlterarDataParcela(ctx({ formaCredito: true }))).toEqual(ok);
    expect(podeAlterarDataParcela(ctx({ formaCredito: true, escopo: 'individual' }))).toEqual(ok);
  });
  it('compra que não é no Crédito → registro_invalido', () => {
    expect(podeAlterarDataParcela(ctx({ formaCredito: false }))).toEqual(registroInvalido);
  });
  it('parcela de outro membro (conjunta ou individual) → registro_invalido', () => {
    expect(podeAlterarDataParcela(ctx({ souDono: false, formaCredito: true }))).toEqual(registroInvalido);
    expect(podeAlterarDataParcela(ctx({ souDono: false, formaCredito: true, escopo: 'individual' }))).toEqual(
      registroInvalido,
    );
  });
  it('CA-28.5: parcela do pagamento de fixa no Crédito → registro_invalido', () => {
    expect(podeAlterarDataParcela(ctx({ formaCredito: true, pagamentoDeFixa: true }))).toEqual(registroInvalido);
  });
});

// CA-06.8, CA-15.7, CA-28.7; tests/lancamentos/lancamento_de_fixa.sql:38-59.
describe('podeExcluir', () => {
  it('o dono exclui a própria conjunta, individual e o pagamento de fixa', () => {
    expect(podeExcluir(ctx({}))).toEqual(ok);
    expect(podeExcluir(ctx({ escopo: 'individual' }))).toEqual(ok);
    expect(podeExcluir(ctx({ pagamentoDeFixa: true }))).toEqual(ok);
  });
  it('o outro membro exclui a conjunta comum do dono', () => {
    expect(podeExcluir(ctx({ souDono: false }))).toEqual(ok);
  });
  it('CA-15.7 / CA-28.7: o outro membro não exclui o pagamento de fixa → registro_invalido', () => {
    expect(podeExcluir(ctx({ souDono: false, pagamentoDeFixa: true }))).toEqual(registroInvalido);
  });
  it('o outro membro não exclui o individual do dono → registro_invalido', () => {
    expect(podeExcluir(ctx({ souDono: false, escopo: 'individual' }))).toEqual(registroInvalido);
  });
});
