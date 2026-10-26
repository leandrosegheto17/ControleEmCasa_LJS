/**
 * Limpeza do aparelho ao sair ou ao perder a sessão (G-39). Cada módulo de `dados/` que guarda algo local
 * (cache em IndexedDB, assinatura de push) registra aqui a sua limpeza. A fila offline NÃO se registra: ela guarda
 * o dono em cada item e os itens de outro usuário ficam retidos até ele voltar (G-38).
 */
const limpezas = new Set<() => Promise<void> | void>();

export function registrarLimpeza(limpeza: () => Promise<void> | void): () => void {
  limpezas.add(limpeza);
  return () => limpezas.delete(limpeza);
}

/** Roda todas as limpezas; uma que falha não impede as outras. */
export async function limparAparelho(): Promise<void> {
  await Promise.allSettled([...limpezas].map(async (limpeza) => limpeza()));
}
