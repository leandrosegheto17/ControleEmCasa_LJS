import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import {
  appDeAcesso,
  assinaturaDaResposta,
  comoOwner,
  cookieSid,
  cronometrar,
  criarUsuariosConfirmados,
  emailAleatorio,
  entrarComo,
  ipAleatorio,
  mediana,
  MINUTO,
  obter,
  postar,
  relogioControlado,
  SENHA_BOA,
  sha256,
  tokenDoCookie,
} from './testes-suporte-acesso';

/**
 * Entrar (RN-20, RN-21; CA-19.5, CA-20.1, CA-21.1 a CA-21.4; G-15, G-16, G-19, G-20; TM-API-07/08/11; SDD 8.2).
 */
const SENHA_ERRADA = 'senha-errada-000';
const tentar = (
  app: Parameters<typeof postar>[0],
  email: string,
  senha: string,
  ip?: string,
  cabecalhos?: Record<string, string>,
) => postar(app, '/api/sessao/entrar', { email, senha }, { ip, cabecalhos });

describe.skipIf(!bancoDisponivel)('entrar: sessão e cookie (G-15, CA-20.1)', () => {
  it('sucesso: 204, cookie __Host-sid com os atributos exatos e sem token no corpo', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const r = await tentar(app, email, SENHA_BOA);
    expect(r.status).toBe(204);
    expect(await r.text()).toBe('');
    const cookies = r.headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    const partes = (cookies[0] ?? '').split(';').map((p) => p.trim());
    expect(partes[0]).toMatch(/^__Host-sid=[A-Za-z0-9_-]{43}$/);
    expect(new Set(partes.slice(1).map((p) => p.toLowerCase()))).toEqual(
      new Set(['max-age=43200', 'path=/', 'httponly', 'secure', 'samesite=lax']),
    );
    expect(cookies[0]?.toLowerCase()).not.toContain('domain');
  });

  it('o banco guarda só o SHA-256 (32 bytes) do token, com expiração absoluta de 12 h', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const token = await entrarComo(app, email);
    const linhas = await comoOwner(async (db) => {
      const r = await sql<{ token_hash: Uint8Array; criada_em: Date; expira_absoluta_em: Date }>`
        select s.token_hash, s.criada_em, s.expira_absoluta_em from app.sessao s
          join app.usuario u on u.id = s.usuario_id where u.email = ${email}`.execute(db);
      return r.rows;
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.token_hash.byteLength).toBe(32);
    expect([...(linhas[0]?.token_hash ?? [])]).toEqual([...(await sha256(token))]);
    const l = linhas[0];
    expect(l && l.expira_absoluta_em.getTime() - l.criada_em.getTime()).toBe(12 * 60 * MINUTO);
  });

  it('CA-20.1 / TM-API-11: cada login cria um token novo e o cookie apresentado antes do login deixa de valer', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const anterior = await entrarComo(app, email);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(anterior) })).status).toBe(200);

    const r = await postar(app, '/api/sessao/entrar', { email, senha: SENHA_BOA }, { cookie: cookieSid(anterior) });
    const novo = tokenDoCookie(r);
    expect(r.status).toBe(204);
    expect(novo).not.toBeNull();
    expect(novo).not.toBe(anterior);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(anterior) })).status).toBe(401);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(novo ?? '') })).status).toBe(200);
  });

  it('fixação: um token plantado (que nunca foi sessão) não vira sessão depois do login', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const plantado = 'P'.repeat(43);
    const r = await postar(app, '/api/sessao/entrar', { email, senha: SENHA_BOA }, { cookie: cookieSid(plantado) });
    expect(tokenDoCookie(r)).not.toBe(plantado);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(plantado) })).status).toBe(401);
  });
});

