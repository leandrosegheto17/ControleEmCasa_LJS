import type { ColumnType, Generated } from 'kysely';

/** Tipos das tabelas do schema `app`. Cresce com as etapas; aqui as tabelas de acesso (SDD 3.3). */
type Instante = ColumnType<Date, string, string>;
type InstanteOpcional = ColumnType<Date | null, string | null | undefined, string | null>;

export interface UsuarioTabela {
  id: Generated<string>;
  email: string;
  nome: string;
  senha_hash: string;
  email_confirmado_em: InstanteOpcional;
  trial_usado_em: InstanteOpcional;
  criado_em: Instante;
  atualizado_em: Instante;
}

export interface SessaoTabela {
  id: Generated<string>;
  token_hash: Uint8Array;
  usuario_id: string;
  criada_em: Instante;
  ultimo_uso_em: Instante;
  expira_absoluta_em: Instante;
}

export interface TentativaLoginTabela {
  id: Generated<string>;
  email_hash: Uint8Array;
  ip_hash: Uint8Array | null;
  sucesso: boolean;
  momento: Instante;
}

export interface TokenEmailTabela {
  id: Generated<string>;
  usuario_id: string;
  finalidade: 'confirmacao' | 'recuperacao' | 'exclusao';
  token_hash: Uint8Array;
  criado_em: Instante;
  expira_em: Instante;
  usado_em: InstanteOpcional;
}

export interface AceiteTermosTabela {
  id: Generated<string>;
  usuario_id: string;
  versao_termos: string;
  versao_privacidade: string;
  aceito_em: Instante;
}

export interface DB {
  usuario: UsuarioTabela;
  sessao: SessaoTabela;
  tentativa_login: TentativaLoginTabela;
  token_email: TokenEmailTabela;
  aceite_termos: AceiteTermosTabela;
}
