import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAviso } from '../../componentes/base/useAviso';
import type { DadosFixa } from '../../componentes/fixas/FormularioFixa';
import type { ErroDados } from '../../comum/erros';
import { linkFixas } from '../../formatacao/linksApp';
import { useComandosFixas } from '../../ganchos/useComandosFixas';
import { mensagemErro } from '../../rotulos/mensagensErro';

/** Salvar e encerrar uma despesa fixa, com os avisos e a volta à lista do mês. */
export function useAcoesFixa(id: string, mes: string) {
  const comandos = useComandosFixas();
  const { mostrar } = useAviso();
  const navegar = useNavigate();
  const [erroValor, setErroValor] = useState<string | undefined>();

  const falhou = (erro: ErroDados) => mostrar('erro', mensagemErro(erro));
  const voltarComAviso = (mensagem: string) => {
    mostrar('sucesso', mensagem);
    navegar(linkFixas({ mes }));
  };

  return {
    erroValor,
    salvando: comandos.salvarDespesaFixa.isPending,
    encerrando: comandos.encerrarDespesaFixa.isPending,

    salvar(dados: DadosFixa) {
      setErroValor(undefined);
      comandos.salvarDespesaFixa.mutate(
        { id, ...dados },
        {
          onSuccess: () => voltarComAviso('Despesa fixa salva'),
          onError: (erro) =>
            erro.tipo === 'regra' && erro.codigo === 'valor_invalido' ? setErroValor(mensagemErro(erro)) : falhou(erro),
        },
      );
    },

    encerrar() {
      comandos.encerrarDespesaFixa.mutate(id, {
        onSuccess: () => voltarComAviso('Despesa fixa encerrada'),
        onError: falhou,
      });
    },
  };
}
