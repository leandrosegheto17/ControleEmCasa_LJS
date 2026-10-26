import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { lerResposta } from './apoio/fetchSimulado';

/**
 * As fixtures dos testes de tela são respostas da API (SDD 6.1): precisam obedecer ao contrato Zod que a API e o
 * front compartilham. Se o contrato mudar, esta suíte acusa a fixture velha em vez de a tela passar por engano.
 */
describe('fixtures de resposta x contrato', () => {
  it.each([
    ['dados-lancamento.json', 'DadosLancamento'],
    ['dados-lancamento-sem-formas.json', 'DadosLancamento'],
    ['lancamento-pagador.json', 'LancamentoDoPagador'],
    ['lancamento-outro-membro.json', 'LancamentoDoOutroMembro'],
    ['lancamentos-mes.json', 'LancamentosMes'],
    ['lancamentos-mes-vazio.json', 'LancamentosMes'],
    ['lancar-despesa-credito.json', 'LancarDespesa'],
    ['resumo-mes.json', 'ResumoMes'],
    ['resumo-mes-vazio.json', 'ResumoMes'],
  ] as const)('%s é um %s válido', (arquivo, schema) => {
    const resultado = saida[schema].safeParse(lerResposta(arquivo));
    expect(resultado.error?.issues ?? []).toEqual([]);
  });

  it('o detalhe do outro membro NÃO tem as chaves privadas (RN-04)', () => {
    const outro = lerResposta<Record<string, unknown>>('lancamento-outro-membro.json');
    expect('pagamento' in outro).toBe(false);
    for (const parcela of outro.parcelas as Array<Record<string, unknown>>) {
      expect('data_ajustada' in parcela).toBe(false);
    }
  });
});
