import type { Generated } from 'kysely';

/** Tipos das tabelas do schema `app`. Cresce com as etapas; aqui só o que a etapa 3 consulta. */
export interface UsuarioTabela {
  id: Generated<string>;
  email: string;
  nome: string;
}

export interface DB {
  usuario: UsuarioTabela;
}
