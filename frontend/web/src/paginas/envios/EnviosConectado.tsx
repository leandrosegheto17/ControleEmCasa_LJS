import { useAviso } from '../../componentes/base/useAviso';
import { FolhaEnvios } from '../../componentes/envios/FolhaEnvios';
import { textoEnviado } from '../../componentes/envios/textoEnvio';
import type { AcoesFila } from '../../ganchos/useAcoesFila';
import { estaAguardandoLancamento } from '../../ganchos/useLancarDespesa';
import { useAvisoEnvio } from '../../ganchos/useAvisoEnvio';
import { useParametroDaFolha } from '../../ganchos/useParametroDaFolha';
import { usePendentes, type ItemFila } from '../../ganchos/usePendentes';

interface Props {
  acoes: AcoesFila;
  /** Abre a folha de lançamento preenchida com o item; roda no mesmo toque do "Corrigir". */
  aoCorrigir: (item: ItemFila) => void;
}

/** Folha de envios pendentes (`?envios=1`) sobre qualquer tela, e o aviso dos envios concluídos em segundo plano. */
export function EnviosConectado({ acoes, aoCorrigir }: Props) {
  const [parametro, definir] = useParametroDaFolha('envios');
  const { itens } = usePendentes();
  const { mostrar } = useAviso();
  useAvisoEnvio((resposta) => mostrar('sucesso', textoEnviado(resposta)), {
    ignorar: (item) => estaAguardandoLancamento(item.id),
  });

  function corrigir(item: ItemFila) {
    acoes.iniciarCorrecao(item.id);
    definir(null);
    aoCorrigir(item);
  }

  return (
    <FolhaEnvios
      aberta={parametro === '1'}
      itens={itens}
      enviando={acoes.enviando}
      aoFechar={() => definir(null)}
      aoTentarAgora={() => void acoes.tentarAgora()}
      aoCorrigir={corrigir}
      aoDescartar={(id) => void acoes.descartar(id)}
    />
  );
}
