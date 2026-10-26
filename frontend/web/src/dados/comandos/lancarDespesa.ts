import type { SaidaLancamentoGravado } from '@controle/contrato';
import type { ArgsItem } from '../../comum/fila';
import { chamar } from '../transporte';

/** `POST /api/lancamentos/despesas`. O `id` é do cliente: o reenvio devolve o já gravado (`ja_existia`, ADR-010). */
export function lancarDespesa(args: ArgsItem): Promise<SaidaLancamentoGravado> {
  return chamar<SaidaLancamentoGravado>('POST', '/api/lancamentos/despesas', args, { saida: 'LancarDespesa' });
}
