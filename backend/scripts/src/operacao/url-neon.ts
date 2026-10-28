/**
 * Validação única da URL de conexão com o Neon (padrão do Neon, ADR-017, decisão 4). Todo caminho que toca o Neon passa
 * por aqui antes de conectar: a migração (`migrar-neon`, também no deploy), o backup e o dump do deploy
 * (`dump-cifrado`), a purga (`purgar`), a conferência (`conferir-banco`) e a restauração (`conferir-url-neon`, runbook
 * 4.2). Recusa:
 *
 * - texto que não é URL `postgres:`/`postgresql:`;
 * - destino local (`localhost`, `127.0.0.1`, `::1`, ou a porta 55432 do Docker local);
 * - host fora de `.neon.tech`;
 * - host com `-pooler` (o PgBouncer em transaction mode quebra o `set_config(..., true)` e as migrations);
 * - URL sem TLS (`sslmode` tem de ser `require` ou `verify-full`);
 * - URL sem nome de banco.
 *
 * Função pura: não conecta, não lê ambiente e nunca devolve a senha nem a URL nas mensagens.
 */

export type DestinoNeon = { ok: true; usuario: string; host: string; banco: string } | { ok: false; motivo: string };

const HOSTS_LOCAIS = ['localhost', '127.0.0.1', '::1'];
const PORTA_DOCKER_LOCAL = '55432';
const SSL_ACEITOS = ['require', 'verify-full'];

export function validarUrlNeon(url: string, variavel: string): DestinoNeon {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, motivo: `${variavel} não é uma URL válida.` };
  }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') {
    return { ok: false, motivo: `${variavel} não é uma URL postgres.` };
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (HOSTS_LOCAIS.includes(host) || u.port === PORTA_DOCKER_LOCAL) {
    return {
      ok: false,
      motivo: `${variavel}: destino local recusado. Este caminho é só para o Neon (o banco local usa DATABASE_URL_*).`,
    };
  }
  if (!host.endsWith('.neon.tech')) {
    return { ok: false, motivo: `${variavel}: host fora de .neon.tech recusado.` };
  }
  if (host.includes('-pooler')) {
    return { ok: false, motivo: `${variavel}: host com -pooler recusado. Use a string direta (sem pooler).` };
  }
  const ssl = u.searchParams.get('sslmode');
  if (!ssl || !SSL_ACEITOS.includes(ssl)) {
    return { ok: false, motivo: `${variavel}: URL sem sslmode=require (ou verify-full) recusada.` };
  }
  const banco = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!banco) return { ok: false, motivo: `${variavel}: URL sem nome de banco.` };
  return { ok: true, usuario: decodeURIComponent(u.username), host, banco };
}

/**
 * Linha de comando (`pnpm --filter @controle/scripts conferir-url-neon <VARIAVEL>`): valida a variável de ambiente
 * cujo NOME vem em argv (a URL nunca vai em argv). Usado no runbook antes do `pg_restore` no Neon. Imprime só usuário,
 * host e banco; sai com 1 se a variável falta ou é recusada.
 */
export function main(
  argv: string[],
  ambiente: NodeJS.ProcessEnv,
  saida: (t: string) => void = (t) => console.info(t),
  erro: (t: string) => void = (t) => console.error(t),
): number {
  const variavel = argv[0];
  if (!variavel || !/^NEON_URL_[A-Z0-9_]+$/.test(variavel)) {
    erro('Uso: conferir-url-neon NEON_URL_<NOME> (o nome da variável, nunca a URL).');
    return 1;
  }
  const url = ambiente[variavel];
  if (!url) {
    erro(`${variavel} ausente no ambiente do terminal.`);
    return 1;
  }
  const d = validarUrlNeon(url, variavel);
  if (!d.ok) {
    erro(d.motivo);
    return 1;
  }
  saida(`${variavel} aceita. Usuário: ${d.usuario}; host: ${d.host}; banco: ${d.banco}; senha: ********`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2), process.env);
}
