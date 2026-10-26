import type { ErroDados } from '../erros';
import { ehUuid } from '../../comum/uuid';

/** "Não existe" e "não é seu" dão a mesma resposta: a tela não distingue (RT-01). */
export const REGISTRO_INVALIDO: ErroDados = { tipo: 'regra', codigo: 'registro_invalido' };

/**
 * A API não tem `GET /recurso/:id` nos cadastros: a linha vem da lista (a mesma consulta, leve e do próprio lar).
 * Id malformado ou ausente da lista vale como inexistente.
 */
export async function buscarLinhaNaLista<T extends { id: string }>(lista: () => Promise<T[]>, id: string): Promise<T> {
  if (!ehUuid(id)) throw REGISTRO_INVALIDO;
  const linha = (await lista()).find((item) => item.id === id);
  if (linha === undefined) throw REGISTRO_INVALIDO;
  return linha;
}
