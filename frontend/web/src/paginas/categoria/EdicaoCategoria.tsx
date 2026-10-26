import type { SaidaLinhaCategorias as LinhaCategorias } from '@controle/contrato';
import { AcoesEdicao } from '../../componentes/AcoesEdicao';
import { AvisoErroTopo } from '../../componentes/base/AvisoErroTopo';
import { FormularioCategoria } from '../../componentes/FormularioCategoria';
import { useAcoesCategoria } from './useAcoesCategoria';

const TEXTO_EM_USO =
  'Esta categoria tem lançamentos, orçamentos ou despesas fixas ligados a ela. Arquive para tirá-la das opções; o histórico continua.';

export function EdicaoCategoria({ categoria }: { categoria: LinhaCategorias }) {
  const acoes = useAcoesCategoria(categoria.id, categoria.tipo);

  return (
    <>
      {acoes.emUso ? <AvisoErroTopo>{TEXTO_EM_USO}</AvisoErroTopo> : null}
      <FormularioCategoria
        inicial={{
          nome: categoria.nome,
          tipo: categoria.tipo,
          escopo: categoria.escopo,
          variavel: categoria.variavel ?? false,
        }}
        tipoEscopoFixos
        erroNome={acoes.erroNome}
        aoSalvar={acoes.salvar}
      >
        <AcoesEdicao
          acoes={acoes}
          podeExcluir={categoria.pode_excluir}
          rotuloArquivarEmUso="Arquivar categoria"
          tituloExclusao="Excluir esta categoria?"
          textoExclusao="A categoria será excluída de vez e não dá para desfazer."
        />
      </FormularioCategoria>
    </>
  );
}
