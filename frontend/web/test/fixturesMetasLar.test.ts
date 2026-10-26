import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { lerResposta } from './apoio/fetchSimulado';

/**
 * Fixtures de metas, movimentos, locais e lar (etapa 12, lote 4): respostas da API (SDD 6.1 #37 a #41; SDD 6.2) conferidas
 * contra o contrato Zod. Se o contrato mudar, esta suíte acusa a fixture velha.
 */
describe('fixtures de metas e lar x contrato', () => {
  it.each(['metas.json', 'metas-vazio.json'])('%s é uma lista de LinhaMetas válida', (arquivo) => {
    for (const linha of lerResposta<unknown[]>(arquivo)) {
      expect(saida.LinhaMetas.safeParse(linha).error?.issues ?? []).toEqual([]);
    }
  });

  it.each(['meta-detalhe.json', 'meta-carro.json'])('%s é uma LinhaMetas com por_local', (arquivo) => {
    const meta = lerResposta<{ por_local?: unknown }>(arquivo);
    expect(saida.LinhaMetas.safeParse(meta).error?.issues ?? []).toEqual([]);
    expect(Array.isArray(meta.por_local)).toBe(true);
  });

  it.each(['movimentos-meta.json', 'movimentos-meta-vazio.json'])('%s é um MovimentosMeta válido', (arquivo) => {
    expect(saida.MovimentosMeta.safeParse(lerResposta(arquivo)).error?.issues ?? []).toEqual([]);
  });

  it('a conta só existe nos movimentos do próprio autor (CA-08.5)', () => {
    for (const m of lerResposta<Array<{ autor: { sou_eu: boolean }; conta?: unknown }>>('movimentos-meta.json')) {
      if (!m.autor.sou_eu) expect('conta' in m).toBe(false);
    }
  });

  it('locais-guardados.json é um LocaisGuardados válido', () => {
    expect(saida.LocaisGuardados.safeParse(lerResposta('locais-guardados.json')).error?.issues ?? []).toEqual([]);
  });

  it.each(['lar-dois-membros.json', 'lar-sozinha.json', 'lar-convite-pendente.json', 'lar-como-membro.json'])(
    '%s é um LarDetalhe válido',
    (arquivo) => {
      expect(saida.LarDetalhe.safeParse(lerResposta(arquivo)).error?.issues ?? []).toEqual([]);
    },
  );
});
