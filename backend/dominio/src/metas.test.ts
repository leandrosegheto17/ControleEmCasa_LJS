import { describe, expect, it } from 'vitest';
import { atingidaEm, progressoMeta } from './metas';

const prog = (alvoCentavos: number, guardadoCentavos: number, prazo: string | null, hoje: string) =>
  progressoMeta({ alvoCentavos, guardadoCentavos, prazo, hoje });

// Casos portados de MyMoney/backend/supabase/tests/metas/progresso_meta.sql
// (metas do seed 08-metas.sql e metas de borda), hoje = 2026-10-09 salvo indicação.
describe('progressoMeta: casos do pgTAP', () => {
  it('Viagem Nordeste (alvo 1.200.000, guardado 620.000, prazo 2027-07): 52% e mensal 64.445', () => {
    expect(prog(1_200_000, 620_000, '2027-07-01', '2026-10-09')).toEqual({
      guardadoCentavos: 620_000,
      faltaCentavos: 580_000,
      percentual: 52,
      mensalNecessarioCentavos: 64_445,
      atingida: false,
    });
  });
  it('Reserva de emergência (alvo 3.000.000, guardado 1.850.000, sem prazo): 62% e sem mensal', () => {
    expect(prog(3_000_000, 1_850_000, null, '2026-10-09')).toEqual({
      guardadoCentavos: 1_850_000,
      faltaCentavos: 1_150_000,
      percentual: 62,
      mensalNecessarioCentavos: null,
      atingida: false,
    });
  });
  it('Curso de inglês (alvo 180.000, guardado 180.000): atingida, falta 0 e 100%', () => {
    const r = prog(180_000, 180_000, null, '2026-10-09');
    expect([r.faltaCentavos, r.percentual, r.atingida]).toEqual([0, 100, true]);
  });
  it('Carro novo (alvo 2.000.000, sem movimentos, prazo 2028-12): 0% e mensal 76.924', () => {
    expect(prog(2_000_000, 0, '2028-12-01', '2026-10-09')).toEqual({
      guardadoCentavos: 0,
      faltaCentavos: 2_000_000,
      percentual: 0,
      mensalNecessarioCentavos: 76_924,
      atingida: false,
    });
  });
  it('guardado acima do alvo (1.500 de 1.000): falta 0, 100% e atingida', () => {
    const r = prog(1000, 1500, null, '2026-10-09');
    expect([r.guardadoCentavos, r.faltaCentavos, r.percentual, r.atingida]).toEqual([1500, 0, 100, true]);
  });
  it('99,6% vira 99 e não atingida', () => {
    const r = prog(1000, 996, null, '2026-10-09');
    expect([r.percentual, r.atingida]).toEqual([99, false]);
  });
  it('prazo no mês corrente pede a falta inteira', () => {
    expect(prog(1000, 0, '2026-10-01', '2026-10-09').mensalNecessarioCentavos).toBe(1000);
  });
  it('prazo vencido pede a falta inteira', () => {
    expect(prog(1000, 0, '2026-06-01', '2026-10-09').mensalNecessarioCentavos).toBe(1000);
  });
  it('virada de ano: dezembro para janeiro é 1 mês', () => {
    expect(prog(1201, 0, '2027-01-01', '2026-12-15').mensalNecessarioCentavos).toBe(1201);
  });
  it('dois meses até o prazo: falta dividida com arredondamento para cima', () => {
    expect(prog(1201, 0, '2027-01-01', '2026-11-15').mensalNecessarioCentavos).toBe(601);
  });
  it('falta zero com prazo: mensal nulo', () => {
    expect(prog(1000, 1000, '2027-07-01', '2026-10-09').mensalNecessarioCentavos).toBeNull();
  });
});

