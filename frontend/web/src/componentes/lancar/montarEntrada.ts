import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import type { EntradaFolha } from '../../comum/envio';
import type { EstadoFormulario } from './useFormularioLancar';

/** Junta o que a tela escolheu com os nomes de exibição; `undefined` se a categoria, forma ou conta não existe mais. */
export function montarEntrada(dados: DadosLancamento, estado: EstadoFormulario): EntradaFolha | undefined {
  const { valorCentavos, categoriaId, data, descricao } = estado;
  if (estado.tipo === 'receita') {
    const categoria = dados.categorias_receita.find((c) => c.id === categoriaId);
    const conta = dados.contas.find((c) => c.id === estado.contaId);
    if (!categoria || !conta) return undefined;
    return { tipo: 'receita', valorCentavos, categoriaId: categoria.id, contaId: conta.id, data, descricao };
  }
  const categoria = dados.categorias_despesa.find((c) => c.id === categoriaId);
  const forma = dados.formas.find((f) => f.id === estado.formaId);
  if (!categoria || !forma) return undefined;
  return {
    tipo: 'despesa',
    valorCentavos,
    categoriaId: categoria.id,
    formaId: forma.id,
    parcelas: estado.parcelas,
    data,
    descricao,
    exibicao: { categoria_nome: categoria.nome, forma_nome: forma.nome, escopo: categoria.escopo },
  };
}
