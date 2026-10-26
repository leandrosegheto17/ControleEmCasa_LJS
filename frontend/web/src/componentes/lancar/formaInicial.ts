import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';

/** A forma padrão é decidida no servidor (RN-19); sem padrão, a primeira da lista; sem formas, nenhuma. */
export function formaInicial(dados: DadosLancamento): string | null {
  return dados.forma_padrao_id ?? dados.formas[0]?.id ?? null;
}