// Tabela de exemplos da RN-08 (PRD-TECNICO), hoje em outubro/2026.
describe('progressoMeta: tabela da RN-08', () => {
  const hoje = '2026-10-24';
  it('quase lá: 99.600 de 100.000 → 99 (não 100), falta 400, prazo nov/2026 → 400', () => {
    expect(prog(100_000, 99_600, '2026-11-01', hoje)).toEqual({
      guardadoCentavos: 99_600,
      faltaCentavos: 400,
      percentual: 99,
      mensalNecessarioCentavos: 400,
      atingida: false,
    });
  });
  it('atingida: 100.000 de 100.000 → 100, falta 0, mensal nulo', () => {
    const r = prog(100_000, 100_000, '2026-11-01', hoje);
    expect([r.percentual, r.faltaCentavos, r.mensalNecessarioCentavos, r.atingida]).toEqual([100, 0, null, true]);
  });
  it('passou: 150.000 de 100.000 → 100, falta 0, mensal nulo', () => {
    const r = prog(100_000, 150_000, null, hoje);
    expect([r.percentual, r.faltaCentavos, r.mensalNecessarioCentavos]).toEqual([100, 0, null]);
  });
  it('prazo jan/2027: 3 meses → 33.334', () => {
    expect(prog(100_000, 0, '2027-01-01', hoje).mensalNecessarioCentavos).toBe(33_334);
  });
  it('prazo vencido (set/2026): mínimo 1 mês → 100.000', () => {
    expect(prog(100_000, 0, '2026-09-01', hoje).mensalNecessarioCentavos).toBe(100_000);
  });
  it('CA-08.1: meta nova nasce com guardado 0', () => {
    const r = prog(100_000, 0, null, hoje);
    expect([r.guardadoCentavos, r.percentual, r.atingida]).toEqual([0, 0, false]);
  });
  it('arredondamento perto de 99,5%: 99,4% → 99; 99,5% → limitado a 99', () => {
    expect(prog(1000, 994, null, hoje).percentual).toBe(99);
    expect(prog(1000, 995, null, hoje).percentual).toBe(99);
    expect(prog(1000, 999, null, hoje).percentual).toBe(99);
  });
  it('0,5% arredonda para 1 (metade para cima, como o Postgres)', () => {
    expect(prog(1000, 5, null, hoje).percentual).toBe(1);
    expect(prog(1000, 4, null, hoje).percentual).toBe(0);
  });
  it('prazo em qualquer dia do mês conta pelo mês', () => {
    expect(prog(100_000, 0, '2027-01-31', hoje).mensalNecessarioCentavos).toBe(33_334);
  });
  it('alvo inválido é erro de programação', () => {
    expect(() => prog(0, 0, null, hoje)).toThrow();
  });
});

// CA-08.3 e CA-08.4; legado F sincronizar_atingida_meta.sql.
describe('atingidaEm (CA-08.3, CA-08.4)', () => {
  it('CA-08.3: aporte que leva ao alvo marca hoje', () => {
    expect(atingidaEm({ atingidaEmAtual: null, atingida: true, hoje: '2026-10-24' })).toBe('2026-10-24');
  });
  it('já marcada continua com a data original', () => {
    expect(atingidaEm({ atingidaEmAtual: '2026-05-20', atingida: true, hoje: '2026-10-24' })).toBe('2026-05-20');
  });
  it('CA-08.3: retirada que faz cair abaixo do alvo desmarca', () => {
    expect(atingidaEm({ atingidaEmAtual: '2026-05-20', atingida: false, hoje: '2026-10-24' })).toBeNull();
  });
  it('CA-08.4: alvo aumentado acima do guardado deixa de estar atingida; reduzido abaixo, fica', () => {
    const subir = progressoMeta({ alvoCentavos: 200_000, guardadoCentavos: 150_000, prazo: null, hoje: '2026-10-24' });
    expect(atingidaEm({ atingidaEmAtual: '2026-05-20', atingida: subir.atingida, hoje: '2026-10-24' })).toBeNull();
    const descer = progressoMeta({ alvoCentavos: 100_000, guardadoCentavos: 150_000, prazo: null, hoje: '2026-10-24' });
    expect(atingidaEm({ atingidaEmAtual: null, atingida: descer.atingida, hoje: '2026-10-24' })).toBe('2026-10-24');
  });
  it('não atingida e nunca marcada continua nula', () => {
    expect(atingidaEm({ atingidaEmAtual: null, atingida: false, hoje: '2026-10-24' })).toBeNull();
  });
});
