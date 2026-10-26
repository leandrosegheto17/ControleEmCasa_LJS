import type { SaidaLinhaCategorias as LinhaCategorias } from '@controle/contrato';

export interface OpcaoCategoria {
  valor: string;
  rotulo: string;
}

/**
 * Categorias que uma despesa fixa aceita: despesa da casa e ativa, na ordem da API. A categoria que o modelo já
 * usa entra mesmo se foi arquivada depois, para salvar sem trocá-la em silêncio. O servidor revalida tudo.
 */
export function opcoesCategoriaFixa(
  categorias: readonly LinhaCategorias[],
  atual?: { id: string; nome: string },
): OpcaoCategoria[] {
  const opcoes = categorias
    .filter((c) => c.tipo === 'despesa' && c.escopo === 'conjunto' && !c.arquivada)
    .map((c) => ({ valor: c.id, rotulo: c.nome }));
  if (atual && !opcoes.some((o) => o.valor === atual.id)) opcoes.push({ valor: atual.id, rotulo: atual.nome });
  return opcoes;
}
