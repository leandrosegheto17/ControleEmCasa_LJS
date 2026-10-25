import type { Kysely } from 'kysely';
import type { DadosPorModelo, EnviadorDeEmail, ModeloEmail } from '../../infraestrutura/email';
import type { Versoes } from '../../infraestrutura/db/repositorios/aceites';
import type { DB } from '../../infraestrutura/db/tipos';
import type { ChaveHmac } from '../../infraestrutura/seguranca/hmac';
import { logar } from '../../log';

/** Dependências dos casos de uso de acesso. Sem Hono e sem `c.env` (SDD 2.2, camada `aplicacao`). */
export interface DepsAcesso {
  db: Kysely<DB>;
  agora: Date;
  chaveHmac: ChaveHmac;
  email: EnviadorDeEmail;
  urlPublica: string;
  versoes: Versoes;
  /** Conclui o trabalho fora do caminho da resposta (`ctx.waitUntil`): o envio de e-mail não pesa no tempo (G-19). */
  agendar: (trabalho: Promise<unknown>) => void;
}

/** Intervalo mínimo entre dois e-mails de link para o mesmo usuário e finalidade (TM-API-16). */
export const INTERVALO_REENVIO_MS = 2 * 60 * 1000;

/** Agenda o envio e registra só o modelo e o motivo da falha: nunca o destinatário nem o link (G-46). */
export function agendarEmail<M extends ModeloEmail>(
  deps: DepsAcesso,
  para: string,
  modelo: M,
  dados: DadosPorModelo[M],
): void {
  deps.agendar(
    deps.email.enviarEmail({ para, modelo, dados }).then(
      (r) => {
        if (!r.ok) logar('warn', 'email_falhou', { modelo, motivo: r.motivo, status: r.status ?? 0 });
      },
      (erro: unknown) => {
        logar('warn', 'email_falhou', { modelo, motivo: erro instanceof Error ? erro.name : 'desconhecido' });
      },
    ),
  );
}

/** Links do app sempre a partir de `URL_PUBLICA` (G-33), com o token no fragmento (G-18, D-07). */
export function linkComToken(urlPublica: string, caminho: string, token: string): string {
  return `${urlPublica}${caminho}#t=${token}`;
}
