import type { SaidaMeuPlano } from '@controle/contrato';
import { formatarData, hojeEmSaoPaulo } from './data';

/** Situação do plano em palavras e datas da tela Meu plano (RN-24; CA-24.1; CA-24.8). */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Instante ISO em dd/mm/aaaa, no dia de São Paulo. */
export const dataDoInstante = (iso: string) => formatarData(hojeEmSaoPaulo(new Date(iso)));

/** Dias que faltam até o instante (arredondado para cima; 0 quando já passou). */
export function diasAte(iso: string, agora: Date): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - agora.getTime()) / DIA_MS));
}

/** Situação do lar em palavras: trial com dias restantes, ativa, atrasada, cancelada com "Pro até" ou free. */
export function descreverSituacao(plano: SaidaMeuPlano, agora: Date): string {
  const periodoVale = plano.periodo_ate !== null && new Date(plano.periodo_ate).getTime() > agora.getTime();
  switch (plano.situacao) {
    case 'trial': {
      const dias = diasAte(plano.trial_ate, agora);
      if (dias === 0) return 'Período de teste encerrado';
      return `Período de teste: ${dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`}`;
    }
    case 'ativa':
      return plano.periodo_ate ? `Ativa, paga até ${dataDoInstante(plano.periodo_ate)}` : 'Ativa';
    case 'atrasada':
      return 'Pagamento atrasado';
    case 'cancelada':
      return periodoVale && plano.periodo_ate
        ? `Cancelada. Pro até ${dataDoInstante(plano.periodo_ate)}`
        : 'Cancelada. A casa está no plano Free';
    default:
      return 'Plano Free';
  }
}
