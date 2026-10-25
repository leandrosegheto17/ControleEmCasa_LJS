import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import {
  ACEITE,
  appDeAcesso,
  assinaturaDaResposta,
  comoOwner,
  cronometrar,
  criarUsuariosConfirmados,
  emailAleatorio,
  mediana,
  MINUTO,
  obter,
  postar,
  relogioControlado,
  SENHA_BOA,
  sha256,
} from './testes-suporte-acesso';

/**
 * Cadastro, confirmação e reenvio (RN-19; CA-19.1 a CA-19.4; G-18, G-19, G-48; TM-API-07, TM-API-16; SDD 8.1).
 * Postgres real como `controle_app`; relógio injetado; e-mail numa caixa em memória.
 */
const cadastro = (email: string, extra: Record<string, unknown> = {}) => ({
  nome: 'Ana Souza',
  email,
  senha: SENHA_BOA,
  aceite: ACEITE,
  ...extra,
});

async function linhasDoUsuario(email: string) {
  return comoOwner(async (db) => {
    const u = await sql<{ id: string; senha_hash: string; email_confirmado_em: Date | null; email: string }>`
      select id, senha_hash, email_confirmado_em, email::text as email from app.usuario where email = ${email}`.execute(
      db,
    );
    const usuario = u.rows[0];
    if (!usuario) return { usuario: null, aceites: [], tokens: [] };
    const a = await sql<{ versao_termos: string; versao_privacidade: string }>`
      select versao_termos, versao_privacidade from app.aceite_termos where usuario_id = ${usuario.id}`.execute(db);
    const t = await sql<{
      finalidade: string;
      token_hash: Uint8Array;
      usado_em: Date | null;
      expira_em: Date;
      criado_em: Date;
    }>`
      select finalidade, token_hash, usado_em, expira_em, criado_em from app.token_email
       where usuario_id = ${usuario.id} order by criado_em`.execute(db);
    return { usuario, aceites: a.rows, tokens: t.rows };
  });
}

