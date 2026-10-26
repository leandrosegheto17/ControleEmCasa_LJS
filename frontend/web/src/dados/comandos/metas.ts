import type { EntradaMovimentarMeta, EntradaSalvarMeta, SaidaIdSalvo } from '@controle/contrato';
import type { Escopo, TipoMovimentoMeta } from '../../comum/enums';
import { ehUuid } from '../../comum/uuid';
import { REGISTRO_INVALIDO } from '../consultas/cadastro';
import { chamar } from '../transporte';

export interface DadosSalvarMeta {
  /** Gerado no cliente e mantido em todas as tentativas: reenviar não cria duas metas (ADR-010). */
  id: string;
  nome: string;
  alvoCentavos: number;
  /** `AAAA-MM`; ausente ou nulo, sem prazo. */
  prazo?: string | null;
  /** Só na criação (RN-08): na edição o servidor recusa um escopo diferente. */
  escopo?: Escopo;
}

/** `PUT /api/metas/:id` (201 ou 200, `{ id }`). O prazo sai como o dia 1 do mês, que é como o contrato o recebe. */
export function salvarMeta(d: DadosSalvarMeta): Promise<SaidaIdSalvo> {
  if (!ehUuid(d.id)) return Promise.reject(REGISTRO_INVALIDO);
  const corpo: EntradaSalvarMeta = {
    nome: d.nome,
    alvo_centavos: d.alvoCentavos,
    ...(d.prazo && { prazo: `${d.prazo}-01` }),
    ...(d.escopo !== undefined && { escopo: d.escopo }),
  };
  return chamar<SaidaIdSalvo>('PUT', `/api/metas/${d.id}`, corpo, { saida: 'IdSalvo' });
}

export interface DadosMovimentarMeta {
  /** Id do movimento, uma vez por folha: repetir o envio com ele não duplica o aporte (ADR-010). */
  id: string;
  metaId: string;
  tipo: TipoMovimentoMeta;
  valorCentavos: number;
  data: string;
  local: string;
  /** Sem conta, a chave não é enviada. */
  contaId?: string;
}

/** `POST /api/metas/:id/movimentos` (201, `{ id }`) ou 422 `retirada_maior_que_guardado`. */
export function movimentarMeta(d: DadosMovimentarMeta): Promise<SaidaIdSalvo> {
  if (!ehUuid(d.metaId)) return Promise.reject(REGISTRO_INVALIDO);
  const corpo: EntradaMovimentarMeta = {
    id: d.id,
    tipo: d.tipo,
    valor_centavos: d.valorCentavos,
    local: d.local,
    data: d.data,
    ...(d.contaId !== undefined && { conta_id: d.contaId }),
  };
  return chamar<SaidaIdSalvo>('POST', `/api/metas/${d.metaId}/movimentos`, corpo, { saida: 'IdSalvo' });
}
