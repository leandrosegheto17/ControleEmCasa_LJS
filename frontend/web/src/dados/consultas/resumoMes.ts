import type { SaidaResumoMes } from '@controle/contrato';
import { chamar } from '../transporte';

/** `GET /api/resumo?mes=AAAA-MM-01`. Devolve a resposta como veio: totais e situações são do servidor. `mes` é `AAAA-MM`. */
export function buscarResumoMes(mes: string): Promise<SaidaResumoMes> {
  return chamar<SaidaResumoMes>('GET', `/api/resumo?mes=${mes}-01`, undefined, { saida: 'ResumoMes' });
}
