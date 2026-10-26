/**
 * Título da linha do lançamento: a descrição (ou o nome da categoria, se não houver) e,
 * em compra parcelada, "(k/N)". Lançamento à vista (N = 1) não leva sufixo.
 */
export function formatarTituloLancamento(
  descricao: string | null,
  categoriaNome: string,
  parcelaNumero: number,
  totalParcelas: number,
): string {
  const base = descricao?.trim() || categoriaNome;
  return totalParcelas > 1 ? `${base} (${parcelaNumero}/${totalParcelas})` : base;
}
