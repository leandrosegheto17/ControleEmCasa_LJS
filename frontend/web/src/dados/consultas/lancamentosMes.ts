import type { SaidaLancamentosMes } from '@controle/contrato';
import { chamar } from '../transporte';

export type FiltrosLancamentos = {
  escopo?: 'individual' | 'conjunto';
  categoriaId?: string;
  formaId?: string;
  variavel?: true;
};

/** `GET /api/lancamentos?mes=AAAA-MM-01&...`. Só os filtros dados vão; total e quantidade vêm do servidor. */
export function buscarLancamentosMes({
  mes,
  escopo,
  categoriaId,
  formaId,
  variavel,
}: FiltrosLancamentos & { mes: string }): Promise<SaidaLancamentosMes> {
  const busca = new URLSearchParams({ mes: `${mes}-01` });
  if (escopo !== undefined) busca.set('escopo', escopo);
  if (categoriaId !== undefined) busca.set('categoria_id', categoriaId);
  if (formaId !== undefined) busca.set('forma_id', formaId);
  if (variavel !== undefined) busca.set('variavel', String(variavel));
  return chamar<SaidaLancamentosMes>('GET', `/api/lancamentos?${busca.toString()}`, undefined, {
    saida: 'LancamentosMes',
  });
}
