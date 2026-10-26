import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAviso } from '../../componentes/base/useAviso';
import type { ErroDados } from '../../comum/erros';
import { useComandosLancamento } from '../../ganchos/useComandosLancamento';
import { mensagemErro } from '../../rotulos/mensagensErro';

/** Excluir o lançamento: avisa e volta à lista; "já não existe" troca a tela; o resto vira erro no topo. */
export function useExcluirLancamento(id: string, destino: string) {
  const { excluir } = useComandosLancamento();
  const { mostrar } = useAviso();
  const navegar = useNavigate();
  const [erro, setErro] = useState<string | undefined>();
  const [naoExiste, setNaoExiste] = useState(false);
  const emCurso = useRef<Promise<void> | null>(null);

  async function tentar() {
    setErro(undefined);
    try {
      await excluir.mutateAsync(id);
    } catch (e) {
      const falha = e as ErroDados;
      if (falha.tipo === 'regra' && falha.codigo === 'registro_invalido') setNaoExiste(true);
      else setErro(mensagemErro(falha));
      return;
    }
    mostrar('sucesso', 'Excluído');
    navegar(destino);
  }

  /** Um segundo pedido durante a chamada espera a mesma tentativa, sem enviar outra. */
  function excluirAgora() {
    emCurso.current ??= tentar().finally(() => {
      emCurso.current = null;
    });
    return emCurso.current;
  }

  return { erro, naoExiste, excluir: excluirAgora };
}
