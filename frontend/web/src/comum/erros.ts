import type {
  CodigoErroAcesso,
  CodigoErroCadastros,
  CodigoErroFixas,
  CodigoErroLancamento,
  CodigoErroLar,
  CodigoErroOrcamentoMetas,
  CodigoErroPlano,
} from '@controle/contrato';

/** Códigos de erro estáveis da API (SDD 7): a união dos códigos de cada área do contrato. */
export type CodigoErro =
  | CodigoErroAcesso
  | CodigoErroCadastros
  | CodigoErroLancamento
  | CodigoErroLar
  | CodigoErroFixas
  | CodigoErroOrcamentoMetas
  | CodigoErroPlano;

/**
 * Lista de execução dos códigos, para reconhecer o `code` de uma resposta sem levar o Zod do contrato para o bundle
 * (SDD 9.2). Um teste confere que ela é igual à união das listas do contrato.
 */
export const CODIGOS_ERRO = [
  'valor_invalido',
  'credenciais_invalidas',
  'senha_fraca',
  'link_expirado',
  'sessao_expirada',
  'email_nao_confirmado',
  'conta_em_exclusao',
  'muitas_tentativas',
  'muitas_requisicoes',
  'origem_invalida',
  'registro_invalido',
  'nome_repetido',
  'em_uso',
  'categoria_em_uso',
  'sem_permissao',
  'confirmar_descarte_ajustes',
  'categoria_arquivada',
  'forma_arquivada',
  'conta_arquivada',
  'titular_obrigatorio',
  'sem_lar',
  'convite_invalido',
  'lar_cheio',
  'convite_pendente',
  'ja_tem_lar',
  'ocorrencia_paga',
  'retirada_maior_que_guardado',
  // Plano (etapa 13)
  'plano_necessario',
  'assinatura_ativa',
  'sem_assinatura',
  'token_invalido',
  'indisponivel',
] as const satisfies readonly CodigoErro[];

export type ErroDados =
  | { tipo: 'rede' }
  | { tipo: 'indisponivel' }
  | { tipo: 'autenticacao' }
  | { tipo: 'regra'; codigo: CodigoErro }
  | { tipo: 'desconhecido' };
