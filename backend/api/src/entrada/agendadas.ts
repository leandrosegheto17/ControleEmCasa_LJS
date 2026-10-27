import { rodarLimpeza } from '../aplicacao/agendadas/limpeza';
import { rodarAvisosDoCron, type EnviadorPush } from '../aplicacao/agendadas/push';
import { lerConfigPush } from '../config';
import type { Bindings } from '../env';
import { criarDb } from '../infraestrutura/db/cliente';
import { enviarPush } from '../infraestrutura/push';
import { relogioDoSistema, type Relogio } from '../infraestrutura/relogio';
import { logar } from '../log';
import { relatarErro } from '../observabilidade';

/**
 * Handler `scheduled` do Worker (SDD 8.6 e 11.1; `triggers.crons` do wrangler.jsonc):
 * - `0 * * * *`: avisos de push (fixas, lembrete diário);
 * - `30 6 * * *`: limpeza diária (03:30 de Brasília).
 * O trabalho vai em `ctx.waitUntil`; cada execução abre a própria conexão e a fecha no fim.
 */

export const CRON_PUSH = '0 * * * *';
export const CRON_LIMPEZA = '30 6 * * *';

export interface OpcoesAgendadas {
  relogio?: Relogio;
  /** Envio injetado (testes). */
  push?: EnviadorPush;
}

/** A tarefa de cada expressão do cron; expressão desconhecida não faz nada (e vai ao log). */
export function tarefaDoCron(cron: string): 'push' | 'limpeza' | null {
  if (cron === CRON_PUSH) return 'push';
  if (cron === CRON_LIMPEZA) return 'limpeza';
  return null;
}

export async function executarAgendada(cron: string, env: Bindings, opcoes: OpcoesAgendadas = {}): Promise<void> {
  const tarefa = tarefaDoCron(cron);
  if (!tarefa) {
    logar('warn', 'cron_desconhecido');
    return;
  }
  const agora = (opcoes.relogio ?? relogioDoSistema)();
  const db = criarDb(env.HYPERDRIVE.connectionString);
  try {
    if (tarefa === 'push') {
      const vapid = lerConfigPush(env as unknown as Record<string, unknown>);
      await rodarAvisosDoCron({ db, agora, vapid, enviar: opcoes.push ?? enviarPush });
    } else {
      await rodarLimpeza({ db, agora });
    }
  } catch (erro) {
    logar('error', 'cron_falhou', { tarefa, erro: erro instanceof Error ? erro.name : 'desconhecido' });
    relatarErro(env, erro);
  } finally {
    await db.destroy();
  }
}

export function criarScheduled(opcoes: OpcoesAgendadas = {}): ExportedHandlerScheduledHandler<Bindings> {
  return (controlador, env, ctx) => {
    ctx.waitUntil(executarAgendada(controlador.cron, env, opcoes));
  };
}
