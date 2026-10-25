import { describe, expect, it } from 'vitest';
import { entrada, entradaFixas, saida, saidaFixas } from './index';

/**
 * Contrato das despesas fixas e do resumo do mês (SDD 6.1 #27 a #33; RN-15, RN-16, RN-04, RN-28; G-11, G-22,
 * G-26). Os casos nascem de CA-15.5, CA-15.6, §2.1 (forma, conta e data do pagamento nunca saem na lista de
 * ocorrências) e CA-T4.2 (mês normalizado).
 */
const ID = '00000000-0000-4000-8000-000000000001';
const ID2 = '00000000-0000-4000-8000-000000000002';

describe('SalvarFixa', () => {
  const fixa = { descricao: 'Aluguel', categoria_id: ID, valor_previsto_centavos: 150_000, dia_vencimento: 10 };

  it('os quatro campos são obrigatórios', () => {
    expect(entradaFixas.SalvarFixa.parse(fixa)).toEqual(fixa);
    for (const campo of Object.keys(fixa)) {
      const sem: Record<string, unknown> = { ...fixa };
      delete sem[campo];
      expect(entradaFixas.SalvarFixa.safeParse(sem).success, campo).toBe(false);
    }
  });

  it('G-26 e RN-15: lar_id, escopo, tipo, inicio e encerrada_em no corpo são recusados', () => {
    for (const campo of ['lar_id', 'escopo', 'tipo', 'inicio', 'encerrada_em']) {
      expect(entradaFixas.SalvarFixa.safeParse({ ...fixa, [campo]: 'x' }).success, campo).toBe(false);
    }
  });

  it('valores fracionários ou como texto são recusados; as faixas ficam para o domínio', () => {
    expect(entradaFixas.SalvarFixa.safeParse({ ...fixa, valor_previsto_centavos: 1.5 }).success).toBe(false);
    expect(entradaFixas.SalvarFixa.safeParse({ ...fixa, dia_vencimento: '10' }).success).toBe(false);
    expect(entradaFixas.SalvarFixa.safeParse({ ...fixa, categoria_id: 'x' }).success).toBe(false);
  });
});

describe('PagarOcorrencia', () => {
  it('id e forma obrigatórios; valor e data opcionais (padrão: previsto e hoje)', () => {
    expect(entradaFixas.PagarOcorrencia.safeParse({ id: ID, forma_id: ID2 }).success).toBe(true);
    expect(
      entradaFixas.PagarOcorrencia.safeParse({ id: ID, forma_id: ID2, valor_centavos: 100, data: '2026-10-10' })
        .success,
    ).toBe(true);
    expect(entradaFixas.PagarOcorrencia.safeParse({ forma_id: ID2 }).success).toBe(false);
    expect(entradaFixas.PagarOcorrencia.safeParse({ id: ID }).success).toBe(false);
  });

  it('data inexistente e conta_id, parcelas ou categoria_id no corpo são recusados', () => {
    expect(entradaFixas.PagarOcorrencia.safeParse({ id: ID, forma_id: ID2, data: '2026-02-30' }).success).toBe(false);
    for (const campo of ['conta_id', 'parcelas', 'categoria_id', 'dono_id']) {
      expect(entradaFixas.PagarOcorrencia.safeParse({ id: ID, forma_id: ID2, [campo]: ID }).success, campo).toBe(false);
    }
  });
});

describe('filtros de mês (CA-T4.2)', () => {
  it('ocorrências exigem o mês; o resumo o aceita ausente (mês corrente)', () => {
    expect(entradaFixas.FiltroOcorrencias.safeParse({ mes: '2026-10-17' }).success).toBe(true);
    expect(entradaFixas.FiltroOcorrencias.safeParse({}).success).toBe(false);
    expect(entradaFixas.FiltroResumo.safeParse({}).success).toBe(true);
    expect(entradaFixas.FiltroResumo.safeParse({ mes: '2026-13-01' }).success).toBe(false);
    expect(entradaFixas.FiltroResumo.safeParse({ mes: '2026-10-01', escopo: 'x' }).success).toBe(false);
  });
});

describe('saídas', () => {
  const ocorrencia = {
    id: ID,
    despesa_fixa_id: ID2,
    descricao: 'Aluguel',
    categoria: 'Moradia',
    vencimento: '2026-10-10',
    valor_previsto_centavos: 150_000,
    valor_pago_centavos: null,
    situacao: 'pendente',
    pagador: null,
  };

  it('§2.1: a ocorrência nunca traz forma, conta nem data do pagamento (o schema estrito recusa)', () => {
    const lista = {
      mes: '2026-10-01',
      pagas: 0,
      total: 1,
      previsto_a_pagar_centavos: 150_000,
      ocorrencias: [ocorrencia],
    };
    expect(saidaFixas.OcorrenciasMes.safeParse(lista).success).toBe(true);
    for (const campo of ['forma', 'forma_id', 'conta', 'conta_id', 'data_operacao', 'data_pagamento']) {
      const vazada = { ...lista, ocorrencias: [{ ...ocorrencia, [campo]: null }] };
      expect(saidaFixas.OcorrenciasMes.safeParse(vazada).success, campo).toBe(false);
    }
  });

  it('pagador é {nome, sou_eu} na paga; situação fora do enum é recusada', () => {
    const paga = {
      ...ocorrencia,
      situacao: 'paga',
      valor_pago_centavos: 150_000,
      pagador: { nome: 'Ana', sou_eu: true },
    };
    expect(saidaFixas.OcorrenciaMes.safeParse(paga).success).toBe(true);
    expect(saidaFixas.OcorrenciaMes.safeParse({ ...ocorrencia, situacao: 'quitada' }).success).toBe(false);
  });

  it('a resposta do pagamento é mínima: sem forma, conta nem data da operação (§2.1)', () => {
    const r = {
      ocorrencia_id: ID,
      lancamento_id: ID2,
      situacao: 'paga',
      valor_pago_centavos: 100,
      vencimento: '2026-10-10',
      ja_existia: false,
    };
    expect(saidaFixas.PagamentoOcorrencia.safeParse(r).success).toBe(true);
    expect(saidaFixas.PagamentoOcorrencia.safeParse({ ...r, data_operacao: '2026-10-08' }).success).toBe(false);
  });

  it('entrada e saida agregam os schemas das fixas e do resumo', () => {
    expect(entrada.SalvarFixa).toBe(entradaFixas.SalvarFixa);
    expect(saida.ResumoMes).toBe(saidaFixas.ResumoMes);
    expect(saida.LinhaDespesasFixas).toBe(saidaFixas.LinhaDespesasFixas);
  });
});
