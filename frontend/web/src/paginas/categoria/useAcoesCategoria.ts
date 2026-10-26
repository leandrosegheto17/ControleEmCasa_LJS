import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { TipoLancamento } from '../../comum/enums';
import type { DadosCategoria } from '../../componentes/FormularioCategoria';
import { useAviso } from '../../componentes/base/useAviso';
import type { ErroDados } from '../../comum/erros';
import { ehEmUso } from '../../ganchos/useComandoCadastro';
import { useComandosCategoria } from '../../ganchos/useCategorias';
import { mensagemErro } from '../../rotulos/mensagensErro';

const LISTA = '/app/ajustes/categorias';

const NOME_REPETIDO = {
  conjunto: 'Já existe uma categoria da casa com esse nome.',
  individual: 'Já existe uma categoria sua com esse nome.',
} as const;

/** Salvar, arquivar e excluir uma categoria, com os avisos e a volta à lista do tipo. */
export function useAcoesCategoria(categoriaId: string, tipoAtual: TipoLancamento) {
  const comandos = useComandosCategoria();
  const { mostrar } = useAviso();
  const navegar = useNavigate();
  const [emUso, setEmUso] = useState(false);
  const [erroNome, setErroNome] = useState<string>();

  const falhou = (erro: ErroDados) => mostrar('erro', mensagemErro(erro));
  const voltarComAviso = (mensagem: string, tipo: TipoLancamento = tipoAtual) => {
    mostrar('sucesso', mensagem);
    navegar(`${LISTA}?tipo=${tipo}`);
  };

  return {
    emUso,
    erroNome,
    cancelarEmUso: () => setEmUso(false),
    salvando: comandos.salvarCategoria.isPending,
    arquivando: comandos.arquivarCategoria.isPending,

    salvar(dados: DadosCategoria) {
      setErroNome(undefined);
      comandos.salvarCategoria.mutate(
        {
          id: categoriaId,
          nome: dados.nome,
          tipo: dados.tipo,
          escopo: dados.escopo,
          ...(dados.tipo === 'despesa' && { variavel: dados.variavel }),
        },
        {
          onSuccess: () => voltarComAviso('Categoria salva', dados.tipo),
          onError: (erro) =>
            erro.tipo === 'regra' && erro.codigo === 'nome_repetido'
              ? setErroNome(NOME_REPETIDO[dados.escopo])
              : falhou(erro),
        },
      );
    },

    arquivar() {
      comandos.arquivarCategoria.mutate(categoriaId, {
        onSuccess: () => voltarComAviso('Categoria arquivada'),
        onError: falhou,
      });
    },

    excluir() {
      comandos.excluirCategoria.mutate(categoriaId, {
        onSuccess: () => voltarComAviso('Categoria excluída'),
        onError: (erro) => (ehEmUso(erro) ? setEmUso(true) : falhou(erro)),
      });
    },
  };
}
