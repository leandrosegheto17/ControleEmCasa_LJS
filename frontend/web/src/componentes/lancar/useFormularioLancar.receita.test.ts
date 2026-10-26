import { readFileSync } from 'node:fs';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { useFormularioLancar } from './useFormularioLancar';

const lerResposta = <T>(nome: string): T =>
  JSON.parse(readFileSync(new URL(`../../../test/fixtures/respostas/${nome}`, import.meta.url), 'utf8'));

const DADOS = lerResposta<DadosLancamento>('dados-lancamento.json');
const NUBANK = '00000000-0000-4000-8000-000000000201';
const ITAU = '00000000-0000-4000-8000-000000000202';
const MERCADO = '00000000-0000-4000-8000-000000000401';
const SALARIO = '00000000-0000-4000-8000-000000000421';

function montar(dados: DadosLancamento = DADOS) {
  return renderHook(() => useFormularioLancar(dados));
}

describe('useFormularioLancar no modo receita', () => {
  it('começa em despesa', () => {
    const { result } = montar();
    expect(result.current.estado.tipo).toBe('despesa');
  });

  it('contaId inicial = conta_receita_padrao_id do JSON (Nubank)', () => {
    const { result } = montar();
    expect(result.current.estado.contaId).toBe(NUBANK);
  });

  it('com conta_receita_padrao_id nulo, a conta inicial é a 1ª da lista do servidor', () => {
    const contas = [...DADOS.contas].reverse();
    const { result } = montar({ ...DADOS, contas, conta_receita_padrao_id: null } as DadosLancamento);
    expect(result.current.estado.contaId).toBe(ITAU);
  });

  it('trocar para receita limpa a categoria e mantém valor, data e descrição', () => {
    const { result } = montar();
    const categoriaVazia = result.current.estado.categoriaId;
    act(() => {
      result.current.mudar('valorCentavos', 750000);
      result.current.mudar('categoriaId', MERCADO);
      result.current.mudar('data', '2026-10-05');
      result.current.mudar('descricao', 'Outubro');
    });

    act(() => result.current.mudar('tipo', 'receita'));

    expect(result.current.estado).toMatchObject({
      tipo: 'receita',
      valorCentavos: 750000,
      data: '2026-10-05',
      descricao: 'Outubro',
    });
    expect(result.current.estado.categoriaId).toBe(categoriaVazia);
  });

  it('voltar para despesa limpa a categoria de receita e mantém a conta escolhida', () => {
    const { result } = montar();
    const categoriaVazia = result.current.estado.categoriaId;
    act(() => result.current.mudar('tipo', 'receita'));
    act(() => {
      result.current.mudar('categoriaId', SALARIO);
      result.current.mudar('contaId', ITAU);
    });

    act(() => result.current.mudar('tipo', 'despesa'));

    expect(result.current.estado.tipo).toBe('despesa');
    expect(result.current.estado.categoriaId).toBe(categoriaVazia);
    expect(result.current.estado.contaId).toBe(ITAU);
  });

  it('mudar contaId troca a conta de destino', () => {
    const { result } = montar();
    act(() => result.current.mudar('tipo', 'receita'));
    act(() => result.current.mudar('contaId', ITAU));
    expect(result.current.estado.contaId).toBe(ITAU);
  });
});
