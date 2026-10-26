import { describe, expect, it, vi } from 'vitest';
import { limparAparelho, registrarLimpeza } from './aparelho';

describe('limparAparelho (G-39)', () => {
  it('roda todas as limpezas registradas', async () => {
    const a = vi.fn();
    const b = vi.fn().mockResolvedValue(undefined);
    const desfazerA = registrarLimpeza(a);
    const desfazerB = registrarLimpeza(b);

    await limparAparelho();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    desfazerA();
    desfazerB();
  });

  it('uma limpeza que lança ou rejeita não impede as outras', async () => {
    const ruim = vi.fn().mockRejectedValue(new Error('falhou'));
    const sincronaRuim = vi.fn(() => {
      throw new Error('falhou também');
    });
    const boa = vi.fn();
    const desfazer = [registrarLimpeza(ruim), registrarLimpeza(sincronaRuim), registrarLimpeza(boa)];

    await expect(limparAparelho()).resolves.toBeUndefined();

    expect(boa).toHaveBeenCalledTimes(1);
    desfazer.forEach((d) => d());
  });

  it('depois de desregistrada, a limpeza não roda mais', async () => {
    const limpeza = vi.fn();
    registrarLimpeza(limpeza)();

    await limparAparelho();

    expect(limpeza).not.toHaveBeenCalled();
  });
});
