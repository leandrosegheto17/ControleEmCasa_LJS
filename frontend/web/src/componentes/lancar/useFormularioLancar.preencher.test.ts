import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFormularioLancar } from './useFormularioLancar';

const CORRECAO = {
  valorCentavos: 1250,
  categoriaId: '00000000-0000-4000-8000-000000000411',
  formaId: '00000000-0000-4000-8000-000000000301',
  parcelas: 1,
  data: '2026-10-09',
  descricao: 'Padaria',
};

const valores = (atual: ReturnType<typeof useFormularioLancar>) => atual.estado;

describe('useFormularioLancar.preencher', () => {
  it('preenche todos os campos de uma vez (abrir a T03 a partir da T23)', () => {
    const { result } = renderHook(() => useFormularioLancar());
    act(() => result.current.preencher(CORRECAO));
    expect(valores(result.current)).toMatchObject(CORRECAO);
  });

  it('substitui o que estava digitado', () => {
    const { result } = renderHook(() => useFormularioLancar());
    act(() => result.current.mudar('valorCentavos', 9990));
    act(() => result.current.mudar('descricao', 'Outra coisa'));
    act(() => result.current.preencher(CORRECAO));
    expect(valores(result.current)).toMatchObject({ valorCentavos: 1250, descricao: 'Padaria' });
  });

  it('mantém as parcelas do item de crédito', () => {
    const { result } = renderHook(() => useFormularioLancar());
    act(() => result.current.preencher({ ...CORRECAO, parcelas: 3, valorCentavos: 36000 }));
    expect(valores(result.current)).toMatchObject({ parcelas: 3, valorCentavos: 36000 });
  });

  it('depois de preencher, mudar um campo só altera aquele campo', () => {
    const { result } = renderHook(() => useFormularioLancar());
    act(() => result.current.preencher(CORRECAO));
    act(() => result.current.mudar('categoriaId', '00000000-0000-4000-8000-000000000412'));
    expect(valores(result.current)).toMatchObject({
      ...CORRECAO,
      categoriaId: '00000000-0000-4000-8000-000000000412',
    });
  });
});
