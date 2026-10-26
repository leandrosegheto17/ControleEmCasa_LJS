import type { SaidaLinhaContas } from '@controle/contrato';
import { chamar } from '../transporte';
import { buscarLinhaNaLista } from './cadastro';

/** `GET /api/contas`: inclusive as arquivadas; quem mostra decide o filtro. */
export const buscarContas = () =>
  chamar<SaidaLinhaContas[]>('GET', '/api/contas', undefined, { saidaLista: 'LinhaContas' });

export const buscarConta = (id: string) => buscarLinhaNaLista(buscarContas, id);
