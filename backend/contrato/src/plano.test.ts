import { describe, expect, it } from 'vitest';
import { CODIGOS_ERRO_PLANO, cpfCnpjValido, entrada, entradaPlano, saida, saidaPlano } from './index';

/** Contrato do plano (SDD 6.2; RN-24; CA-24.6, CA-24.11; SDD 7). */

const CPF = '529.982.247-25';
const CNPJ = '11.222.333/0001-81';

describe('CPF/CNPJ (CA-24.11: validado no formato antes de ir ao Asaas)', () => {
  it('aceita CPF e CNPJ válidos, com ou sem pontuação', () => {
    for (const v of [CPF, '52998224725', CNPJ, '11222333000181']) expect(cpfCnpjValido(v), v).toBe(true);
  });

  it('recusa dígito verificador errado, tamanho errado, letras e sequências repetidas', () => {
    for (const v of [
      '52998224724',
      '11222333000180',
      '1234567890',
      '123456789012',
      'abc.def.ghi-jk',
      '11111111111',
      '00000000000000',
      '',
    ])
      expect(cpfCnpjValido(v), v).toBe(false);
  });

  it('Assinar devolve só os dígitos e recusa campo extra', () => {
    expect(entradaPlano.Assinar.parse({ cpf_cnpj: CPF })).toEqual({ cpf_cnpj: '52998224725' });
    expect(entradaPlano.Assinar.parse({ cpf_cnpj: CNPJ })).toEqual({ cpf_cnpj: '11222333000181' });
    expect(entradaPlano.Assinar.safeParse({}).success).toBe(false);
    expect(entradaPlano.Assinar.safeParse({ cpf_cnpj: '52998224724' }).success).toBe(false);
    expect(entradaPlano.Assinar.safeParse({ cpf_cnpj: CPF, lar_id: 'x' }).success).toBe(false);
    expect(entradaPlano.Assinar.safeParse({ cpf_cnpj: `${CPF}${' '.repeat(20)}` }).success).toBe(false);
  });

  it('está no agregado `entrada`', () => {
    expect(entrada.Assinar).toBe(entradaPlano.Assinar);
  });
});

describe('MeuPlano', () => {
  const base = {
    plano: 'pro',
    situacao: 'trial',
    trial_ate: '2026-11-07T15:00:00.000Z',
    periodo_ate: null,
    preco_centavos: 990,
    sou_titular: true,
  };

  it('sem cobrança (convidado ou nada em aberto) e com cobrança em aberto', () => {
    expect(saidaPlano.MeuPlano.safeParse(base).success).toBe(true);
    const comCobranca = {
      ...base,
      cobranca: {
        vencimento: '2026-11-10',
        valor_centavos: 990,
        situacao: 'pendente',
        pix_copia_cola: '000201...',
        qr_png_base64: 'iVBORw0KGgo=',
      },
    };
    expect(saidaPlano.MeuPlano.safeParse(comCobranca).success).toBe(true);
    expect(saida.MeuPlano).toBe(saidaPlano.MeuPlano);
  });

  it('é estrito: nunca leva CPF/CNPJ nem ids do Asaas', () => {
    expect(saidaPlano.MeuPlano.safeParse({ ...base, cpf_cnpj: '52998224725' }).success).toBe(false);
    expect(saidaPlano.MeuPlano.safeParse({ ...base, asaas_cliente_id: 'cus_1' }).success).toBe(false);
  });

  it('plano e situação só nos valores conhecidos', () => {
    expect(saidaPlano.MeuPlano.safeParse({ ...base, plano: 'premium' }).success).toBe(false);
    expect(saidaPlano.MeuPlano.safeParse({ ...base, situacao: 'pendente' }).success).toBe(false);
  });
});

describe('códigos de erro do plano (SDD 7)', () => {
  it('cobrem as recusas da etapa 13', () => {
    expect([...CODIGOS_ERRO_PLANO].sort()).toEqual(
      [
        'assinatura_ativa',
        'indisponivel',
        'plano_necessario',
        'registro_invalido',
        'sem_assinatura',
        'token_invalido',
        'valor_invalido',
      ].sort(),
    );
  });
});
