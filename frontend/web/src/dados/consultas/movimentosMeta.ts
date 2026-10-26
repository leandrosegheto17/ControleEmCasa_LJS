import type { SaidaMovimentoMeta } from '@controle/contrato';
import { ehUuid } from '../../comum/uuid';
import { chamar } from '../transporte';
import { REGISTRO_INVALIDO } from './cadastro';

/** `GET /api/metas/:id/movimentos`, intacto: a `conta` só vem nas linhas do autor, quem filtra é o servidor (CA-08.5). */
export function buscarMovimentosMeta(metaId: string): Promise<SaidaMovimentoMeta[]> {
  if (!ehUuid(metaId)) return Promise.reject(REGISTRO_INVALIDO);
  return chamar<SaidaMovimentoMeta[]>('GET', `/api/metas/${metaId}/movimentos`, undefined, { saida: 'MovimentosMeta' });
}
