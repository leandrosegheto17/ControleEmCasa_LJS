import { movimentarMeta, salvarMeta } from '../dados/comandos/metas';
import { CHAVES, TOTAIS_DO_MES } from './chavesConsulta';
import { useComandoCadastro } from './useComandoCadastro';

/** Movimento com conta muda o saldo; o resumo do mês mostra as metas. Sem pausa offline e nada vai para a fila. */
export function useComandosMetas() {
  return {
    salvarMeta: useComandoCadastro(salvarMeta, [CHAVES.metas, ...TOTAIS_DO_MES], true),
    movimentarMeta: useComandoCadastro(
      movimentarMeta,
      ({ metaId }) => [
        CHAVES.metas,
        CHAVES.movimentosDaMeta(metaId),
        CHAVES.locaisGuardados,
        ...TOTAIS_DO_MES,
        CHAVES.contas,
      ],
      true,
    ),
  };
}
