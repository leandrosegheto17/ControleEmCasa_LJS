import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { textoDescarte } from './textoDescarte';

const RESPOSTAS = new URL('../../../test/fixtures/respostas/', import.meta.url);
const PAGADOR = JSON.parse(readFileSync(new URL('lancamento-pagador.json', RESPOSTAS), 'utf8')) as {
  parcelas: unknown[];
};

describe('textoDescarte', () => {
  it('parcela 3/3 ajustada para 17/11: texto exato do mockup', () => {
    expect(textoDescarte(PAGADOR.parcelas as never)).toBe(
      'A parcela 3/3 teve a data ajustada à mão (17/11). Ao mudar o valor total, as 3 parcelas são recalculadas pelo vencimento do cartão e esse ajuste será descartado.',
    );
  });

  it('com valor total entre os campos salvos, mantém o texto do mockup', () => {
    expect(textoDescarte(PAGADOR.parcelas as never, { valorTotalCentavos: 1000, data: '2026-01-02' })).toBe(
      textoDescarte(PAGADOR.parcelas as never),
    );
  });

  it('mudança só de data não cita "valor total"', () => {
    const texto = textoDescarte(PAGADOR.parcelas as never, { data: '2026-01-02' });
    expect(texto).not.toContain('valor total');
    expect(texto).toContain('Ao alterar a compra, as 3 parcelas são recalculadas pelo vencimento do cartão');
  });

  it('mudança só de forma ou de nº de parcelas usa "alterar a compra"', () => {
    expect(textoDescarte(PAGADOR.parcelas as never, { formaId: 'f1' })).toContain('Ao alterar a compra');
    expect(textoDescarte(PAGADOR.parcelas as never, { numParcelas: 2 })).toContain('Ao alterar a compra');
  });
});
