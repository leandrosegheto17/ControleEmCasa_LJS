import { formatarMes } from './mes';

/** "Início · Outubro de 2026 · Controle em Casa"; sem mês, "Ajustes · Controle em Casa". */
export function montarTitulo(nome: string, mes?: string | null): string {
  return mes ? `${nome} · ${formatarMes(mes)} · Controle em Casa` : `${nome} · Controle em Casa`;
}
