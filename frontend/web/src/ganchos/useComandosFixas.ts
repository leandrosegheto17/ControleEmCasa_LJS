import {
  desfazerPagamento,
  encerrarDespesaFixa,
  pagarOcorrencia,
  salvarDespesaFixa,
} from '../dados/comandos/despesasFixas';
import { CHAVES, TOTAIS_DO_MES } from './chavesConsulta';
import { useComandoCadastro } from './useComandoCadastro';

const DAS_FIXAS = [CHAVES.despesasFixas, CHAVES.ocorrenciasMes, ...TOTAIS_DO_MES] as const;
/** Pagar cria ou remove um lançamento: mexe em saldo (Pix/Débito) e no gasto do cartão. */
const DO_PAGAMENTO = [
  CHAVES.ocorrenciasMes,
  ...TOTAIS_DO_MES,
  CHAVES.lancamentosMes,
  CHAVES.contas,
  CHAVES.formas,
] as const;

/** Sem pausa offline (a tela recebe `rede` e avisa) e nada vai para a fila. */
export function useComandosFixas() {
  return {
    salvarDespesaFixa: useComandoCadastro(salvarDespesaFixa, DAS_FIXAS, true),
    encerrarDespesaFixa: useComandoCadastro(encerrarDespesaFixa, DAS_FIXAS, true),
    pagarOcorrencia: useComandoCadastro(pagarOcorrencia, DO_PAGAMENTO, true),
    desfazerPagamento: useComandoCadastro(desfazerPagamento, DO_PAGAMENTO, true),
  };
}
