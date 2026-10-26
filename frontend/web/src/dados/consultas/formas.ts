import type { SaidaLinhaFormasPagamento } from '@controle/contrato';
import { chamar } from '../transporte';
import { buscarLinhaNaLista } from './cadastro';

/** `GET /api/formas`: inclusive as arquivadas. */
export const buscarFormas = () =>
  chamar<SaidaLinhaFormasPagamento[]>('GET', '/api/formas', undefined, { saidaLista: 'LinhaFormasPagamento' });

export const buscarForma = (id: string) => buscarLinhaNaLista(buscarFormas, id);
