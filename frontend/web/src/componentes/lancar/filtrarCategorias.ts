const semAcento = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Filtra por trecho do nome, sem acento e sem caixa, mantendo a ordem recebida. */
export function filtrarCategorias<T extends { nome: string }>(lista: readonly T[], termo: string): T[] {
  const busca = semAcento(termo.trim());
  if (!busca) return [...lista];
  return lista.filter((c) => semAcento(c.nome).includes(busca));
}
