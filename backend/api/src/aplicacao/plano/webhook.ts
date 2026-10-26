import { PRECO_PRO_CENTAVOS } from '@controle/contrato';
import { aplicarEvento, CARENCIA_ATRASO_DIAS, type EfeitoPlano, type FatoCobranca } from '@controle/dominio';
import type { Kysely } from 'kysely';
import type { ClienteAsaas, CobrancaAsaas, EventoAsaas } from '../../infraestrutura/asaas';
import {
  buscarPorAssinaturaAsaas,
  eventoRegistrado,
  gravarAssinatura,
  registrarEvento,
  titularDoLarAtual,
} from '../../infraestrutura/db/repositorios/assinaturas';
import { emTransacaoDeSistema, enxergarLarNoSistema } from '../../infraestrutura/db/transacao';
import type { DB } from '../../infraestrutura/db/tipos';
import { logar } from '../../log';
import { CAMINHO_MEU_PLANO, comEstado, estadoDe, fatoDe, maisAntigaEmAberto, type DepsAvisos } from './comum';

/**
 * Webhook do Asaas (RN-24; SDD 8.5; G-28, G-29; TM-ASA-02). Decisão do usuário (etapa 13): o EVENTO É GATILHO.
 * - idempotente pelo id do evento (`webhook_evento`): repetido → nada muda (inclusive em corrida);
 * - ordenado por `dateCreated`: evento mais velho que o último aplicado é ignorado;
 * - para eventos de cobrança, a situação vem da CONSULTA ao Asaas (`GET /payments/{id}`), não do nome do evento; o
 *   valor (preço vigente), a assinatura e o cliente são conferidos contra a assinatura local (G-29);
 * - o estado nunca regride (regras em `dominio/plano.ts`);
 * - assinatura desconhecida → 200 e ignora.
 * A consulta ao Asaas vem ANTES da transação (nada de chamada externa segurando trava). Se o Asaas cair, o erro sobe
 * (503) e nada é gravado: o Asaas reenvia o evento depois.
 */

export type ResultadoWebhook = 'repetido' | 'ignorado' | 'aplicado';

export interface DepsWebhook extends DepsAvisos {
  db: Kysely<DB>;
  asaas: ClienteAsaas;
  agora: Date;
}

interface Aviso {
  efeito: EfeitoPlano;
  para: string;
  nome: string;
  fato: FatoCobranca | null;
}

export async function processarWebhook(deps: DepsWebhook, evento: EventoAsaas): Promise<ResultadoWebhook> {
  if (await emTransacaoDeSistema(deps.db, 'webhook', (tx) => eventoRegistrado(tx, evento.id))) return 'repetido';

  // Gatilho: o estado atual da cobrança, consultado no Asaas.
  let cobranca: CobrancaAsaas | null = null;
  let proxima: CobrancaAsaas | null = null;
  if (evento.cobrancaId) {
    cobranca = await deps.asaas.buscarCobranca(evento.cobrancaId);
    if (cobranca && fatoDe(cobranca).situacao === 'paga' && cobranca.assinaturaId) {
      proxima = maisAntigaEmAberto(await deps.asaas.listarCobrancasDaAssinatura(cobranca.assinaturaId), cobranca.id);
    }
  }
  const fato = cobranca ? fatoDe(cobranca) : null;
  const asaasAssinaturaId = cobranca ? cobranca.assinaturaId : evento.assinaturaId;

  const r = await emTransacaoDeSistema(deps.db, 'webhook', async (tx) => {
    const linha = asaasAssinaturaId ? await buscarPorAssinaturaAsaas(tx, asaasAssinaturaId) : null;
    let motivo: string;
    let decisao: ReturnType<typeof aplicarEvento> | null = null;
    if (!linha) motivo = 'assinatura_desconhecida';
    else if (evento.cobrancaId && !cobranca) motivo = 'cobranca_desconhecida';
    else if (cobranca && cobranca.clienteId && linha.asaasClienteId && cobranca.clienteId !== linha.asaasClienteId) {
      motivo = 'cliente_divergente';
    } else {
      decisao = aplicarEvento(
        estadoDe(linha),
        {
          tipo: evento.tipo,
          ocorridoEm: evento.ocorridoEm,
          ...(fato ? { cobranca: fato } : {}),
          ...(proxima ? { proximaAberta: fatoDe(proxima) } : {}),
        },
        PRECO_PRO_CENTAVOS,
      );
      motivo = decisao.tipo === 'aplicado' ? 'aplicado' : decisao.motivo;
    }

    const novo = await registrarEvento(tx, {
      eventId: evento.id,
      tipo: evento.tipo,
      asaasAssinaturaId,
      ocorridoEm: evento.ocorridoEm,
      agora: deps.agora,
      resumo: {
        resultado: motivo,
        cobranca_id: fato?.id ?? null,
        situacao_cobranca: fato?.situacao ?? null,
        valor_centavos: fato?.valorCentavos ?? null,
        vencimento: fato?.vencimento ?? null,
      },
    });
    if (!novo) return { resultado: 'repetido' as const, avisos: [] as Aviso[] };
    if (!linha || !decisao || decisao.tipo !== 'aplicado') {
      if (motivo !== 'sem_efeito') logar('info', 'webhook_ignorado', { tipo: evento.tipo, motivo });
      return { resultado: 'ignorado' as const, avisos: [] as Aviso[] };
    }

    await gravarAssinatura(tx, comEstado(linha, decisao.estado), deps.agora);
    const avisos: Aviso[] = [];
    if (decisao.efeitos.length > 0) {
      await enxergarLarNoSistema(tx, linha.larId);
      const titular = await titularDoLarAtual(tx);
      if (titular) {
        for (const efeito of decisao.efeitos) avisos.push({ efeito, para: titular.email, nome: titular.nome, fato });
      }
    }
    return { resultado: 'aplicado' as const, avisos };
  });

  for (const aviso of r.avisos) avisar(deps, aviso);
  return r.resultado;
}

/** E-mails de cobrança gerada, pagamento confirmado e atraso (RN-24), depois do COMMIT e fora do caminho da resposta. */
function avisar(deps: DepsAvisos, aviso: Aviso): void {
  const link = `${deps.urlPublica}${CAMINHO_MEU_PLANO}`;
  const { fato } = aviso;
  if (aviso.efeito === 'cobranca_gerada' && fato) {
    deps.agendar(
      deps.email.enviarEmail({
        para: aviso.para,
        modelo: 'cobranca_gerada',
        dados: { nome: aviso.nome, valorCentavos: fato.valorCentavos, vencimento: fato.vencimento, link },
      }),
    );
  } else if (aviso.efeito === 'pagamento_confirmado' && fato) {
    deps.agendar(
      deps.email.enviarEmail({
        para: aviso.para,
        modelo: 'pagamento_confirmado',
        dados: { nome: aviso.nome, valorCentavos: fato.valorCentavos, link },
      }),
    );
  } else if (aviso.efeito === 'atraso' && fato) {
    deps.agendar(
      deps.email.enviarEmail({
        para: aviso.para,
        modelo: 'atraso',
        dados: { nome: aviso.nome, vencimento: fato.vencimento, diasCarencia: CARENCIA_ATRASO_DIAS, link },
      }),
    );
  }
}
