import { copiarOrcamento, definirOrcamento } from '../dados/comandos/orcamento';
import { TOTAIS_DO_MES } from './chavesConsulta';
import { useComandoCadastro } from './useComandoCadastro';

/**
 * Invalida o prefixo do orçamento (os dois escopos: `pode_copiar_anterior` cruza escopos) e o resumo, que mostra o orçado.
 * Sem pausa offline (a tela recebe `rede`) e nada vai para a fila.
 */
export function useComandosOrcamento() {
  return {
    definirOrcamento: useComandoCadastro(definirOrcamento, TOTAIS_DO_MES, true),
    copiarOrcamento: useComandoCadastro(copiarOrcamento, TOTAIS_DO_MES, true),
  };
}