describe.skipIf(!bancoDisponivel)('entrar: credenciais e anti-enumeração (CA-19.5, G-19)', () => {
  it('senha errada e e-mail inexistente: mesma resposta byte a byte (400 credenciais_invalidas)', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const errada = await assinaturaDaResposta(await tentar(app, email, SENHA_ERRADA));
    const inexistente = await assinaturaDaResposta(await tentar(app, emailAleatorio('ninguem'), SENHA_ERRADA));
    expect(errada.status).toBe(400);
    expect(JSON.parse(errada.corpo)).toMatchObject({ code: 'credenciais_invalidas' });
    expect(inexistente).toEqual(errada);
  });

  it('o tempo de senha errada e de e-mail inexistente fica na mesma faixa (mediana de 6, tolerância de 120 ms)', async () => {
    // Os dois caminhos rodam o mesmo bcrypt de custo 12 (o inexistente contra HASH_FIXO).
    // 120 ms fica bem abaixo do custo de um bcrypt e absorve o ruído local e do CI.
    const { app } = appDeAcesso();
    const N = 6;
    const existentes = Array.from({ length: N }, () => emailAleatorio('tempo'));
    await criarUsuariosConfirmados(existentes);
    const tExistente: number[] = [];
    const tInexistente: number[] = [];
    for (let i = 0; i < N; i += 1) {
      tExistente.push(await cronometrar(() => tentar(app, existentes[i] ?? '', SENHA_ERRADA, ipAleatorio())));
      tInexistente.push(await cronometrar(() => tentar(app, emailAleatorio('fantasma'), SENHA_ERRADA, ipAleatorio())));
    }
    expect(Math.abs(mediana(tExistente) - mediana(tInexistente))).toBeLessThan(120);
  }, 60_000);

  it('CA-19.5: senha certa em conta não confirmada → 403 email_nao_confirmado; senha errada → credenciais_invalidas', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email], SENHA_BOA, false);
    const certa = await tentar(app, email, SENHA_BOA);
    expect(certa.status).toBe(403);
    expect(await certa.json()).toMatchObject({ code: 'email_nao_confirmado' });
    expect(tokenDoCookie(certa)).toBeNull();
    const errada = await tentar(app, email, SENHA_ERRADA);
    expect(errada.status).toBe(400);
    expect(await errada.json()).toMatchObject({ code: 'credenciais_invalidas' });
  });

  it('o e-mail é normalizado no login (maiúsculas e espaços)', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    expect((await tentar(app, `  ${email.toUpperCase()}  `, SENHA_BOA)).status).toBe(204);
  });
});