describe.skipIf(!bancoDisponivel)('cadastro (RN-19)', () => {
  it('CA-19.1: cria o usuário não confirmado, grava o aceite com as versões e envia o e-mail de confirmação', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    const r = await postar(app, '/api/cadastro', cadastro(email));
    expect(r.status).toBe(202);
    expect(await r.text()).toBe('');

    const { usuario, aceites, tokens } = await linhasDoUsuario(email);
    expect(usuario).not.toBeNull();
    expect(usuario?.email_confirmado_em).toBeNull();
    expect(aceites).toEqual([{ versao_termos: ACEITE.termos, versao_privacidade: ACEITE.privacidade }]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.finalidade).toBe('confirmacao');

    await vi.waitFor(() => expect(caixa.para(email)).toHaveLength(1));
    const msg = caixa.para(email)[0];
    expect(msg?.texto).toContain('https://teste.exemplo.local/confirmar#t=');
  });

  it('hash em repouso: senha só como bcrypt de custo 12; token só como SHA-256 de 32 bytes (G-17, G-18)', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', cadastro(email));
    const token = caixa.ultimoToken(email);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 256 bits em base64url

    const { usuario, tokens } = await linhasDoUsuario(email);
    expect(usuario?.senha_hash).toMatch(/^\$2a\$12\$/);
    expect(usuario?.senha_hash).not.toContain(SENHA_BOA);
    const guardado = tokens[0]?.token_hash;
    expect(guardado?.byteLength).toBe(32);
    expect([...(guardado ?? [])]).toEqual([...(await sha256(token))]);
    expect(new TextDecoder().decode(guardado)).not.toContain(token);
  });

  it('o token do link vale 30 min a partir da emissão', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', cadastro(email));
    const { tokens } = await linhasDoUsuario(email);
    const t = tokens[0];
    expect(t && t.expira_em.getTime() - t.criado_em.getTime()).toBe(30 * MINUTO);
  });

  it('normaliza o e-mail: maiúsculas e espaços viram o mesmo usuário', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', cadastro(`  ${email.toUpperCase()} `));
    const { usuario } = await linhasDoUsuario(email);
    expect(usuario?.email).toBe(email);
  });

  it('CA-19.3: e-mail já cadastrado → resposta idêntica byte a byte, nenhuma conta nova, aviso "você já tem conta"', async () => {
    const { app, caixa } = appDeAcesso();
    const existente = emailAleatorio('existente');
    const novo = emailAleatorio('novo');
    await criarUsuariosConfirmados([existente]);

    const rExistente = await postar(app, '/api/cadastro', cadastro(existente.toUpperCase(), { nome: 'Outra Pessoa' }));
    const rNovo = await postar(app, '/api/cadastro', cadastro(novo));
    const a = await assinaturaDaResposta(rExistente);
    const b = await assinaturaDaResposta(rNovo);
    expect(a).toEqual(b);
    expect(a.status).toBe(202);

    const contagem = await comoOwner(async (db) => {
      const r = await sql<{ n: number }>`select count(*)::int as n from app.usuario where email = ${existente}`.execute(
        db,
      );
      return r.rows[0]?.n;
    });
    expect(contagem).toBe(1);
    await vi.waitFor(() => expect(caixa.para(existente)).toHaveLength(1));
    expect(caixa.para(existente)[0]?.assunto).toMatch(/já tem conta/);
    // o aviso não leva link com token: não confirma nem troca nada
    expect(caixa.para(existente)[0]?.texto).not.toContain('#t=');
  });

  it('CA-19.3: o tempo de resposta fica na mesma faixa para e-mail novo e existente (mediana de 6, tolerância de 120 ms)', async () => {
    // O custo dominante é o bcrypt de custo 12 (centenas de ms), que roda nos dois caminhos.
    // 120 ms é bem menor que um bcrypt e absorve o ruído do Docker local e do CI.
    const { app } = appDeAcesso();
    const N = 6;
    const existentes = Array.from({ length: N }, () => emailAleatorio('ja-existe'));
    await criarUsuariosConfirmados(existentes);
    const tempoNovo: number[] = [];
    const tempoExistente: number[] = [];
    for (let i = 0; i < N; i += 1) {
      tempoNovo.push(await cronometrar(() => postar(app, '/api/cadastro', cadastro(emailAleatorio('nova-conta')))));
      tempoExistente.push(await cronometrar(() => postar(app, '/api/cadastro', cadastro(existentes[i] ?? ''))));
    }
    expect(Math.abs(mediana(tempoNovo) - mediana(tempoExistente))).toBeLessThan(120);
  }, 60_000);

  it('dois cadastros simultâneos com o mesmo e-mail criam um único usuário, e as duas respostas são 202', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio('corrida');
    const [r1, r2] = await Promise.all([
      postar(app, '/api/cadastro', cadastro(email)),
      postar(app, '/api/cadastro', cadastro(email)),
    ]);
    expect([r1.status, r2.status]).toEqual([202, 202]);
    const n = await comoOwner(async (db) => {
      const r = await sql<{ n: number }>`select count(*)::int as n from app.usuario where email = ${email}`.execute(db);
      return r.rows[0]?.n;
    });
    expect(n).toBe(1);
  });

  it('CA-19.4: senha de 11 caracteres → 400 senha_fraca, e nada é criado', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    const r = await postar(app, '/api/cadastro', cadastro(email, { senha: 'a'.repeat(11) }));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: 'senha_fraca' });
    expect((await linhasDoUsuario(email)).usuario).toBeNull();
  });

  it('G-17: senha de 73 bytes → 400 senha_fraca', async () => {
    const { app } = appDeAcesso();
    const r = await postar(app, '/api/cadastro', cadastro(emailAleatorio(), { senha: 'a'.repeat(73) }));
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ code: 'senha_fraca' });
  });

  it('G-48: sem aceite, ou com versão que não é a vigente → 400 valor_invalido, e nada é criado', async () => {
    const { app } = appDeAcesso();
    const semAceite = emailAleatorio();
    const r1 = await postar(app, '/api/cadastro', { nome: 'Ana', email: semAceite, senha: SENHA_BOA });
    expect(r1.status).toBe(400);
    expect(await r1.json()).toMatchObject({ code: 'valor_invalido' });

    const versaoVelha = emailAleatorio();
    const r2 = await postar(
      app,
      '/api/cadastro',
      cadastro(versaoVelha, { aceite: { termos: '1999-01-01', privacidade: ACEITE.privacidade } }),
    );
    expect(r2.status).toBe(400);
    expect(await r2.json()).toMatchObject({ code: 'valor_invalido' });
    expect((await linhasDoUsuario(semAceite)).usuario).toBeNull();
    expect((await linhasDoUsuario(versaoVelha)).usuario).toBeNull();
  });

  it('o erro de validação não ecoa o valor recebido', async () => {
    const { app } = appDeAcesso();
    const r = await postar(app, '/api/cadastro', cadastro('nao-e-email-segredo'));
    const corpo = await r.text();
    expect(r.status).toBe(400);
    expect(corpo).not.toContain('nao-e-email-segredo');
  });
});

