import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAviso } from '../../componentes/base/useAviso';
import type { CamposLancamento } from '../../comum/lancamentos';
import type { ErroDados } from '../../comum/erros';
import { ehConfirmarDescarte, useComandosLancamento } from '../../ganchos/useComandosLancamento';
import { mensagemErro } from '../../rotulos/mensagensErro';

const LISTA = '/app/lancamentos';

/** A lista (com mês e filtros) que abriu o detalhe, passada em `state.voltarPara`; sem ela, a lista padrão. */
export function destinoDaVolta(state: unknown): string {
  const voltarPara = (state as { voltarPara?: unknown } | null)?.voltarPara;
  return typeof voltarPara === 'string' && voltarPara.startsWith(LISTA) ? voltarPara : LISTA;
}

/** Salvar a edição, com a confirmação de descarte de ajustes, o erro no topo e a volta à lista. */
export function useSalvarLancamento(id: string) {
  const { editar } = useComandosLancamento();
  const { mostrar } = useAviso();
  const navegar = useNavigate();
  const destino = destinoDaVolta(useLocation().state);
  const [erro, setErro] = useState<string | undefined>();
  const [naoExiste, setNaoExiste] = useState(false);
  const [aConfirmar, setAConfirmar] = useState<CamposLancamento | null>(null);

  async function enviar(campos: CamposLancamento, confirmarDescarte: boolean) {
    setErro(undefined);
    try {
      await editar.mutateAsync({ id, campos, confirmarDescarte });
    } catch (e) {
      const falha = e as ErroDados;
      if (ehConfirmarDescarte(falha)) setAConfirmar(campos);
      else if (falha.tipo === 'regra' && falha.codigo === 'registro_invalido') setNaoExiste(true);
      else setErro(mensagemErro(falha));
      return;
    }
    mostrar('sucesso', 'Alterações salvas');
    navegar(destino);
  }

  return {
    destino,
    erro,
    naoExiste,
    salvando: editar.isPending,
    /** Campos à espera do "Recalcular e salvar"; `null` com o diálogo fechado. */
    aConfirmar,
    salvar(campos: CamposLancamento) {
      if (Object.keys(campos).length === 0) navegar(destino);
      else void enviar(campos, false);
    },
    confirmarDescarte() {
      const campos = aConfirmar;
      setAConfirmar(null);
      if (campos) void enviar(campos, true);
    },
    cancelarDescarte: () => setAConfirmar(null),
  };
}
