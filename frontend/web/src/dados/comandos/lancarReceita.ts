import type { EntradaLancarReceita, SaidaLancamentoGravado } from '@controle/contrato';
import { chamar } from '../transporte';

/**
 * `POST /api/lancamentos/receitas`. Idempotente pelo `id`: repetir a chamada devolve o lançamento já gravado com
 * `ja_existia: true` (ADR-010). Receita não passa pela fila offline (ADR-007).
 */
export function lancarReceita(corpo: EntradaLancarReceita): Promise<SaidaLancamentoGravado> {
  return chamar<SaidaLancamentoGravado>('POST', '/api/lancamentos/receitas', corpo, { saida: 'LancarReceita' });
}
