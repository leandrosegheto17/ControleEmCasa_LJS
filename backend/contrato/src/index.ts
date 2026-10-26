import { entradaAcesso, saidaAcesso } from './acesso';
import { entradaCadastros, saidaCadastros } from './cadastros';
import { entradaConta } from './conta';
import { entradaFixas, saidaFixas } from './fixas';
import { entradaLancamento, saidaLancamento } from './lancamento';
import { entradaLar, saidaLar } from './lar';
import { entradaOrcamentoMetas, saidaOrcamentoMetas } from './orcamento-metas';
import { entradaPlano, saidaPlano } from './plano';

export const PRECO_PRO_CENTAVOS = 990;
export const TRIAL_DIAS = 14;

/** Valor monetário em centavos inteiros. */
export type Centavos = number;

export * from './acesso';
export * from './lar';
export * from './cadastros';
export * from './lancamento';
export * from './fixas';
export * from './orcamento-metas';
export * from './plano';
export * from './conta';

/** Schemas de entrada e saída de todas as rotas (SDD 6: `entrada.X` / `saida.X`). */
export const entrada = {
  ...entradaAcesso,
  ...entradaConta,
  ...entradaLar,
  ...entradaCadastros,
  ...entradaLancamento,
  ...entradaFixas,
  ...entradaOrcamentoMetas,
  ...entradaPlano,
} as const;
export const saida = {
  ...saidaAcesso,
  ...saidaLar,
  ...saidaCadastros,
  ...saidaLancamento,
  ...saidaFixas,
  ...saidaOrcamentoMetas,
  ...saidaPlano,
} as const;
