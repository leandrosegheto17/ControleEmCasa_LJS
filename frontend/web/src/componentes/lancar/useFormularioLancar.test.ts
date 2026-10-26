import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { useFormularioLancar } from './useFormularioLancar';

const dados = lerResposta<DadosLancamento>('dados-lancamento.json');

const PIX = '00000000-0000-4000-8000-000000000301';
const DEBITO = '00000000-0000-4000-8000-000000000302';
const CREDITO = '00000000-0000-4000-8000-000000000303';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // 23h30 de 09/10/2026 em São Paulo (já é dia 10 em UTC)
  vi.setSystemTime(new Date('2026-10-10T02:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useFormularioLancar: estado inicial', () => {
  it('data = hoje em São Paulo, parcelas 1, nada escolhido', () => {
    const { result } = renderHook(() => useFormularioLancar());

    expect(result.current.estado).toEqual({
      tipo: 'despesa',
      contaId: null,
      valorCentavos: 0,
      categoriaId: null,
      formaId: null,
      parcelas: 1,
      data: '2026-10-09',
      descricao: '',
    });
  });
});

describe('useFormularioLancar: mudar por campo', () => {
  it.each([
    ['valorCentavos', 4590],
    ['categoriaId', '00000000-0000-4000-8000-000000000401'],
    ['data', '2026-10-05'],
    ['descricao', 'Feira de sábado'],
  ] as const)('mudar(%s) troca só esse campo', (campo, valor) => {
    const { result } = renderHook(() => useFormularioLancar());
    const antes = result.current.estado;

    act(() => result.current.mudar(campo, valor as never));

    expect(result.current.estado).toEqual({ ...antes, [campo]: valor });
  });

  it('mudar(parcelas) troca as parcelas', () => {
    const { result } = renderHook(() => useFormularioLancar(dados));

    act(() => result.current.mudar('formaId', CREDITO));
    act(() => result.current.mudar('parcelas', 3));

    expect(result.current.estado.parcelas).toBe(3);
  });
});

describe('useFormularioLancar: forma inicial e troca de forma', () => {
  it('começa com a forma padrão de dados_lancamento', () => {
    const { result } = renderHook(() => useFormularioLancar(dados));

    expect(result.current.estado.formaId).toBe(PIX);
  });

  it('Crédito em 3x → trocar para Débito volta para 1 parcela', () => {
    const { result } = renderHook(() => useFormularioLancar(dados));

    act(() => result.current.mudar('formaId', CREDITO));
    act(() => result.current.mudar('parcelas', 3));
    act(() => result.current.mudar('formaId', DEBITO));

    expect(result.current.estado.formaId).toBe(DEBITO);
    expect(result.current.estado.parcelas).toBe(1);
  });

  it('Pix → trocar para Crédito mantém 1 parcela', () => {
    const { result } = renderHook(() => useFormularioLancar(dados));

    act(() => result.current.mudar('formaId', CREDITO));

    expect(result.current.estado.formaId).toBe(CREDITO);
    expect(result.current.estado.parcelas).toBe(1);
  });

  it('trocar a forma não mexe em valor, categoria, data nem descrição', () => {
    const { result } = renderHook(() => useFormularioLancar(dados));
    act(() => result.current.mudar('valorCentavos', 36000));
    act(() => result.current.mudar('categoriaId', '00000000-0000-4000-8000-000000000401'));
    act(() => result.current.mudar('descricao', 'Compra do mês'));

    act(() => result.current.mudar('formaId', CREDITO));

    expect(result.current.estado).toMatchObject({
      valorCentavos: 36000,
      categoriaId: '00000000-0000-4000-8000-000000000401',
      data: '2026-10-09',
      descricao: 'Compra do mês',
    });
  });
});
