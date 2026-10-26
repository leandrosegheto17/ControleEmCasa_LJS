import { useNavigate } from 'react-router';
import { useAviso } from '../../componentes/base/useAviso';
import type { DadosMeta } from '../../componentes/metas/FormularioMeta';
import { linkMeta } from '../../formatacao/linksApp';
import { useComandosMetas } from '../../ganchos/useComandosMetas';
import { mensagemErro } from '../../rotulos/mensagensErro';

/** Salva a meta com o `id` recebido (o mesmo em todas as tentativas), avisa e abre o detalhe. */
export function useSalvarMeta(id: string) {
  const { salvarMeta } = useComandosMetas();
  const { mostrar } = useAviso();
  const navegar = useNavigate();

  return {
    salvando: salvarMeta.isPending,
    salvar(dados: DadosMeta) {
      salvarMeta.mutate(
        { id, ...dados },
        {
          onSuccess: () => {
            mostrar('sucesso', 'Meta salva');
            navegar(linkMeta(id), { replace: true });
          },
          onError: (erro) => mostrar('erro', mensagemErro(erro)),
        },
      );
    },
  };
}
