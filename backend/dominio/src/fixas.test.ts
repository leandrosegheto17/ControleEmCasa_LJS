import { describe, expect, it } from 'vitest';
import {
  apagaAoEncerrar,
  fixaPodeSerEditada,
  normalizarFixa,
  ocorrenciasAGerar,
  compararOcorrencias,
  deveGerarOcorrencia,
  fixaGeraNoMes,
  situacaoOcorrencia,
  validarDataPagamentoFixa,
  vencimentoDaOcorrencia,
  type SituacaoOcorrencia,
} from './fixas';

// Casos portados de MyMoney/backend/supabase/tests/fixas/fixa_gera_no_mes.sql.
describe('fixaGeraNoMes (RN-15)', () => {
  it.each([
    ['2026-10-01', null, '2026-09-01', false, 'mês anterior ao início não gera'],
    ['2026-10-01', null, '2026-10-01', true, 'mês do início gera'],
    ['2026-10-01', null, '2026-10-17', true, 'dia no meio do mês do início gera'],
    ['2026-10-01', null, '2026-11-01', true, 'mês seguinte ao início gera'],
    ['2026-10-01', null, '2030-01-01', true, 'encerrada_em nulo gera indefinidamente'],
    ['2026-01-01', '2026-10-20', '2026-09-01', true, 'mês anterior ao encerramento gera'],
    ['2026-01-01', '2026-10-20', '2026-10-01', true, 'mês do encerramento gera'],
    ['2026-01-01', '2026-10-01', '2026-10-01', true, 'encerrada no dia 1 ainda gera o mês'],
    ['2026-01-01', '2026-10-31', '2026-10-15', true, 'encerrada no último dia gera o mês'],
    ['2026-01-01', '2026-10-20', '2026-11-01', false, 'mês seguinte ao encerramento não gera'],
    ['2026-01-01', '2026-10-20', '2027-01-01', false, 'meses depois do encerramento não geram'],
    ['2026-10-01', '2026-10-05', '2026-10-01', true, 'início e encerramento no mesmo mês: gera o mês'],
    ['2026-10-01', '2026-10-05', '2026-11-01', false, 'início e encerramento no mesmo mês: não gera o seguinte'],
    ['2026-12-01', '2027-02-10', '2026-11-01', false, 'encerrada, mas antes do início não gera'],
  ])('início %s, encerrada %s, mês %s → %s (%s)', (...[inicio, encerradaEm, mes, esperado]) => {
    expect(fixaGeraNoMes({ inicio, encerradaEm, mes })).toBe(esperado);
  });

  it('divergência documentada: início fora do dia 1 conta pelo mês (o legado compararia com o dia cru)', () => {
    expect(fixaGeraNoMes({ inicio: '2026-10-15', encerradaEm: null, mes: '2026-10-01' })).toBe(true);
  });
});

// CA-15.2, CA-15.4; tests/resumo/resumo_mes_janela.sql e tests/fixas/garantir_ocorrencias*.sql.
describe('deveGerarOcorrencia (janela ±12 meses)', () => {
  const fixa = { inicio: '2025-01-01', encerradaEm: null };
  const hoje = '2026-10-24';
  it('CA-15.2: novembro/2027 não grava; outubro/2027 e outubro/2025 gravam', () => {
    expect(deveGerarOcorrencia({ ...fixa, mes: '2027-11-01', hoje })).toBe(false);
    expect(deveGerarOcorrencia({ ...fixa, mes: '2027-10-01', hoje })).toBe(true);
    expect(deveGerarOcorrencia({ ...fixa, mes: '2025-10-01', hoje })).toBe(true);
  });
  it('mês −12 anterior ao início das fixas não gera', () => {
    expect(deveGerarOcorrencia({ inicio: '2026-01-01', encerradaEm: null, mes: '2025-10-01', hoje })).toBe(false);
  });
  it('9999-01-01 fora da janela não gera', () => {
    expect(deveGerarOcorrencia({ ...fixa, mes: '9999-01-01', hoje })).toBe(false);
  });
  it('CA-15.4: encerrada em 15/10: outubro gera, novembro não', () => {
    const encerrada = { inicio: '2026-01-01', encerradaEm: '2026-10-15', hoje };
    expect(deveGerarOcorrencia({ ...encerrada, mes: '2026-10-01' })).toBe(true);
    expect(deveGerarOcorrencia({ ...encerrada, mes: '2026-11-01' })).toBe(false);
  });
});

