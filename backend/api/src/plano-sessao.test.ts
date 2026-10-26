import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { json, pedir } from './testes-suporte-lar';
import { DIA, larDePlano } from './testes-suporte-plano';

/** `GET /api/sessao` leva o plano efetivo do lar (SDD 5.2; RN-24; CA-24.2), sem chamada extra do front. */

describe.skipIf(!bancoDisponivel)('plano em GET /api/sessao', () => {
  it('trial: pro para os dois membros; vencido o trial sem assinar: free', async () => {
    const l = await larDePlano('sessao.plano', { comMembro: true });
    for (const quem of [l.titular, l.membro!]) {
      const r = await pedir(l.app, 'GET', '/api/sessao', quem);
      expect(saida.SessaoAtual.parse(await json(r)).plano).toBe('pro');
    }
    await l.avancar(15 * DIA);
    for (const quem of [l.titular, l.membro!]) {
      const r = await pedir(l.app, 'GET', '/api/sessao', quem);
      expect(saida.SessaoAtual.parse(await json(r)).plano).toBe('free');
    }
  });
});
