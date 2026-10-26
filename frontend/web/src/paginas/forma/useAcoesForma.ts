import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { DadosForma } from '../../componentes/FormularioForma';
import { useAviso } from '../../componentes/base/useAviso';
import type { ErroDados } from '../../comum/erros';
import { ehEmUso } from '../../ganchos/useComandoCadastro';
import { useComandosForma } from '../../ganchos/useFormasPagamento';
import { mensagemErro } from '../../rotulos/mensagensErro';

const LISTA = '/app/ajustes/formas';

/** Salvar, arquivar e excluir uma forma de pagamento, com os avisos e a volta à lista. */
export function useAcoesForma(formaId: string, preferidaAtual: boolean) {
  const comandos = useComandosForma();
  const { mostrar } = useAviso();
  const navegar = useNavigate();
  const [emUso, setEmUso] = useState(false);

  const falhou = (erro: ErroDados) => mostrar('erro', mensagemErro(erro));
  const voltarComAviso = (mensagem: string) => {
    mostrar('sucesso', mensagem);
    navegar(LISTA);
  };
  const aoSalvar = () => voltarComAviso('Forma salva');

  return {
    emUso,
    cancelarEmUso: () => setEmUso(false),
    salvando: comandos.salvarForma.isPending || comandos.definirPreferida.isPending,
    arquivando: comandos.arquivarForma.isPending,

    salvar(dados: DadosForma) {
      comandos.salvarForma.mutate(
        {
          id: formaId,
          nome: dados.nome,
          tipo: dados.tipo,
          diaVencimento: dados.diaVencimento,
          contaId: dados.contaId,
        },
        {
          onSuccess: () => {
            if (dados.preferida === preferidaAtual) return aoSalvar();
            comandos.definirPreferida.mutate(
              { id: formaId, preferida: dados.preferida },
              { onSuccess: aoSalvar, onError: falhou },
            );
          },
          onError: falhou,
        },
      );
    },

    arquivar() {
      comandos.arquivarForma.mutate(formaId, { onSuccess: () => voltarComAviso('Forma arquivada'), onError: falhou });
    },

    excluir() {
      comandos.excluirForma.mutate(formaId, {
        onSuccess: () => voltarComAviso('Forma excluída'),
        onError: (erro) => (ehEmUso(erro) ? setEmUso(true) : falhou(erro)),
      });
    },
  };
}