describe.skipIf(!bancoDisponivel)('confirmação por link (CA-19.2, G-18)', () => {
  it('dentro de 30 min, pela primeira vez: 204 e a conta fica confirmada; de novo: 400 link_expirado', async () => {
    const r = relogioControlado();
    const { app, caixa } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', cadastro(email));
    const token = caixa.ultimoToken(email);

    r.avancar(29 * MINUTO + 59 * 1000);
    const primeira = await postar(app, '/api/cadastro/confirmar', { token });
    expect(primeira.status).toBe(204);
    expect((await linhasDoUsuario(email)).usuario?.email_confirmado_em).not.toBeNull();

    const segunda = await postar(app, '/api/cadastro/confirmar', { token });
    expect(segunda.status).toBe(400);
    expect(await segunda.json()).toMatchObject({ code: 'link_expirado' });
  });

  it('depois de 30 min: 400 link_expirado e a conta continua não confirmada', async () => {
    const r = relogioControlado();
    const { app, caixa } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', cadastro(email));
    r.avancar(30 * MINUTO);
    const resp = await postar(app, '/api/cadastro/confirmar', { token: caixa.ultimoToken(email) });
    expect(resp.status).toBe(400);
    expect(await resp.json()).toMatchObject({ code: 'link_expirado' });
    expect((await linhasDoUsuario(email)).usuario?.email_confirmado_em).toBeNull();
  });

  it('token desconhecido ou malformado: a mesma resposta link_expirado', async () => {
    const { app } = appDeAcesso();
    const desconhecido = await postar(app, '/api/cadastro/confirmar', { token: 'A'.repeat(43) });
    const malformado = await postar(app, '/api/cadastro/confirmar', { token: 'curto' });
    expect(await assinaturaDaResposta(desconhecido)).toEqual(await assinaturaDaResposta(malformado));
    expect(desconhecido.status).toBe(400);
  });

  it('o token de recuperação não confirma cadastro (finalidade separada)', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email], SENHA_BOA, false);
    await postar(app, '/api/senha/esqueci', { email });
    await vi.waitFor(() => expect(caixa.para(email)).toHaveLength(1));
    const r = await postar(app, '/api/cadastro/confirmar', { token: caixa.ultimoToken(email) });
    expect(r.status).toBe(400);
    expect((await linhasDoUsuario(email)).usuario?.email_confirmado_em).toBeNull();
  });

  it('GET não consome o token (só POST): antivírus e pré-visualização não queimam o link', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', cadastro(email));
    const token = caixa.ultimoToken(email);
    const get = await obter(app, `/api/cadastro/confirmar?token=${token}`);
    expect(get.status).toBe(404);
    expect((await postar(app, '/api/cadastro/confirmar', { token })).status).toBe(204);
  });

  it('corrida: 2 POSTs simultâneos com o mesmo token, só 1 vence', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', cadastro(email));
    const token = caixa.ultimoToken(email);
    const resps = await Promise.all([
      postar(app, '/api/cadastro/confirmar', { token }),
      postar(app, '/api/cadastro/confirmar', { token }),
    ]);
    expect(resps.map((x) => x.status).sort()).toEqual([204, 400]);
  });
});

describe.skipIf(!bancoDisponivel)('reenvio da confirmação (RN-19, CA-21.5, TM-API-16)', () => {
  it('resposta neutra idêntica para e-mail inexistente, confirmado e não confirmado', async () => {
    const { app } = appDeAcesso();
    const confirmado = emailAleatorio();
    const pendente = emailAleatorio();
    await criarUsuariosConfirmados([confirmado]);
    await criarUsuariosConfirmados([pendente], SENHA_BOA, false);
    const respostas = await Promise.all(
      [emailAleatorio('inexistente'), confirmado, pendente].map(async (email) =>
        assinaturaDaResposta(await postar(app, '/api/cadastro/reenviar', { email })),
      ),
    );
    expect(respostas[0]?.status).toBe(202);
    expect(respostas[1]).toEqual(respostas[0]);
    expect(respostas[2]).toEqual(respostas[0]);
  });

  it('reenviar invalida o link anterior; no máximo 1 envio a cada 2 min por e-mail', async () => {
    const r = relogioControlado();
    const { app, caixa } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', cadastro(email));
    const primeiro = caixa.ultimoToken(email);

    r.avancar(MINUTO); // dentro do intervalo: não envia
    expect((await postar(app, '/api/cadastro/reenviar', { email })).status).toBe(202);
    expect(caixa.para(email)).toHaveLength(1);

    r.avancar(MINUTO + 1000); // passou de 2 min: envia um link novo
    expect((await postar(app, '/api/cadastro/reenviar', { email })).status).toBe(202);
    await vi.waitFor(() => expect(caixa.para(email)).toHaveLength(2));
    const segundo = caixa.ultimoToken(email);
    expect(segundo).not.toBe(primeiro);

    expect((await postar(app, '/api/cadastro/confirmar', { token: primeiro })).status).toBe(400);
    expect((await postar(app, '/api/cadastro/confirmar', { token: segundo })).status).toBe(204);
  });

  it('conta já confirmada não recebe e-mail no reenvio', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    await postar(app, '/api/cadastro/reenviar', { email });
    expect(caixa.para(email)).toHaveLength(0);
  });
});
