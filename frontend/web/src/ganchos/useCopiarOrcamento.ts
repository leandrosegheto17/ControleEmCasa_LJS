import type { Escopo } from '../comum/enums';
import type { ErroDados } from '../dados/erros';
import { useComandosOrcamento } from './useComandosOrcamento';

interface Desfecho {
  onSuccess: () => void;
  onError: (erro: ErroDados) => void;
}

/** Copia o orçamento do mês anterior; quem chama decide o aviso do resultado. Em erro nada muda na tela. */
export function useCopiarOrcamento(mes: string, escopo: Escopo) {
  const { copiarOrcamento } = useComandosOrcamento();

  function copiar(desfecho: Desfecho) {
    copiarOrcamento.mutate({ mes, escopo }, desfecho);
  }

  return { copiar, copiando: copiarOrcamento.isPending };
}
