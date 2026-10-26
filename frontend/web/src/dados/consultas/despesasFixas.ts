import type { SaidaLinhaDespesasFixas } from '@controle/contrato';
import { chamar } from '../transporte';
import { buscarLinhaNaLista } from './cadastro';

/** `GET /api/fixas`: o modelo é do lar (os dois membros veem). Inclui as encerradas: a tela filtra a exibição. */
export const buscarDespesasFixas = () =>
  chamar<SaidaLinhaDespesasFixas[]>('GET', '/api/fixas', undefined, { saidaLista: 'LinhaDespesasFixas' });

/** A API não tem `GET /api/fixas/:id`: a linha vem da lista. Id malformado ou ausente vale como inexistente. */
export const buscarDespesaFixa = (id: string) => buscarLinhaNaLista(buscarDespesasFixas, id);
