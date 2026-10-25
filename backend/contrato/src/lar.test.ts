import { describe, expect, it } from 'vitest';
import { CODIGOS_ERRO_LAR, entradaLar, saida, saidaLar } from './index';

/** Contrato de lar, membros e convite (SDD 6.2; RN-22, RN-23; G-11 chaves omitidas, G-52 aditivo). */
const ID = '00000000-0000-4000-8000-000000000001';
const ID2 = '00000000-0000-4000-8000-000000000002';

describe('entradas', () => {
  it('CriarLar: nome opcional, aparado, de 1 a 60; campo extra é recusado', () => {
    expect(entradaLar.CriarLar.parse({})).toEqual({});
    expect(entradaLar.CriarLar.parse({ nome: '  Casa  ' })).toEqual({ nome: 'Casa' });
    expect(entradaLar.CriarLar.safeParse({ nome: '   ' }).success).toBe(false);
    expect(entradaLar.CriarLar.safeParse({ nome: 'x'.repeat(61) }).success).toBe(false);
    expect(entradaLar.CriarLar.safeParse({ lar_id: ID }).success).toBe(false);
  });

  it('AtualizarLar exige o nome', () => {
    expect(entradaLar.AtualizarLar.safeParse({}).success).toBe(false);
    expect(entradaLar.AtualizarLar.parse({ nome: ' Nosso ' })).toEqual({ nome: 'Nosso' });
  });

  it('Convidar normaliza o e-mail e não aceita lar nem papel vindos do cliente', () => {
    expect(entradaLar.Convidar.parse({ email: ' Bruno@Exemplo.COM ' })).toEqual({ email: 'bruno@exemplo.com' });
    expect(entradaLar.Convidar.safeParse({ email: 'sem-arroba' }).success).toBe(false);
    expect(entradaLar.Convidar.safeParse({ email: 'b@e.co', lar_id: ID }).success).toBe(false);
  });

  it('TokenConvite: só o token', () => {
    expect(entradaLar.TokenConvite.parse({ token: 'abc' })).toEqual({ token: 'abc' });
    expect(entradaLar.TokenConvite.safeParse({}).success).toBe(false);
    expect(entradaLar.TokenConvite.safeParse({ token: 'abc', email: 'x@y.z' }).success).toBe(false);
  });
});

describe('saídas', () => {
  it('Lar e LarDetalhe são estritos; convite_pendente é opcional (a chave some quando não há)', () => {
    const lar = { id: ID, nome: 'Casa' };
    expect(saidaLar.Lar.safeParse(lar).success).toBe(true);
    const detalhe = {
      lar,
      membros: [
        { id: ID, nome: 'Ana', papel: 'titular', sou_eu: true },
        { id: ID2, nome: 'Bruno', papel: 'membro', sou_eu: false },
      ],
    };
    expect(saidaLar.LarDetalhe.safeParse(detalhe).success).toBe(true);
    expect(
      saidaLar.LarDetalhe.safeParse({
        ...detalhe,
        convite_pendente: { id: ID, email: 'b@e.co', expira_em: '2026-10-31T12:00:00.000Z' },
      }).success,
    ).toBe(true);
    expect(saidaLar.LarDetalhe.safeParse({ ...detalhe, convite_pendente: null }).success).toBe(false);
    // o e-mail do outro membro não faz parte da resposta (PRD-TECNICO §2)
    expect(
      saidaLar.LarDetalhe.safeParse({
        ...detalhe,
        membros: [{ id: ID, nome: 'Ana', papel: 'titular', sou_eu: true, email: 'a@e.co' }],
      }).success,
    ).toBe(false);
  });

  it('ConviteCriado e ConviteAtual não levam o token nem o hash', () => {
    expect(
      saidaLar.ConviteCriado.safeParse({ id: ID, email: 'b@e.co', expira_em: '2026-10-31T12:00:00.000Z' }).success,
    ).toBe(true);
    expect(
      saidaLar.ConviteCriado.safeParse({ id: ID, email: 'b@e.co', expira_em: '2026-10-31T12:00:00.000Z', token: 'x' })
        .success,
    ).toBe(false);
    const atual = { lar_nome: 'Casa', convidado_por_nome: 'Ana', expira_em: '2026-10-31T12:00:00.000Z' };
    expect(saidaLar.ConviteAtual.safeParse(atual).success).toBe(true);
    expect(saidaLar.ConviteAtual.safeParse({ ...atual, email: 'b@e.co' }).success).toBe(false);
  });

  it('SessaoAtual aceita o vínculo preenchido (lar e membro) e continua aceitando nulo (sem lar)', () => {
    const base = {
      usuario: { id: ID, nome: 'Ana', email: 'a@b.co' },
      plano: null,
      termos_pendentes: false,
    };
    expect(saida.SessaoAtual.safeParse({ ...base, membro: null, lar: null }).success).toBe(true);
    expect(
      saida.SessaoAtual.safeParse({
        ...base,
        membro: { id: ID2, nome: 'Ana', papel: 'titular' },
        lar: { id: ID, nome: 'Casa' },
      }).success,
    ).toBe(true);
    expect(
      saida.SessaoAtual.safeParse({ ...base, membro: { id: ID2, nome: 'Ana', papel: 'dono' }, lar: null }).success,
    ).toBe(false);
  });
});

describe('códigos de erro (SDD 7; PRD-TECNICO 1.1)', () => {
  it('lista os códigos novos de lar e convite', () => {
    expect([...CODIGOS_ERRO_LAR].sort()).toEqual(
      [
        'convite_invalido',
        'convite_pendente',
        'ja_tem_lar',
        'lar_cheio',
        'registro_invalido',
        'sem_lar',
        'titular_obrigatorio',
      ].sort(),
    );
  });
});
