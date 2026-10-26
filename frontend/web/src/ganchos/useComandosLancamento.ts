import { useMutation, useQueryClient } from '@tanstack/react-query';
import { alterarDataParcela, editarLancamento, excluirLancamento } from '../dados/comandos/lancamentos';
import type { ErroDados } from '../dados/erros';
import { CHAVES, TOTAIS_DO_MES } from './chavesConsulta';
import { useComandoCadastro } from './useComandoCadastro';

export { ehConfirmarDescarte } from '../dados/comandos/lancamentos';

type ArgsData = Parameters<typeof alterarDataParcela>[0] & { lancamentoId: string };

/** Excluir (ou editar) o lançamento de pagamento de uma fixa devolve a ocorrência a pendente (RN-15). */
const LISTAS = [CHAVES.lancamentosMes, CHAVES.ocorrenciasMes, ...TOTAIS_DO_MES] as const;

export function useComandosLancamento() {
  const cliente = useQueryClient();
  const editar = useComandoCadastro(editarLancamento, ({ id }) => [CHAVES.lancamento(id), ...LISTAS]);
  const alterarData = useComandoCadastro(
    ({ parcelaId, data }: ArgsData) => alterarDataParcela({ parcelaId, data }),
    ({ lancamentoId }) => [CHAVES.lancamento(lancamentoId), CHAVES.formas, ...LISTAS],
  );
  // O detalhe sai do cache em vez de ser relido: o item não existe mais.
  const excluir = useMutation<void, ErroDados, string>({
    mutationFn: (id) => excluirLancamento(id),
    onSuccess: async (_, id) => {
      cliente.removeQueries({ queryKey: CHAVES.lancamento(id) });
      await Promise.all(LISTAS.map((queryKey) => cliente.invalidateQueries({ queryKey })));
    },
  });
  return { editar, excluir, alterarDataParcela: alterarData };
}
