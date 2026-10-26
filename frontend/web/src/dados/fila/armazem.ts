import { createStore, del, get, set, values } from 'idb-keyval';
import type { ItemFila } from './tipos';

/** Banco próprio da fila: o cache de leitura e a limpeza de sessão nunca o tocam. */
const armazem = createStore('controle-em-casa-fila', 'itens');

/** Todos os itens (de qualquer dono) em ordem de criação; o `id` desempata. */
export async function lerTodos(): Promise<ItemFila[]> {
  const itens = await values<ItemFila>(armazem);
  return itens.sort((a, b) => a.criadoEm - b.criadoEm || a.id.localeCompare(b.id));
}

export const lerItem = (id: string) => get<ItemFila>(id, armazem);

export const gravarItem = (item: ItemFila) => set(item.id, item, armazem);

export const removerItem = (id: string) => del(id, armazem);
