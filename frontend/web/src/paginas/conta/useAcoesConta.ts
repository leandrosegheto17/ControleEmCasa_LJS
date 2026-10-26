import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAviso } from '../../componentes/base/useAviso';
import type { ErroDados } from '../../comum/erros';
import { ehEmUso } from '../../ganchos/useComandoCadastro';
import { useComandosConta } from '../../ganchos/useContas';
import { mensagemErro } from '../../rotulos/mensagensErro';

const LISTA = '/app/ajustes/contas';

/** Salvar, arquivar, excluir e ajustar uma conta, com os avisos e a volta à lista. */
export function useAcoesConta(contaId: string) {
  const comandos = useComandosConta();
  const { mostrar } = useAviso();
  const navegar = useNavigate();
  const [emUso, setEmUso] = useState(false);
  const [erroSaldoInicial, setErroSaldoInicial] = useState<string | undefined>();

  const falhou = (erro: ErroDados) => mostrar('erro', mensagemErro(erro));
  const voltarComAviso = (mensagem: string) => {
    mostrar('sucesso', mensagem);
    navegar(LISTA);
  };

  return {
    emUso,
    erroSaldoInicial,
    cancelarEmUso: () => setEmUso(false),
    salvando: comandos.salvarConta.isPending,
    arquivando: comandos.arquivarConta.isPending,
    ajustando: comandos.ajustarSaldo.isPending,

    salvar(nome: string, saldoInicialCentavos: number) {
      setErroSaldoInicial(undefined);
      comandos.salvarConta.mutate(
        { id: contaId, nome, saldoInicialCentavos },
        {
          onSuccess: () => voltarComAviso('Conta salva'),
          onError: (erro) =>
            erro.tipo === 'regra' && erro.codigo === 'valor_invalido'
              ? setErroSaldoInicial(mensagemErro(erro))
              : falhou(erro),
        },
      );
    },

    arquivar() {
      comandos.arquivarConta.mutate(contaId, { onSuccess: () => voltarComAviso('Conta arquivada'), onError: falhou });
    },

    excluir() {
      comandos.excluirConta.mutate(contaId, {
        onSuccess: () => voltarComAviso('Conta excluída'),
        onError: (erro) => (ehEmUso(erro) ? setEmUso(true) : falhou(erro)),
      });
    },

    ajustar(saldoRealCentavos: number, aoConcluir: () => void) {
      comandos.ajustarSaldo.mutate(
        { contaId, saldoRealCentavos },
        {
          onSuccess: () => {
            mostrar('sucesso', 'Saldo ajustado');
            aoConcluir();
          },
          onError: falhou,
        },
      );
    },
  };
}
