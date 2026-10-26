import { useState } from 'react';
import { useAviso } from '../../componentes/base/useAviso';
import type { ErroDados } from '../../comum/erros';
import { useComandosLancamento } from '../../ganchos/useComandosLancamento';
import { mensagemErro } from '../../rotulos/mensagensErro';

/** Ajustar a data de uma parcela: salva na hora, avisa e deixa o erro (texto genérico) para o topo da tela. */
export function useAlterarDataParcela(lancamentoId: string) {
  const { alterarDataParcela } = useComandosLancamento();
  const { mostrar } = useAviso();
  const [erro, setErro] = useState<string | undefined>();

  async function alterar(parcelaId: string, data: string) {
    setErro(undefined);
    try {
      await alterarDataParcela.mutateAsync({ lancamentoId, parcelaId, data });
    } catch (e) {
      setErro(mensagemErro(e as ErroDados));
      return;
    }
    mostrar('sucesso', 'Data da parcela alterada');
  }

  return { erro, alterar };
}
