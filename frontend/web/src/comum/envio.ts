import type { CodigoErro } from './erros';
import type { SaidaLancamentoGravado as LancarDespesa } from '@controle/contrato';
import type { ExibicaoItem } from './fila';
import type { SaidaLancamentoGravado as LancarReceita } from '@controle/contrato';

export interface EntradaLancar {
  valorCentavos: number;
  categoriaId: string;
  formaId: string;
  parcelas: number;
  data: string;
  descricao: string;
  exibicao: ExibicaoItem;
}

export type ResultadoLancar =
  | { tipo: 'sucesso'; resposta: LancarDespesa }
  | { tipo: 'guardado' }
  | { tipo: 'regra'; codigo: CodigoErro }
  /** Não coube na fila (sem sessão ou fila cheia): nada foi gravado. */
  | { tipo: 'erro' };

export type TipoLancamento = 'despesa' | 'receita';

export interface EntradaReceita {
  tipo: 'receita';
  valorCentavos: number;
  categoriaId: string;
  contaId: string;
  data: string;
  descricao: string;
}

export type ResultadoReceita =
  | { tipo: 'sucesso'; resposta: LancarReceita }
  | { tipo: 'sem_conexao' }
  | { tipo: 'regra'; codigo: CodigoErro }
  | { tipo: 'erro' };

export type EntradaDespesa = EntradaLancar & { tipo: 'despesa' };

/** O que a folha entrega a quem envia, e o que espera receber de volta. */
export type EntradaFolha = EntradaDespesa | EntradaReceita;
export type ResultadoFolha = ResultadoLancar | ResultadoReceita;
