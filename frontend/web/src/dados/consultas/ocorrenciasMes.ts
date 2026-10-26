import type { SaidaOcorrenciasMes } from '@controle/contrato';
import { chamar } from '../transporte';

/**
 * `GET /api/fixas/ocorrencias?mes=AAAA-MM-01`. Devolve a resposta como veio (contagens, previsto e ordem são do
 * servidor; forma, conta e data do pagamento nunca vêm). `mes` é `AAAA-MM`.
 */
export function buscarOcorrenciasMes(mes: string): Promise<SaidaOcorrenciasMes> {
  return chamar<SaidaOcorrenciasMes>('GET', `/api/fixas/ocorrencias?mes=${mes}-01`, undefined, {
    saida: 'OcorrenciasMes',
  });
}
