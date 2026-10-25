import { entradaAcesso, saidaAcesso } from './acesso';
import { entradaCadastros, saidaCadastros } from './cadastros';
import { entradaLancamento, saidaLancamento } from './lancamento';
import { entradaLar, saidaLar } from './lar';

export const PRECO_PRO_CENTAVOS = 990;
export const TRIAL_DIAS = 14;

/** Valor monetário em centavos inteiros. */
export type Centavos = number;

export * from './acesso';
export * from './lar';
export * from './cadastros';
export * from './lancamento';

/** Schemas de entrada e saída de todas as rotas (SDD 6: `entrada.X` / `saida.X`). */
export const entrada = { ...entradaAcesso, ...entradaLar, ...entradaCadastros, ...entradaLancamento } as const;
export const saida = { ...saidaAcesso, ...saidaLar, ...saidaCadastros, ...saidaLancamento } as const;
