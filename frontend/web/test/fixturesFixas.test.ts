import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { lerResposta } from './apoio/fetchSimulado';

/**
 * Fixtures das despesas fixas, das ocorrências e do orçamento (etapa 12, lote 3): respostas da API (SDD 6.1 #27, #30 e
 * #34) conferidas contra o contrato Zod. Se o contrato mudar, esta suíte acusa a fixture velha.
 */
describe('fixtures de fixas e orçamento x contrato', () => {
  it.each([
    ['ocorrencias-mes.json', 'OcorrenciasMes'],
    ['ocorrencias-mes-vazio.json', 'OcorrenciasMes'],
    ['orcamento-mes.json', 'OrcamentoMes'],
    ['orcamento-mes-vazio.json', 'OrcamentoMes'],
  ] as const)('%s é um %s válido', (arquivo, schema) => {
    const resultado = saida[schema].safeParse(lerResposta(arquivo));
    expect(resultado.error?.issues ?? []).toEqual([]);
  });

  it.each(['despesas-fixas.json', 'despesas-fixas-vazio.json'])(
    '%s é uma lista de LinhaDespesasFixas válida',
    (arquivo) => {
      const lista = lerResposta<unknown[]>(arquivo);
      for (const linha of lista) expect(saida.LinhaDespesasFixas.safeParse(linha).error?.issues ?? []).toEqual([]);
    },
  );

  it('a ocorrência nunca carrega forma, conta nem data do pagamento (§2.1)', () => {
    const { ocorrencias } = lerResposta<{ ocorrencias: Array<Record<string, unknown>> }>('ocorrencias-mes.json');
    for (const o of ocorrencias) {
      for (const privada of ['forma', 'forma_id', 'conta', 'conta_id', 'data_pagamento', 'data']) {
        expect(privada in o).toBe(false);
      }
    }
  });
});
