import { configVapidValida, gerarParVapid } from '../../api/src/infraestrutura/push';

/**
 * Gera um par VAPID novo (etapa 15; SDD 11.2; ADR-014) e SÓ IMPRIME no terminal, no formato do `.dev.vars`. Nada é
 * gravado em arquivo: copie para o `.dev.vars` local (ignorado pelo git) ou para `wrangler secret put` (produção).
 * A chave privada é segredo (G-32, TM-PUSH-03): nunca em commit, issue ou conversa.
 */
export async function linhasVapid(assunto = 'mailto:contato@seu-dominio'): Promise<string[]> {
  const par = await gerarParVapid();
  if (!configVapidValida({ ...par, assunto })) throw new Error('par_vapid_invalido');
  return [`VAPID_PUBLIC_KEY=${par.chavePublica}`, `VAPID_PRIVATE_KEY=${par.chavePrivada}`, `VAPID_SUBJECT=${assunto}`];
}

if (import.meta.main) {
  for (const linha of await linhasVapid(process.argv[2])) console.info(linha);
}
