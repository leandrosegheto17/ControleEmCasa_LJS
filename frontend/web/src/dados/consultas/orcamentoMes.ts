import type { SaidaOrcamentoMes } from '@controle/contrato';
import type { Escopo } from '../../comum/enums';
import { chamar } from '../transporte';

/**
 * `GET /api/orcamento?mes=AAAA-MM-01&escopo=`. Devolve a resposta como veio (total, ordem das linhas e situações são
 * do servidor). `mes` é `AAAA-MM`.
 */
export function buscarOrcamentoMes(mes: string, escopo: Escopo): Promise<SaidaOrcamentoMes> {
  return chamar<SaidaOrcamentoMes>('GET', `/api/orcamento?mes=${mes}-01&escopo=${escopo}`, undefined, {
    saida: 'OrcamentoMes',
  });
}