// Casos de tests/fixas/garantir_ocorrencias_vencimento.sql e CA-15.3.
describe('vencimentoDaOcorrencia (CA-15.3)', () => {
  it.each([
    ['2027-02-01', 31, '2027-02-28', 'dia 31 em fevereiro de 2027 → 28'],
    ['2028-02-01', 31, '2028-02-29', 'dia 31 em fevereiro de 2028 (bissexto) → 29'],
    ['2026-04-01', 31, '2026-04-30', 'dia 31 em abril → 30'],
    ['2027-01-01', 31, '2027-01-31', 'dia 31 em janeiro → 31'],
    ['2027-02-01', 10, '2027-02-10', 'dia 10 → 10'],
    ['2026-04-01', 10, '2026-04-10', 'dia 10 em abril → 10'],
  ] as const)('%s, dia %i → %s (%s)', (...[mes, dia, esperado]) => {
    expect(vencimentoDaOcorrencia(mes, dia)).toEqual({ ok: true, valor: esperado });
  });
  it('dia fora de 1–31 → valor_invalido', () => {
    expect(vencimentoDaOcorrencia('2026-04-01', 0)).toEqual({ ok: false, erro: 'valor_invalido' });
  });
});

// CA-15.4; legado A encerrar_despesa_fixa.sql.
describe('apagaAoEncerrar (CA-15.4)', () => {
  it('pendente de novembro já gerada é apagada ao encerrar em 15/10', () => {
    expect(apagaAoEncerrar({ mesOcorrencia: '2026-11-01', encerradaEm: '2026-10-15', paga: false })).toBe(true);
  });
  it('paga de novembro fica', () => {
    expect(apagaAoEncerrar({ mesOcorrencia: '2026-11-01', encerradaEm: '2026-10-15', paga: true })).toBe(false);
  });
  it('a do mês do encerramento fica, mesmo pendente', () => {
    expect(apagaAoEncerrar({ mesOcorrencia: '2026-10-01', encerradaEm: '2026-10-15', paga: false })).toBe(false);
  });
  it('meses anteriores ficam', () => {
    expect(apagaAoEncerrar({ mesOcorrencia: '2026-09-01', encerradaEm: '2026-10-15', paga: false })).toBe(false);
  });
});

