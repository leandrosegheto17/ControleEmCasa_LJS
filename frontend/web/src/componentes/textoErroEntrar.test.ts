import { describe, expect, it } from 'vitest';
import { textoErroEntrar } from './textoErroEntrar';

describe('textoErroEntrar', () => {
  it('credenciais erradas não dizem se o e-mail existe', () => {
    expect(textoErroEntrar({ tipo: 'regra', codigo: 'credenciais_invalidas' })).toBe('E-mail ou senha incorretos.');
  });

  it.each([
    ['email_nao_confirmado', /confirme seu e-mail/i],
    ['conta_em_exclusao', /exclus/i],
    ['muitas_tentativas', /muitas tentativas/i],
    ['muitas_requisicoes', /muitos pedidos/i],
    ['origem_invalida', /recarregue/i],
  ] as const)('"%s" tem texto próprio, sem o código', (codigo, esperado) => {
    const texto = textoErroEntrar({ tipo: 'regra', codigo });
    expect(texto).toMatch(esperado);
    expect(texto).not.toContain('_');
  });

  it('sem rede e serviço indisponível têm texto próprio', () => {
    expect(textoErroEntrar({ tipo: 'rede' })).toBe('Sem conexão.');
    expect(textoErroEntrar({ tipo: 'indisponivel' })).toMatch(/indisponível/);
  });

  it('o resto cai no genérico, sem repassar texto do servidor', () => {
    expect(textoErroEntrar({ tipo: 'desconhecido' })).toBe('Não foi possível entrar. Tente de novo.');
    expect(textoErroEntrar({ tipo: 'regra', codigo: 'sem_lar' })).toBe('Não foi possível entrar. Tente de novo.');
  });
});
