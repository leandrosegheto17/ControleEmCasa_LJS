import { describe, expect, it } from 'vitest';
import { ROTULO_ERRO } from './erros';
import { textoErroPlano } from './plano';

describe('textoErroPlano', () => {
  it('rede, indisponível e códigos do plano têm texto próprio, sem código cru', () => {
    expect(textoErroPlano({ tipo: 'rede' })).toMatch(/exigem internet/);
    expect(textoErroPlano({ tipo: 'indisponivel' })).toMatch(/indisponível/);
    expect(textoErroPlano({ tipo: 'regra', codigo: 'assinatura_ativa' })).toBe(ROTULO_ERRO.assinatura_ativa.texto);
    expect(textoErroPlano({ tipo: 'regra', codigo: 'sem_assinatura' })).toBe(ROTULO_ERRO.sem_assinatura.texto);
    expect(textoErroPlano({ tipo: 'regra', codigo: 'registro_invalido' })).toMatch(/titular/);
    expect(textoErroPlano({ tipo: 'desconhecido' })).not.toMatch(/_/);
  });
});
