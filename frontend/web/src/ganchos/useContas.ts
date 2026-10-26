import { useQuery } from '@tanstack/react-query';
import { ajustarSaldo, arquivarConta, excluirConta, salvarConta } from '../dados/comandos/contas';
import { buscarConta, buscarContas } from '../dados/consultas/contas';
import type { ErroDados } from '../comum/erros';
import { CHAVES } from './chavesConsulta';
import { useComandoCadastro } from './useComandoCadastro';

type Contas = Awaited<ReturnType<typeof buscarContas>>;
type Conta = Awaited<ReturnType<typeof buscarConta>>;

export const useContas = () =>
  useQuery<Contas, ErroDados>({ queryKey: CHAVES.contas, queryFn: buscarContas, refetchOnWindowFocus: true });

export const useConta = (id: string) =>
  useQuery<Conta, ErroDados>({
    queryKey: CHAVES.conta(id),
    queryFn: () => buscarConta(id),
    refetchOnWindowFocus: true,
  });

/** A forma mostra o nome da conta: toda mudança em conta invalida as duas listas. */
const AFETADAS = [CHAVES.contas, CHAVES.formas];

export function useComandosConta() {
  return {
    salvarConta: useComandoCadastro(salvarConta, AFETADAS),
    arquivarConta: useComandoCadastro(arquivarConta, AFETADAS),
    excluirConta: useComandoCadastro(excluirConta, AFETADAS),
    ajustarSaldo: useComandoCadastro(
      (v: { contaId: string; saldoRealCentavos: number }) => ajustarSaldo({ ...v, simular: false }),
      [CHAVES.contas],
    ),
  };
}

/** Diferença calculada pelo servidor; não grava nada e não mexe no cache de contas. */
export const usePreviaAjuste = (contaId: string, saldoRealCentavos: number | undefined) =>
  useQuery<number, ErroDados>({
    queryKey: ['previa_ajuste', contaId, saldoRealCentavos],
    queryFn: () => ajustarSaldo({ contaId, saldoRealCentavos: saldoRealCentavos as number, simular: true }),
    enabled: saldoRealCentavos !== undefined,
  });
