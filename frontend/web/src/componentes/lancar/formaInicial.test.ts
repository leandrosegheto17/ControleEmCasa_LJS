import { describe, expect, it } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { formaInicial } from './formaInicial';

const dados = lerResposta<DadosLancamento>('dados-lancamento.json');
const semFormas = lerResposta<DadosLancamento>('dados-lancamento-sem-formas.json');

describe('formaInicial', () => {
  it('usa forma_padrao_id decidido no servidor', () => {
    expect(formaInicial(dados)).toBe('00000000-0000-4000-8000-000000000301');
  });

  it('forma_padrao_id de outra forma da lista é respeitado', () => {
    expect(formaInicial({ ...dados, forma_padrao_id: '00000000-0000-4000-8000-000000000303' })).toBe(
      '00000000-0000-4000-8000-000000000303',
    );
  });

  it('sem padrão e com formas → a primeira da lista', () => {
    const invertidas = { ...dados, forma_padrao_id: null, formas: [...dados.formas].reverse() };
    expect(formaInicial(invertidas)).toBe('00000000-0000-4000-8000-000000000303');
  });

  it('sem formas → null', () => {
    expect(formaInicial(semFormas)).toBeNull();
  });
});
