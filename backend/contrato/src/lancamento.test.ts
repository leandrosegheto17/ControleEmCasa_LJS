import { describe, expect, it } from 'vitest';
import { entrada, entradaLancamento, saida, saidaLancamento } from './index';

/**
 * Contrato dos lançamentos (SDD 6.1 #4, #15, #20 a #26; RN-01, RN-04, RN-18; G-11 chaves omitidas, G-26 sem dono
 * no corpo). Os casos nascem de CA-01.2, CA-04.1, CA-04.2, CA-P.1, CA-06.7 e CA-T4.2.
 */
const ID = '00000000-0000-4000-8000-000000000001';
const ID2 = '00000000-0000-4000-8000-000000000002';

const despesa = { id: ID, valor_centavos: 1000, categoria_id: ID, forma_id: ID2 };

describe('LancarDespesa', () => {
  it('mínimo válido; parcelas, data e descrição são opcionais', () => {
    expect(entradaLancamento.LancarDespesa.parse(despesa)).toEqual(despesa);
    expect(
      entradaLancamento.LancarDespesa.safeParse({ ...despesa, parcelas: 3, data: '2026-10-15', descricao: 'Sofá' })
        .success,
    ).toBe(true);
  });

  it('CA-01.2 e G-26: escopo, lar_id e dono_id no corpo são recusados (o contrato não os tem)', () => {
    for (const campo of ['escopo', 'lar_id', 'dono_id']) {
      expect(entradaLancamento.LancarDespesa.safeParse({ ...despesa, [campo]: 'conjunto' }).success, campo).toBe(false);
    }
  });

  it('id malformado, valor fracionário ou como texto e data inexistente são recusados', () => {
    expect(entradaLancamento.LancarDespesa.safeParse({ ...despesa, id: 'x' }).success).toBe(false);
    expect(entradaLancamento.LancarDespesa.safeParse({ ...despesa, valor_centavos: 10.5 }).success).toBe(false);
    expect(entradaLancamento.LancarDespesa.safeParse({ ...despesa, valor_centavos: '10' }).success).toBe(false);
    for (const data of ['2026-02-30', '2026-13-01', '15/10/2026', '2026-10-1']) {
      expect(entradaLancamento.LancarDespesa.safeParse({ ...despesa, data }).success, data).toBe(false);
    }
    expect(entradaLancamento.LancarDespesa.safeParse({ ...despesa, data: '2028-02-29' }).success).toBe(true);
  });

  it('a faixa do valor fica para o caso de uso (depois da idempotência, RT-02): 0 passa no contrato', () => {
    expect(entradaLancamento.LancarDespesa.safeParse({ ...despesa, valor_centavos: 0 }).success).toBe(true);
  });
});

describe('LancarReceita', () => {
  it('exige conta e não aceita forma', () => {
    const receita = { id: ID, valor_centavos: 1, categoria_id: ID, conta_id: ID2 };
    expect(entradaLancamento.LancarReceita.safeParse(receita).success).toBe(true);
    expect(entradaLancamento.LancarReceita.safeParse({ ...receita, forma_id: ID }).success).toBe(false);
    expect(entradaLancamento.LancarReceita.safeParse({ ...receita, conta_id: undefined }).success).toBe(false);
  });
});

describe('FiltroLancamentos', () => {
  it('mês obrigatório; variavel chega como texto e vira booleano', () => {
    expect(entradaLancamento.FiltroLancamentos.parse({ mes: '2026-10-17', variavel: 'true' })).toEqual({
      mes: '2026-10-17',
      variavel: true,
    });
    expect(entradaLancamento.FiltroLancamentos.safeParse({}).success).toBe(false);
    expect(entradaLancamento.FiltroLancamentos.safeParse({ mes: '2026-10-01', escopo: 'casal' }).success).toBe(false);
    expect(entradaLancamento.FiltroLancamentos.safeParse({ mes: '2026-10-01', variavel: 'sim' }).success).toBe(false);
  });
});

