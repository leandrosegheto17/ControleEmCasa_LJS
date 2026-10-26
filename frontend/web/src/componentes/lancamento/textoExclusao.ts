import { formatarMoeda } from '../../formatacao/moeda';

interface Entrada {
  descricao: string | null;
  categoria: string;
  valorTotalCentavos: number;
  numParcelas: number;
  escopo: 'conjunto' | 'individual';
  tipo: 'despesa' | 'receita';
}

/** Título e texto do diálogo de exclusão, só a partir do que a resposta do lançamento traz. */
export function textoExclusao(e: Entrada): { titulo: string; texto: string } {
  const parcelado = e.numParcelas > 1;
  const titulo =
    e.tipo === 'receita'
      ? 'Excluir esta receita?'
      : parcelado
        ? `Excluir esta compra e as ${e.numParcelas} parcelas?`
        : 'Excluir esta compra?';
  const resumo = `${e.descricao ?? e.categoria}, ${formatarMoeda(e.valorTotalCentavos)}${parcelado ? ` em ${e.numParcelas}x` : ''}.`;
  const alcance =
    e.escopo === 'conjunto'
      ? 'A exclusão vale para os dois e não pode ser desfeita.'
      : 'A exclusão não pode ser desfeita.';
  return { titulo, texto: `${resumo} ${alcance}` };
}
