import { describe, expect, it } from 'vitest';
import {
  CODIGOS_ERRO_ACESSO,
  CODIGOS_ERRO_CONTA,
  entrada,
  PRAZO_CONTA_NAO_CONFIRMADA_DIAS,
  PRAZO_INDIVIDUAL_EX_MEMBRO_DIAS,
  PRAZO_PURGA_DIAS,
  saida,
} from './index';

/** Critérios: RN-26 (CA-26.2 purga em 30 dias, CA-26.9 link), CA-19.8 (7 dias), CA-23.12 (30 dias), CA-26.7. */

describe('prazos da exclusão e da purga', () => {
  it('a purga é 30 dias depois da confirmação (CA-26.2)', () => expect(PRAZO_PURGA_DIAS).toBe(30));
  it('conta não confirmada some em 7 dias (CA-19.8)', () => expect(PRAZO_CONTA_NAO_CONFIRMADA_DIAS).toBe(7));
  it('o individual do ex-membro some em 30 dias (CA-23.12)', () => expect(PRAZO_INDIVIDUAL_EX_MEMBRO_DIAS).toBe(30));
});

describe('entrada.PedirExclusao', () => {
  it('exige a senha; vazia, ausente ou com campo extra é inválida', () => {
    expect(entrada.PedirExclusao.safeParse({ senha: 'qualquer-coisa' }).success).toBe(true);
    expect(entrada.PedirExclusao.safeParse({ senha: '' }).success).toBe(false);
    expect(entrada.PedirExclusao.safeParse({}).success).toBe(false);
    expect(entrada.PedirExclusao.safeParse({ senha: 'x', usuario_id: 'outro' }).success).toBe(false);
    expect(entrada.PedirExclusao.safeParse({ senha: 'x'.repeat(1025) }).success).toBe(false);
  });
});

describe('entrada.ConfirmarExclusao', () => {
  it('leva só o token', () => {
    expect(entrada.ConfirmarExclusao.safeParse({ token: 'abc' }).success).toBe(true);
    expect(entrada.ConfirmarExclusao.safeParse({ token: '' }).success).toBe(false);
    expect(entrada.ConfirmarExclusao.safeParse({ token: 'abc', email: 'a@b.co' }).success).toBe(false);
    expect(entrada.ConfirmarExclusao.safeParse({ token: 'x'.repeat(129) }).success).toBe(false);
  });
});

describe('saida.SessaoAtual com o encerramento do lar (CA-26.7)', () => {
  const base = {
    usuario: { id: '00000000-0000-4000-8000-000000000001', nome: 'Bia', email: 'b@b.co' },
    membro: { id: '00000000-0000-4000-8000-000000000002', nome: 'Bia', papel: 'membro' },
    lar: { id: '00000000-0000-4000-8000-000000000003', nome: 'Casa' },
    plano: 'pro',
    termos_pendentes: false,
  };

  it('sem encerramento continua válida (a chave é opcional)', () => {
    expect(saida.SessaoAtual.safeParse(base).success).toBe(true);
  });

  it('com encerramento exige o instante da purga e nada além', () => {
    const encerramento = { purga_em: '2026-11-25T12:00:00.000Z' };
    expect(saida.SessaoAtual.safeParse({ ...base, encerramento }).success).toBe(true);
    expect(saida.SessaoAtual.safeParse({ ...base, encerramento: { purga_em: 'amanhã' } }).success).toBe(false);
    expect(saida.SessaoAtual.safeParse({ ...base, encerramento: { ...encerramento, titular: 'Ana' } }).success).toBe(
      false,
    );
  });
});

describe('códigos de erro da conta', () => {
  it('todos já existem no contrato de acesso ou do lar (nenhum código novo)', () => {
    for (const c of CODIGOS_ERRO_CONTA) expect(CODIGOS_ERRO_ACESSO as readonly string[]).toContain(c);
  });
});
