import type { SaidaLinhaMetas } from '@controle/contrato';
import { ehUuid } from '../../comum/uuid';
import { chamar } from '../transporte';
import { REGISTRO_INVALIDO } from './cadastro';

/** `GET /api/metas`: na ordem do servidor (não atingidas primeiro, depois por nome); a meta individual do outro membro não chega. */
export const buscarMetas = () =>
  chamar<SaidaLinhaMetas[]>('GET', '/api/metas', undefined, { saidaLista: 'LinhaMetas' });

/** `GET /api/metas/:id`, com `por_local`. Inexistente, alheia e id malformado dão `registro_invalido`. */
export function buscarMeta(id: string): Promise<SaidaLinhaMetas> {
  if (!ehUuid(id)) return Promise.reject(REGISTRO_INVALIDO);
  return chamar<SaidaLinhaMetas>('GET', `/api/metas/${id}`, undefined, { saida: 'LinhaMetas' });
}