// Casos portados de tests/fixas/ocorrencias_do_mes.sql (hoje fixo em 2026-10-09).
describe('situacaoOcorrencia e ordem (RN-15)', () => {
  const hoje = '2026-10-09';
  it.each([
    [false, '2026-10-05', 'atrasada', 'vencimento antes de hoje'],
    [false, '2026-10-09', 'pendente', 'vencimento = hoje é pendente'],
    [false, '2026-10-10', 'pendente', 'vencimento depois de hoje'],
    [true, '2026-10-05', 'paga', 'paga mesmo com vencimento passado'],
    [true, '2026-10-20', 'paga', 'paga antes do vencimento'],
  ] as const)('paga=%s, vencimento %s → %s (%s)', (...[paga, vencimento, esperado]) => {
    expect(situacaoOcorrencia({ paga, vencimento, hoje })).toBe(esperado);
  });
  it('vencimento 10/10 com hoje 11/10 → atrasada', () => {
    expect(situacaoOcorrencia({ paga: false, vencimento: '2026-10-10', hoje: '2026-10-11' })).toBe('atrasada');
  });

  it('atrasadas, pendentes por vencimento crescente, pagas por vencimento decrescente', () => {
    const base = [
      { id: 'd801', descricao: 'Internet', vencimento: '2026-10-05', paga: false },
      { id: 'd802', descricao: 'Aluguel', vencimento: '2026-10-10', paga: false },
      { id: 'd803', descricao: 'Seguro', vencimento: '2026-10-09', paga: false },
      { id: 'd804', descricao: 'Luz', vencimento: '2026-10-08', paga: true },
      { id: 'd805', descricao: 'Água', vencimento: '2026-10-07', paga: true },
    ];
    const lista = base.map((o) => ({ ...o, situacao: situacaoOcorrencia({ ...o, hoje }) as SituacaoOcorrencia }));
    const ordenada = [...lista].sort(compararOcorrencias).map((o) => [o.id, o.situacao]);
    expect(ordenada).toEqual([
      ['d801', 'atrasada'],
      ['d803', 'pendente'],
      ['d802', 'pendente'],
      ['d804', 'paga'],
      ['d805', 'paga'],
    ]);
  });

  it('empate de situação e vencimento: por descrição, depois id', () => {
    const o = (id: string, descricao: string) => ({
      id,
      descricao,
      vencimento: '2026-10-10',
      situacao: 'pendente' as const,
    });
    expect([o('2', 'Luz'), o('3', 'Água'), o('1', 'Luz')].sort(compararOcorrencias).map((x) => x.id)).toEqual([
      '3',
      '1',
      '2',
    ]);
  });
});

// CA-15.6; legado A pagar_ocorrencia.sql:66-68.
describe('validarDataPagamentoFixa (CA-15.6)', () => {
  const hoje = '2026-10-24';
  it.each(['2000-01-01', '2026-10-24', '2026-11-23'])('%s é aceita', (data) => {
    expect(validarDataPagamentoFixa(data, hoje)).toEqual({ ok: true, valor: data });
  });
  it.each([
    ['1999-12-31', 'antes de 01/01/2000'],
    ['2026-11-24', 'depois de hoje + 30'],
    ['2026-02-30', 'data inexistente'],
    ['', 'vazia'],
  ])('%j → valor_invalido (%s)', (data) => {
    expect(validarDataPagamentoFixa(data, hoje)).toEqual({ ok: false, erro: 'valor_invalido' });
  });
  it('o limite de hoje + 30 atravessa o ano', () => {
    expect(validarDataPagamentoFixa('2027-01-30', '2026-12-31').ok).toBe(true);
    expect(validarDataPagamentoFixa('2027-01-31', '2026-12-31').ok).toBe(false);
  });
});

// Etapa 9: modelo da fixa (RN-15, RN-18) e geração em lote das ocorrências do mês (CA-15.1 a CA-15.4).
describe('normalizarFixa (RN-15, RN-18; A salvar_despesa_fixa.sql:27-32)', () => {
  const valida = { descricao: '  Aluguel  ', valorPrevistoCentavos: 150_000, diaVencimento: 10 };

  it('apara a descrição e devolve o modelo', () => {
    expect(normalizarFixa(valida)).toEqual({
      ok: true,
      valor: { descricao: 'Aluguel', valorPrevistoCentavos: 150_000, diaVencimento: 10 },
    });
  });

  it.each([
    ['descrição vazia', { descricao: '   ' }],
    ['descrição nula', { descricao: null }],
    ['descrição com 121 caracteres', { descricao: 'a'.repeat(121) }],
    ['previsto 0', { valorPrevistoCentavos: 0 }],
    ['previsto negativo', { valorPrevistoCentavos: -1 }],
    ['previsto fracionário', { valorPrevistoCentavos: 10.5 }],
    ['previsto acima de 10^11 (não daria para pagar pelo padrão)', { valorPrevistoCentavos: 100_000_000_001 }],
    ['dia 0', { diaVencimento: 0 }],
    ['dia 32', { diaVencimento: 32 }],
    ['dia nulo', { diaVencimento: null }],
  ])('%s → valor_invalido', (_nome, mudanca) => {
    expect(normalizarFixa({ ...valida, ...mudanca } as never)).toEqual({ ok: false, erro: 'valor_invalido' });
  });

  it('limites aceitos: 120 caracteres, previsto 1 e 10^11, dias 1 e 31', () => {
    expect(normalizarFixa({ ...valida, descricao: 'a'.repeat(120) }).ok).toBe(true);
    expect(normalizarFixa({ ...valida, valorPrevistoCentavos: 1 }).ok).toBe(true);
    expect(normalizarFixa({ ...valida, valorPrevistoCentavos: 100_000_000_000 }).ok).toBe(true);
    expect(normalizarFixa({ ...valida, diaVencimento: 1 }).ok).toBe(true);
    expect(normalizarFixa({ ...valida, diaVencimento: 31 }).ok).toBe(true);
  });
});

