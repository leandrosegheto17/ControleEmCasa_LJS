import { describe, expect, it } from 'vitest';
import { textoErroInicio } from './textoErroInicio';

describe('textoErroInicio', () => {
  it('indisponível: título e texto com o mês', () => {
    expect(textoErroInicio({ tipo: 'indisponivel' }, '2026-10')).toEqual({
      titulo: 'Servidor indisponível',
      texto:
        'Não foi possível carregar o resumo de outubro. Seus lançamentos de despesa ficam guardados no aparelho e serão enviados quando o servidor voltar.',
    });
  });

  it('rede e sem erro: valem os padrões', () => {
    expect(textoErroInicio({ tipo: 'rede' }, '2026-10')).toEqual({});
    expect(textoErroInicio(null, '2026-10')).toEqual({});
  });
});