describe('EditarLancamento e AlterarDataParcela', () => {
  it('tudo opcional e anulável; escopo e dono não existem', () => {
    expect(entradaLancamento.EditarLancamento.safeParse({}).success).toBe(true);
    expect(entradaLancamento.EditarLancamento.safeParse({ descricao: null, data: null }).success).toBe(true);
    expect(entradaLancamento.EditarLancamento.safeParse({ escopo: 'individual' }).success).toBe(false);
    expect(entradaLancamento.EditarLancamento.safeParse({ dono_id: ID }).success).toBe(false);
  });

  it('CA-06.7: data da parcela vazia ou nula é recusada', () => {
    for (const data of [null, '', undefined]) {
      expect(entradaLancamento.AlterarDataParcela.safeParse({ data }).success).toBe(false);
    }
    expect(entradaLancamento.AlterarDataParcela.safeParse({ data: '2026-12-20' }).success).toBe(true);
  });
});

describe('PagamentoCartao', () => {
  it('valor positivo (RN-18); data opcional', () => {
    const p = { id: ID, conta_id: ID2, valor_centavos: 1 };
    expect(entradaLancamento.PagamentoCartao.safeParse(p).success).toBe(true);
    expect(entradaLancamento.PagamentoCartao.safeParse({ ...p, valor_centavos: 0 }).success).toBe(false);
    expect(entradaLancamento.PagamentoCartao.safeParse({ ...p, valor_centavos: -5 }).success).toBe(false);
  });
});

describe('saídas do detalhe (RN-04, G-11)', () => {
  const cabecalho = {
    id: ID,
    tipo: 'despesa',
    escopo: 'conjunto',
    descricao: null,
    categoria: { id: ID, nome: 'Mercado', escopo: 'conjunto' },
    valor_total_centavos: 300,
    num_parcelas: 1,
    pagador: { id: ID2, nome: 'Ana', sou_eu: false },
    alterado_por: null,
    alterado_em: null,
    parcela_em_foco: 1,
  };
  const parcela = { id: ID, numero: 1, valor_centavos: 300, data: '2026-10-15' };

  it('CA-P.1: a forma do outro membro recusa `pagamento` e `data_ajustada`, até com null', () => {
    const outro = saidaLancamento.LancamentoDoOutroMembro;
    expect(outro.safeParse({ ...cabecalho, parcelas: [parcela] }).success).toBe(true);
    expect(outro.safeParse({ ...cabecalho, parcelas: [parcela], pagamento: null }).success).toBe(false);
    expect(outro.safeParse({ ...cabecalho, parcelas: [{ ...parcela, data_ajustada: false }] }).success).toBe(false);
    expect(outro.safeParse({ ...cabecalho, parcelas: [{ ...parcela, data_ajustada: null }] }).success).toBe(false);
  });

  it('CA-04.1: a forma do pagador exige `pagamento` e `data_ajustada`', () => {
    const pagador = saidaLancamento.LancamentoDoPagador;
    const pagamento = {
      forma: null,
      conta: { id: ID, nome: 'Itaú' },
      data_operacao: '2026-10-15',
      dia_vencimento_aplicado: null,
    };
    expect(
      pagador.safeParse({ ...cabecalho, parcelas: [{ ...parcela, data_ajustada: false }], pagamento }).success,
    ).toBe(true);
    expect(pagador.safeParse({ ...cabecalho, parcelas: [{ ...parcela, data_ajustada: false }] }).success).toBe(false);
  });

  it('as escritas aparecem nos agregados `entrada` e `saida` do contrato', () => {
    expect(entrada.LancarDespesa).toBe(entradaLancamento.LancarDespesa);
    expect(saida.Lancamento).toBe(saidaLancamento.Lancamento);
    expect(saida.PagamentoCartao.safeParse({ id: ID, ja_existia: true }).success).toBe(true);
  });
});
