import { chamar } from '../transporte';

/** `GET /api/metas/locais`: locais já usados nas metas visíveis, do uso mais recente ao mais antigo (CA-09.5). */
export const buscarLocaisGuardados = () =>
  chamar<string[]>('GET', '/api/metas/locais', undefined, { saida: 'LocaisGuardados' });
