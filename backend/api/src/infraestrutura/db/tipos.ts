import type { ColumnType, Generated } from 'kysely';

/** Tipos das tabelas do schema `app`. Cresce com as etapas: acesso (SDD 3.3), lar e vínculo (SDD 3.4). */
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

export interface LarTabela {
  id: Generated<string>;
  nome: string;
  criado_por: string;
  criado_em: Instante;
}

export interface MembroTabela {
  id: Generated<string>;
  lar_id: string;
  usuario_id: string | null;
  nome: string;
  papel: 'titular' | 'membro';
  entrou_em: Instante;
  saiu_em: InstanteOpcional;
}

export type SituacaoConvite = 'pendente' | 'aceito' | 'recusado' | 'cancelado' | 'expirado';

export interface ConviteTabela {
  id: Generated<string>;
  lar_id: string;
  convidado_por: string;
  email: string;
  token_hash: Uint8Array;
  lar_nome: string;
  convidado_por_nome: string;
  situacao: SituacaoConvite;
  criado_em: Instante;
  expira_em: Instante;
  respondido_em: InstanteOpcional;
}

export interface CategoriaTabela {
  id: Generated<string>;
  lar_id: string;
  tipo: 'despesa' | 'receita';
  escopo: 'conjunto' | 'individual';
  dono_id: string | null;
  nome: string;
  variavel: boolean | null;
  arquivada: Generated<boolean>;
  criado_em: Generated<Date>;
}

/** Cabeçalho do lançamento (SDD 3.5; etapa 8). O id vem do cliente (ADR-010). */
export interface LancamentoTabela {
  id: string;
  lar_id: string;
  dono_id: string;
  tipo: 'despesa' | 'receita';
  escopo: 'conjunto' | 'individual';
  categoria_id: string;
  descricao: string | null;
  /** bigint: o `pg` devolve texto. */
  valor_total_centavos: ColumnType<string, number, number>;
  num_parcelas: number;
  alterado_por: string | null;
  alterado_em: InstanteOpcional;
  criado_em: Generated<Date>;
  categoria_dono_id: ColumnType<string | null, never, never>;
}

/** Parte privada do pagador (G-10): só o dono a enxerga, mesmo na conjunta. */
export interface LancamentoPagamentoTabela {
  lancamento_id: string;
  lar_id: string;
  dono_id: string;
  forma_pagamento_id: string | null;
  conta_id: string | null;
  /** date: o `pg` devolve texto `AAAA-MM-DD`. */
  data_operacao: string;
  dia_vencimento_aplicado: number | null;
}

/** Parcela de competência (RN-14, ADR-008). */
export interface ParcelaTabela {
  id: Generated<string>;
  lancamento_id: string;
  lar_id: string;
  escopo: 'conjunto' | 'individual';
  dono_id: string;
  numero: number;
  valor_centavos: ColumnType<string, number, number>;
  data: string;
  data_ajustada: Generated<boolean>;
}

export interface DB {
  usuario: UsuarioTabela;
  sessao: SessaoTabela;
  tentativa_login: TentativaLoginTabela;
  token_email: TokenEmailTabela;
  aceite_termos: AceiteTermosTabela;
  lar: LarTabela;
  membro: MembroTabela;
  convite: ConviteTabela;
  categoria: CategoriaTabela;
  lancamento: LancamentoTabela;
  lancamento_pagamento: LancamentoPagamentoTabela;
  parcela: ParcelaTabela;
}