describe.skipIf(!bancoDisponivel)('entrar: bloqueio por tentativas (RN-21, G-20)', () => {
  it('CA-21.1: 5 falhas no e-mail em 15 min → a 6ª, mesmo com a senha certa e de outro IP, recebe 429 muitas_tentativas', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    for (let i = 0; i < 5; i += 1) {
      expect((await tentar(app, email, SENHA_ERRADA, ipAleatorio())).status).toBe(400);
    }
    const sexta = await tentar(app, email, SENHA_BOA, ipAleatorio());
    expect(sexta.status).toBe(429);
    expect(await sexta.json()).toMatchObject({ code: 'muitas_tentativas' });
    expect(tokenDoCookie(sexta)).toBeNull();
  });

  it('4 falhas não bloqueiam: a 5ª tentativa com a senha certa entra e zera a contagem do e-mail', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    for (let i = 0; i < 4; i += 1) await tentar(app, email, SENHA_ERRADA, ipAleatorio());
    expect((await tentar(app, email, SENHA_BOA, ipAleatorio())).status).toBe(204);
    // depois do sucesso, mais 4 falhas ainda não bloqueiam
    for (let i = 0; i < 4; i += 1) expect((await tentar(app, email, SENHA_ERRADA, ipAleatorio())).status).toBe(400);
    expect((await tentar(app, email, SENHA_BOA, ipAleatorio())).status).toBe(204);
  });

  it('CA-21.2: 5 e-mails diferentes falhando do mesmo IP → a 6ª tentativa desse IP recebe 429 (outro IP segue livre)', async () => {
    const { app } = appDeAcesso();
    const ip = ipAleatorio();
    const vitima = emailAleatorio('vitima');
    await criarUsuariosConfirmados([vitima]);
    for (let i = 0; i < 5; i += 1) {
      expect((await tentar(app, emailAleatorio('varredura'), SENHA_ERRADA, ip)).status).toBe(400);
    }
    const sexta = await tentar(app, vitima, SENHA_BOA, ip);
    expect(sexta.status).toBe(429);
    expect(await sexta.json()).toMatchObject({ code: 'muitas_tentativas' });
    expect((await tentar(app, vitima, SENHA_BOA, ipAleatorio())).status).toBe(204);
  });

  it('CA-21.3: quando a 1ª falha sai da janela de 15 min, a tentativa volta a ser avaliada', async () => {
    const r = relogioControlado();
    const { app } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    await tentar(app, email, SENHA_ERRADA); // t = 0
    r.avancar(MINUTO);
    for (let i = 0; i < 4; i += 1) await tentar(app, email, SENHA_ERRADA); // t = 1 min
    r.avancar(13 * MINUTO + 59 * 1000); // t = 14:59: as 5 ainda na janela
    expect((await tentar(app, email, SENHA_BOA)).status).toBe(429);
    r.avancar(2 * 1000); // t = 15:01: a 1ª saiu, sobram 4
    expect((await tentar(app, email, SENHA_BOA)).status).toBe(204);
  });

  it('CA-21.4: o bloqueio vale igual para e-mail inexistente e a resposta é idêntica à de um existente', async () => {
    const { app } = appDeAcesso();
    const existente = emailAleatorio();
    const inexistente = emailAleatorio('nao-existe');
    await criarUsuariosConfirmados([existente]);
    for (let i = 0; i < 5; i += 1) {
      await tentar(app, existente, SENHA_ERRADA, ipAleatorio());
      await tentar(app, inexistente, SENHA_ERRADA, ipAleatorio());
    }
    const a = await assinaturaDaResposta(await tentar(app, existente, SENHA_ERRADA, ipAleatorio()));
    const b = await assinaturaDaResposta(await tentar(app, inexistente, SENHA_ERRADA, ipAleatorio()));
    expect(a.status).toBe(429);
    expect(b).toEqual(a);
  });

  it('o bloqueio por e-mail não depende da caixa (Ana@ e ana@ contam juntos)', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    for (let i = 0; i < 5; i += 1) await tentar(app, i % 2 ? email.toUpperCase() : email, SENHA_ERRADA, ipAleatorio());
    expect((await tentar(app, email, SENHA_BOA, ipAleatorio())).status).toBe(429);
  });

  it('X-Forwarded-For é ignorado: o IP vem só de CF-Connecting-IP', async () => {
    const { app } = appDeAcesso();
    const ip = ipAleatorio();
    // 5 falhas do mesmo CF-Connecting-IP, cada uma com um X-Forwarded-For diferente: o IP bloqueia mesmo assim
    for (let i = 0; i < 5; i += 1) {
      await tentar(app, emailAleatorio('xff'), SENHA_ERRADA, ip, { 'X-Forwarded-For': ipAleatorio() });
    }
    expect(
      (await tentar(app, emailAleatorio('xff'), SENHA_ERRADA, ip, { 'X-Forwarded-For': ipAleatorio() })).status,
    ).toBe(429);

    // e o contrário: o mesmo X-Forwarded-For com CF-Connecting-IP diferentes não bloqueia ninguém
    const xff = ipAleatorio();
    for (let i = 0; i < 5; i += 1) {
      await tentar(app, emailAleatorio('xff2'), SENHA_ERRADA, ipAleatorio(), { 'X-Forwarded-For': xff });
    }
    expect(
      (await tentar(app, emailAleatorio('xff2'), SENHA_ERRADA, ipAleatorio(), { 'X-Forwarded-For': xff })).status,
    ).toBe(400);
  });

  it('10 tentativas erradas em paralelo no mesmo e-mail: no máximo 5 chegam a conferir a senha', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio('paralelo');
    await criarUsuariosConfirmados([email]);
    const resps = await Promise.all(Array.from({ length: 10 }, () => tentar(app, email, SENHA_ERRADA, ipAleatorio())));
    const status = resps.map((r) => r.status);
    expect(status.filter((s) => s === 400).length).toBe(5);
    expect(status.filter((s) => s === 429).length).toBe(5);
  }, 60_000);

  it('o banco guarda só o HMAC do e-mail e do IP (nunca em claro)', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio('hmac');
    const ip = ipAleatorio();
    await tentar(app, email, SENHA_ERRADA, ip);
    const linhas = await comoOwner(async (db) => {
      const r = await sql<{ email_hash: Uint8Array; ip_hash: Uint8Array | null }>`
        select email_hash, ip_hash from app.tentativa_login order by id desc limit 50`.execute(db);
      return r.rows;
    });
    const texto = linhas
      .map((l) => new TextDecoder().decode(l.email_hash) + new TextDecoder().decode(l.ip_hash ?? new Uint8Array()))
      .join('');
    expect(texto).not.toContain(email);
    expect(texto).not.toContain(ip);
    for (const l of linhas) {
      expect(l.email_hash.byteLength).toBe(32);
      if (l.ip_hash) expect(l.ip_hash.byteLength).toBe(32);
    }
  });
});
