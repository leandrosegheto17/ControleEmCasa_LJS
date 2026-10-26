import type { EntradaLancarDespesa, SaidaLancamentoGravado } from '@controle/contrato';
import type { Escopo } from './enums';
import type { CodigoErro } from './erros';

/** Corpo completo de `POST /api/lancamentos/despesas`, com o `id` gerado no aparelho (chave de idempotência, ADR-010). */
export type ArgsItem = EntradaLancarDespesa;

/** O que quem enfileira informa: o `id` nasce na fila. */
export type ArgsNovoItem = Omit<ArgsItem, 'id'>;

/** O que a tela mostra do item sem rede. */
export type ExibicaoItem = { categoria_nome: string; forma_nome: string; escopo?: Escopo };

export type MotivoFalha = CodigoErro | 'desconhecido';

export type ItemFila = {
  id: string;
  /** `usuario.id` da sessão que enfileirou (vindo de `GET /api/sessao`); só essa sessão envia, lista ou descarta o item (G-38). */
  dono: string;
  args: ArgsItem;
  exibicao: ExibicaoItem;
  /** Epoch em ms. */
  criadoEm: number;
  situacao: 'aguardando' | 'falhou';
  motivo?: MotivoFalha;
};

export type EventoFila = { tipo: 'mudou' } | { tipo: 'enviado'; item: ItemFila; resposta: SaidaLancamentoGravado };
