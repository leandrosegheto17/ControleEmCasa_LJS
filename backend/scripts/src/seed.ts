import pg from 'pg';

/**
 * Seed local (SDD 11.3). Etapa 2: só a identidade (4 usuários confirmados com aceite dos termos).
 * Os 2 lares, os membros e a massa de 2 anos entram nas etapas 6 a 9.
 * Roda como owner e só em banco local; é idempotente (pode rodar de novo).
 */
const SENHA_LOCAL = 'Senha-local-123';
const USUARIOS = [
  { email: 'ana@exemplo.local', nome: 'Ana (lar A)' },
  { email: 'bruno@exemplo.local', nome: 'Bruno (lar A)' },
  { email: 'carla@exemplo.local', nome: 'Carla (lar B)' },
  { email: 'diego@exemplo.local', nome: 'Diego (lar B)' },
];
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function hostEhLocal(url: string): boolean {
  return HOSTS_LOCAIS.has(new URL(url).hostname);
}

async function principal(): Promise<void> {
  const url = process.env['DATABASE_URL_OWNER'];
  if (!url) throw new Error('Defina DATABASE_URL_OWNER (veja .env.example).');
  if (!hostEhLocal(url)) throw new Error('O seed só roda em banco local.');

  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    await cliente.query('begin');
    for (const u of USUARIOS) {
      const r = await cliente.query<{ id: string }>(
        `insert into app.usuario (email, nome, senha_hash, email_confirmado_em)
         values ($1, $2, app.crypt($3, app.gen_salt('bf', 12)), now())
         on conflict (email) do nothing
         returning id`,
        [u.email, u.nome, SENHA_LOCAL],
      );
      const id = r.rows[0]?.id;
      if (id) {
        await cliente.query(
          `insert into app.aceite_termos (usuario_id, versao_termos, versao_privacidade)
           values ($1, 'seed', 'seed')`,
          [id],
        );
      }
    }
    await cliente.query('commit');
    console.log(`Seed aplicado: ${USUARIOS.length} usuários (senha local: ${SENHA_LOCAL}).`);
  } catch (erro) {
    await cliente.query('rollback');
    throw erro;
  } finally {
    await cliente.end();
  }
}

if (import.meta.main) {
  principal().catch((erro: unknown) => {
    console.error(erro instanceof Error ? erro.message : 'Erro no seed.');
    process.exit(1);
  });
}
