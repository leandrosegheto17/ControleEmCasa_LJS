import type { SaidaLinhaCategorias } from '@controle/contrato';
import { chamar } from '../transporte';
import { buscarLinhaNaLista } from './cadastro';

/** `GET /api/categorias`: as conjuntas do lar e as individuais do próprio membro, inclusive arquivadas. */
export const buscarCategorias = () =>
  chamar<SaidaLinhaCategorias[]>('GET', '/api/categorias', undefined, { saidaLista: 'LinhaCategorias' });

export const buscarCategoria = (id: string) => buscarLinhaNaLista(buscarCategorias, id);
