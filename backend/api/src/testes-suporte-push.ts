import { sql } from 'kysely';
import { inject } from 'vitest';
import type { EnviadorPush } from './aplicacao/agendadas/push';
import { criarDb } from './infraestrutura/db/cliente';
import type { AssinaturaPush, CargaPush, OpcoesEnvio, ResultadoPush } from './infraestrutura/push';
import { linhasComoOwner, pedir, type Pessoa } from './testes-suporte-lar';
import type { App } from './testes-suporte-cadastros';

/** Utilitários dos testes de push (etapa 15). Só para testes: fora da varredura de código de produção. */

function aleatorio64(n: number): string {
  let s = '';
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (const b of crypto.getRandomValues(new Uint8Array(n))) s += alfabeto[b % 64];
  return s;
}

/** Inscrição com a cara da do navegador (as chaves não precisam ser um ponto válido: o envio é falso). */
export function navegador(host = 'fcm.googleapis.com') {
  return {
    endpoint: `https://${host}/fcm/send/${aleatorio64(40)}`,
    keys: { p256dh: `B${aleatorio64(86)}`, auth: aleatorio64(22) },
  };
}
export type Navegador = ReturnType<typeof navegador>;

export function inscrever(app: App, quem: Pessoa, corpo: unknown): Promise<Response> {
  return pedir(app, 'POST', '/api/push/assinaturas', quem, corpo);
}

export async function inscreverOk(app: App, quem: Pessoa, nav: Navegador = navegador()): Promise<Navegador> {
  const r = await inscrever(app, quem, nav);
  if (r.status !== 204) throw new Error(`inscrever falhou: ${r.status} ${await r.text()}`);
  return nav;
}

export interface InscricaoNoBanco {
  endpoint: string;
  usuario_id: string;
  membro_id: string;
  lar_id: string;
  p256dh: string;
  auth: string;
  falhas: number;
}

/** Inscrições como o owner as vê (inspeção, fora da RLS). */
export async function inscricoesNoBanco(filtro: { usuario?: string; endpoints?: string[] }) {
  return linhasComoOwner(sql<InscricaoNoBanco>`
    select endpoint, usuario_id::text as usuario_id, membro_id::text as membro_id, lar_id::text as lar_id, p256dh, auth,
           falhas::int as falhas
      from app.push_subscription
     where (${filtro.usuario ?? null}::uuid is null or usuario_id = ${filtro.usuario ?? null}::uuid)
       and (${filtro.endpoints ?? null}::text[] is null or endpoint = any(${filtro.endpoints ?? null}::text[]))
     order by criado_em, endpoint`);
}

export interface EnvioVisto {
  endpoint: string;
  carga: CargaPush;
  opcoes: OpcoesEnvio | undefined;
}

/**
 * Envio falso: registra cada chamada e responde pelo endpoint (padrão `ok`). Endpoints que o teste não conhece
 * (inscrições de outros arquivos de teste no banco compartilhado) recebem `ok` e não entram na lista.
 */
export function enviadorFalso(conhecidos?: () => Set<string>) {
  const envios: EnvioVisto[] = [];
  const respostas = new Map<string, ResultadoPush | 'lancar'>();
  const enviar: EnviadorPush = async (assinatura: AssinaturaPush, carga, _vapid, opcoes) => {
    const meus = conhecidos?.();
    if (meus && !meus.has(assinatura.endpoint)) return 'ok';
    envios.push({ endpoint: assinatura.endpoint, carga, opcoes });
    const r = respostas.get(assinatura.endpoint) ?? 'ok';
    if (r === 'lancar') throw new TypeError('rede');
    return r;
  };
  return {
    enviar,
    envios,
    responder(endpoint: string, r: ResultadoPush | 'lancar') {
      respostas.set(endpoint, r);
    },
    para: (endpoint: string) => envios.filter((e) => e.endpoint === endpoint),
    limpar() {
      envios.length = 0;
    },
  };
}

/** Conexão `controle_app` própria (como o Worker abre no cron). */
export function dbDoApp() {
  return criarDb(inject('urlBancoApp'));
}
