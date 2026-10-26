import type { SaidaLancamento } from '@controle/contrato';
import { ehUuid } from '../../comum/uuid';
import { chamar } from '../transporte';
import { REGISTRO_INVALIDO } from './cadastro';

/**
 * `GET /api/lancamentos/:id`. Inexistente, alheio e id malformado dão a mesma resposta: a tela não distingue.
 * Para o outro membro as chaves privadas (`pagamento`, `data_ajustada`) NÃO existem (RN-04).
 */
export async function buscarLancamento(id: string): Promise<SaidaLancamento> {
  if (!ehUuid(id)) throw REGISTRO_INVALIDO;
  return chamar<SaidaLancamento>('GET', `/api/lancamentos/${id}`, undefined, { saida: 'Lancamento' });
}
