import type { EstadoAssinatura, FatoCobranca } from '@controle/dominio';
import { ErroApi } from '../../erros';
import type { ClienteAsaas, CobrancaAsaas } from '../../infraestrutura/asaas';
import type { LinhaAssinatura } from '../../infraestrutura/db/repositorios/assinaturas';
import type { EnviadorDeEmail } from '../../infraestrutura/email';
import type { DepsLar } from '../lar/comum';

/** Dependências do plano (RN-24): as do lar, mais o cliente do Asaas e o e-mail. Sem Hono e sem `c.env`. */
export interface DepsPlano extends DepsLar {
  asaas: ClienteAsaas;
}

export interface DepsAvisos {
  email: EnviadorDeEmail;
  urlPublica: string;
  agendar: (trabalho: Promise<unknown>) => void;
}

/** A tela Meu plano (SDD 9.4 `/app/ajustes/plano`): destino dos links dos e-mails de cobrança (G-33). */
export const CAMINHO_MEU_PLANO = '/app/ajustes/plano';

export const erroAssinaturaAtiva = () => new ErroApi(409, 'assinatura_ativa', 'O lar já tem uma assinatura ativa.');
export const erroSemAssinatura = () => new ErroApi(409, 'sem_assinatura', 'O lar não tem assinatura para cancelar.');
export const erroPlanoNecessario = () =>
  new ErroApi(
    403,
    'plano_necessario',
    'Orçamento e metas ficam somente leitura no plano Free. Assine o Pro para editar.',
  );

/** Situação do Asaas → situação da cobrança no domínio. */
export function situacaoDaCobranca(status: string): FatoCobranca['situacao'] {
  switch (status) {
    case 'PENDING':
      return 'pendente';
    case 'OVERDUE':
      return 'vencida';
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return 'paga';
    default:
      return 'outra';
  }
}

export function fatoDe(c: CobrancaAsaas): FatoCobranca {
  return { id: c.id, vencimento: c.vencimento, valorCentavos: c.valorCentavos, situacao: situacaoDaCobranca(c.status) };
}

/** A cobrança em aberto (pendente ou vencida) mais antiga da lista, fora a indicada. */
export function maisAntigaEmAberto(cobrancas: CobrancaAsaas[], exceto?: string): CobrancaAsaas | null {
  const abertas = cobrancas
    .filter((c) => c.id !== exceto)
    .filter((c) => {
      const s = situacaoDaCobranca(c.status);
      return s === 'pendente' || s === 'vencida';
    })
    .sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0));
  return abertas[0] ?? null;
}

export function estadoDe(l: LinhaAssinatura): EstadoAssinatura {
  return {
    situacao: l.situacao,
    trialAte: l.trialAte,
    periodoAte: l.periodoAte,
    cobrancaId: l.cobrancaId,
    cobrancaVencimento: l.cobrancaVencimento,
    cobrancaValorCentavos: l.cobrancaValorCentavos,
    cobrancaSituacao: l.cobrancaSituacao,
    ultimoEventoEm: l.ultimoEventoEm,
  };
}

export function comEstado(l: LinhaAssinatura, e: EstadoAssinatura): LinhaAssinatura {
  return { ...l, ...e };
}
