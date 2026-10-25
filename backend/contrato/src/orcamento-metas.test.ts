import { describe, expect, it } from 'vitest';
import { entrada, saida } from './index';

/**
 * Contrato do orçamento e das metas (SDD 6.1 #34 a #41; RN-08, RN-09, RN-16, RN-18; G-11, G-26). Os casos nascem
 * de CA-08.2 (escopo só na criação), CA-08.5 (conta só do autor), CA-09.4, CA-16.7 e CA-T3.5.
 */
const ID = '00000000-0000-4000-8000-000000000001';
const ID2 = '00000000-0000-4000-8000-000000000002';

describe('DefinirOrcamento', () => {
  it('valor positivo, nulo ou ausente (remove) são aceitos', () => {
    expect(entrada.DefinirOrcamento.safeParse({ valor_centavos: 5000 }).success).toBe(true);
    expect(entrada.DefinirOrcamento.safeParse({ valor_centavos: null }).success).toBe(true);
    expect(entrada.DefinirOrcamento.safeParse({}).success).toBe(true);
  });
  it('fracionário, texto e chaves de escopo ou dono são recusados (G-26)', () => {
    expect(entrada.DefinirOrcamento.safeParse({ valor_centavos: 1.5 }).success).toBe(false);
    expect(entrada.DefinirOrcamento.safeParse({ valor_centavos: '10' }).success).toBe(false);
    for (const campo of ['escopo', 'dono_id', 'lar_id', 'categoria_id', 'mes']) {
      expect(entrada.DefinirOrcamento.safeParse({ valor_centavos: 1, [campo]: 'x' }).success, campo).toBe(false);
    }
  });
});

describe('CopiarOrcamento e FiltroOrcamento', () => {
  it('o escopo é obrigatório e só conjunto ou individual', () => {
    expect(entrada.CopiarOrcamento.safeParse({ escopo: 'conjunto' }).success).toBe(true);
    expect(entrada.CopiarOrcamento.safeParse({ escopo: 'individual' }).success).toBe(true);
    expect(entrada.CopiarOrcamento.safeParse({}).success).toBe(false);
    expect(entrada.CopiarOrcamento.safeParse({ escopo: 'todos' }).success).toBe(false);
  });
  it('o filtro aceita mês e escopo opcionais; escopo inválido ou mês inexistente são recusados', () => {
    expect(entrada.FiltroOrcamento.safeParse({}).success).toBe(true);
    expect(entrada.FiltroOrcamento.safeParse({ mes: '2026-10-15', escopo: 'individual' }).success).toBe(true);
    expect(entrada.FiltroOrcamento.safeParse({ escopo: 'x' }).success).toBe(false);
    expect(entrada.FiltroOrcamento.safeParse({ mes: '2026-02-30' }).success).toBe(false);
    expect(entrada.FiltroOrcamento.safeParse({ lar_id: ID }).success).toBe(false);
  });
});

describe('SalvarMeta', () => {
  const meta = { nome: 'Carro', alvo_centavos: 100_000 };
  it('nome e alvo obrigatórios; prazo e escopo opcionais', () => {
    expect(entrada.SalvarMeta.safeParse(meta).success).toBe(true);
    expect(entrada.SalvarMeta.safeParse({ ...meta, prazo: '2027-03-01', escopo: 'conjunto' }).success).toBe(true);
    expect(entrada.SalvarMeta.safeParse({ ...meta, prazo: null }).success).toBe(true);
    expect(entrada.SalvarMeta.safeParse({ nome: 'x' }).success).toBe(false);
    expect(entrada.SalvarMeta.safeParse({ alvo_centavos: 1 }).success).toBe(false);
  });
  it('escopo desconhecido, prazo inexistente e chaves de dono, lar ou atingida_em são recusados', () => {
    expect(entrada.SalvarMeta.safeParse({ ...meta, escopo: 'x' }).success).toBe(false);
    expect(entrada.SalvarMeta.safeParse({ ...meta, prazo: '2027-02-30' }).success).toBe(false);
    for (const campo of ['dono_id', 'lar_id', 'atingida_em', 'guardado_centavos']) {
      expect(entrada.SalvarMeta.safeParse({ ...meta, [campo]: 'x' }).success, campo).toBe(false);
    }
  });
});

describe('MovimentarMeta', () => {
  const mov = { id: ID, tipo: 'aporte', valor_centavos: 500, local: 'Nubank' };
  it('id, tipo, valor e local obrigatórios; data e conta opcionais', () => {
    expect(entrada.MovimentarMeta.safeParse(mov).success).toBe(true);
    expect(entrada.MovimentarMeta.safeParse({ ...mov, data: '2026-10-10', conta_id: ID2 }).success).toBe(true);
    for (const campo of Object.keys(mov)) {
      const sem: Record<string, unknown> = { ...mov };
      delete sem[campo];
      expect(entrada.MovimentarMeta.safeParse(sem).success, campo).toBe(false);
    }
  });
  it('tipo fora de aporte e retirada, data inexistente e autor_id no corpo são recusados', () => {
    expect(entrada.MovimentarMeta.safeParse({ ...mov, tipo: 'ajuste' }).success).toBe(false);
    expect(entrada.MovimentarMeta.safeParse({ ...mov, data: '2026-02-30' }).success).toBe(false);
    for (const campo of ['autor_id', 'lar_id', 'meta_id']) {
      expect(entrada.MovimentarMeta.safeParse({ ...mov, [campo]: ID }).success, campo).toBe(false);
    }
  });
});

describe('saídas', () => {
  it('o movimento aceita a conta só como { nome } e recusa qualquer outra chave de conta (CA-08.5)', () => {
    const base = {
      id: ID,
      tipo: 'retirada',
      valor_centavos: 1,
      data: '2026-10-10',
      local: 'x',
      autor: { nome: 'Ana', sou_eu: true },
    };
    expect(saida.MovimentoMeta.safeParse(base).success).toBe(true);
    expect(saida.MovimentoMeta.safeParse({ ...base, conta: { nome: 'Itaú' } }).success).toBe(true);
    expect(saida.MovimentoMeta.safeParse({ ...base, conta: { nome: 'Itaú', id: ID } }).success).toBe(false);
    expect(saida.MovimentoMeta.safeParse({ ...base, conta_id: ID }).success).toBe(false);
  });
  it('a linha de metas não leva lar nem dono', () => {
    const linha = {
      id: ID,
      nome: 'x',
      escopo: 'conjunto',
      alvo_centavos: 10,
      guardado_centavos: 0,
      falta_centavos: 10,
      percentual: 0,
      prazo: null,
      mensal_necessario_centavos: null,
      atingida: false,
    };
    expect(saida.LinhaMetas.safeParse(linha).success).toBe(true);
    expect(saida.LinhaMetas.safeParse({ ...linha, dono_id: ID }).success).toBe(false);
  });
});