describe('fixaPodeSerEditada (RN-15: fixa encerrada não é editada)', () => {
  it('ativa pode; encerrada → valor_invalido', () => {
    expect(fixaPodeSerEditada(null)).toEqual({ ok: true, valor: undefined });
    expect(fixaPodeSerEditada('2026-10-15')).toEqual({ ok: false, erro: 'valor_invalido' });
  });
});

describe('ocorrenciasAGerar (CA-15.1 a CA-15.4; F garantir_ocorrencias.sql)', () => {
  const hoje = '2026-10-24';
  const fixa = (id: string, extra: Partial<Parameters<typeof ocorrenciasAGerar>[0][number]> = {}) => ({
    id,
    inicio: '2026-01-01',
    encerradaEm: null,
    diaVencimento: 10,
    valorPrevistoCentavos: 1000,
    ...extra,
  });

  it('1 ocorrência por fixa ativa, com o previsto e o vencimento do modelo naquele mês', () => {
    expect(
      ocorrenciasAGerar([fixa('a'), fixa('b', { diaVencimento: 31, valorPrevistoCentavos: 5 })], '2027-02-17', hoje),
    ).toEqual([
      { fixaId: 'a', mes: '2027-02-01', vencimento: '2027-02-10', valorPrevistoCentavos: 1000 },
      { fixaId: 'b', mes: '2027-02-01', vencimento: '2027-02-28', valorPrevistoCentavos: 5 },
    ]);
  });

  it('CA-15.2: fora da janela (novembro/2027 com hoje 24/10/2026) não gera nada; outubro/2027 e outubro/2025 geram', () => {
    expect(ocorrenciasAGerar([fixa('a', { inicio: '2025-01-01' })], '2027-11-01', hoje)).toEqual([]);
    expect(ocorrenciasAGerar([fixa('a', { inicio: '2025-01-01' })], '2027-10-01', hoje)).toHaveLength(1);
    expect(ocorrenciasAGerar([fixa('a', { inicio: '2025-01-01' })], '2025-10-01', hoje)).toHaveLength(1);
  });

  it('antes do início não gera; CA-15.4: encerrada em 15/10 gera outubro e não novembro', () => {
    expect(ocorrenciasAGerar([fixa('a', { inicio: '2026-11-01' })], '2026-10-01', hoje)).toEqual([]);
    const encerrada = fixa('a', { encerradaEm: '2026-10-15' });
    expect(ocorrenciasAGerar([encerrada], '2026-10-01', hoje)).toHaveLength(1);
    expect(ocorrenciasAGerar([encerrada], '2026-11-01', hoje)).toEqual([]);
  });

  it('sem fixas, nada', () => {
    expect(ocorrenciasAGerar([], '2026-10-01', hoje)).toEqual([]);
  });
});
