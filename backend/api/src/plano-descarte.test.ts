import { describe, expect, it, vi } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { convidarEAceitar, criarLarDe, pessoa } from './testes-suporte-lar';
import { assinarOk, assinaturaNoBanco, larDePlano } from './testes-suporte-plano';

/**
 * Descarte do lar do titular que aceita convite de outro lar (CA-23.9; ADR 012): a assinatura do Asaas do lar
 * descartado é cancelada; falha do Asaas não impede o aceite.
 */

describe.skipIf(!bancoDisponivel)('aceitar convite descarta o lar e cancela a assinatura no Asaas', () => {
  it('cancela a assinatura do Asaas e marca o lar descartado como cancelado', async () => {
    const l = await larDePlano('descarte.ok');
    const { assinaturaId } = await assinarOk(l);
    const outro = await pessoa('descarte.ok.outro', 'Outro titular', l.relogio.agora());
    await criarLarDe(l.app, outro);
    await convidarEAceitar(l.app, l.caixa, outro, l.titular);
    expect(l.asaas.canceladas).toEqual([assinaturaId]);
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('cancelada');
  });

  it('lar sem assinatura no Asaas: o aceite não chama o Asaas', async () => {
    const l = await larDePlano('descarte.sem');
    const outro = await pessoa('descarte.sem.outro', 'Outro titular', l.relogio.agora());
    await criarLarDe(l.app, outro);
    await convidarEAceitar(l.app, l.caixa, outro, l.titular);
    expect(l.asaas.chamadas).toEqual([]);
  });

  it('Asaas fora do ar no cancelamento: o convite é aceito e a pendência fica registrada, sem dado pessoal', async () => {
    const l = await larDePlano('descarte.falha');
    const { assinaturaId } = await assinarOk(l);
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const outro = await pessoa('descarte.falha.outro', 'Outro titular', l.relogio.agora());
    await criarLarDe(l.app, outro);
    l.asaas.falhar.add('cancelarAssinatura');
    await convidarEAceitar(l.app, l.caixa, outro, l.titular);
    expect(l.asaas.canceladas).toEqual([]);
    const linha = await assinaturaNoBanco(l.larId);
    expect(linha?.asaas_assinatura_id).toBe(assinaturaId);
    expect(linha?.situacao).not.toBe('cancelada');
    const texto = log.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(texto).toContain('asaas_cancelamento_pendente');
    expect(texto).toContain(assinaturaId);
    expect(texto).not.toContain(l.titular.email);
    log.mockRestore();
  });
});
