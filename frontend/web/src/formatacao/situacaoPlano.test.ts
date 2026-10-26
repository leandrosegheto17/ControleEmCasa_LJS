import type { SaidaMeuPlano } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { descreverSituacao, diasAte } from './situacaoPlano';

/** Textos da tela Meu plano (RN-24; CA-24.1 trial de 14 dias; CA-24.8 "Pro até" depois de cancelar). */

const AGORA = new Date('2026-10-09T18:00:00.000Z');
const base: SaidaMeuPlano = {
  plano: 'free',
  situacao: 'free',
  trial_ate: '2026-09-20T15:00:00.000Z',
  periodo_ate: null,
  preco_centavos: 990,
  sou_titular: true,
};

describe('descreverSituacao', () => {
  it('trial com dias restantes, no singular e no plural', () => {
    const trial = { ...base, plano: 'pro' as const, situacao: 'trial' as const };
    expect(descreverSituacao({ ...trial, trial_ate: '2026-10-23T15:00:00.000Z' }, AGORA)).toBe(
      'Período de teste: faltam 14 dias',
    );
    expect(descreverSituacao({ ...trial, trial_ate: '2026-10-10T15:00:00.000Z' }, AGORA)).toBe(
      'Período de teste: falta 1 dia',
    );
  });

  it('trial vencido e free', () => {
    expect(descreverSituacao({ ...base, situacao: 'trial' }, AGORA)).toBe('Período de teste encerrado');
    expect(descreverSituacao(base, AGORA)).toBe('Plano Free');
  });

  it('ativa, atrasada e cancelada (com e sem período pago)', () => {
    expect(descreverSituacao({ ...base, plano: 'pro', situacao: 'ativa' }, AGORA)).toBe('Ativa');
    expect(
      descreverSituacao({ ...base, plano: 'pro', situacao: 'ativa', periodo_ate: '2026-11-09T15:00:00.000Z' }, AGORA),
    ).toBe('Ativa, paga até 09/11/2026');
    expect(descreverSituacao({ ...base, situacao: 'atrasada' }, AGORA)).toBe('Pagamento atrasado');
    expect(
      descreverSituacao(
        { ...base, plano: 'pro', situacao: 'cancelada', periodo_ate: '2026-11-09T15:00:00.000Z' },
        AGORA,
      ),
    ).toBe('Cancelada. Pro até 09/11/2026');
    expect(descreverSituacao({ ...base, situacao: 'cancelada', periodo_ate: '2026-10-01T15:00:00.000Z' }, AGORA)).toBe(
      'Cancelada. A casa está no plano Free',
    );
  });

  it('diasAte nunca é negativo', () => {
    expect(diasAte('2026-01-01T00:00:00.000Z', AGORA)).toBe(0);
  });
});
