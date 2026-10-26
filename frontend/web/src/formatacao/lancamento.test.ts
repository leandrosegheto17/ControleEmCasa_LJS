import { describe, expect, it } from 'vitest';
import { formatarTituloLancamento } from './lancamento';

describe('formatarTituloLancamento', () => {
  it('acrescenta "(k/N)" à descrição de uma compra parcelada', () => {
    expect(formatarTituloLancamento('Fone bluetooth', 'Lazer pessoal', 2, 3)).toBe('Fone bluetooth (2/3)');
    expect(formatarTituloLancamento('Geladeira nova', 'Moradia', 3, 3)).toBe('Geladeira nova (3/3)');
  });

  it('não acrescenta "(1/1)" em lançamento à vista', () => {
    expect(formatarTituloLancamento('Almoço', 'Almoço/Alimentação fora', 1, 1)).toBe('Almoço');
  });

  it('usa o nome da categoria quando a descrição é nula', () => {
    expect(formatarTituloLancamento(null, 'Mercado', 1, 1)).toBe('Mercado');
  });

  it('usa o nome da categoria quando a descrição é vazia ou só espaços', () => {
    expect(formatarTituloLancamento('', 'Mercado', 1, 1)).toBe('Mercado');
    expect(formatarTituloLancamento('   ', 'Mercado', 1, 1)).toBe('Mercado');
  });

  it('categoria no lugar da descrição também recebe "(k/N)"', () => {
    expect(formatarTituloLancamento(null, 'Mercado', 2, 3)).toBe('Mercado (2/3)');
  });
});
