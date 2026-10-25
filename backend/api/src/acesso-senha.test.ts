import { describe, expect, it, vi } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import {
  appDeAcesso,
  assinaturaDaResposta,
  cookieSid,
  cronometrar,
  criarUsuariosConfirmados,
  emailAleatorio,
  entrarComo,
  mediana,
  MINUTO,
  obter,
  postar,
  relogioControlado,
  SENHA_BOA,
} from './testes-suporte-acesso';

/** Recuperação de senha (CA-19.6; G-16, G-18, G-19; TM-API-16). */
const SENHA_NOVA = 'outra-senha-forte-456';

describe.skipIf(!bancoDisponivel)('esqueci a senha', () => {
  it('resposta idêntica byte a byte para e-mail existente e inexistente; só o existente recebe o link', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    const fantasma = emailAleatorio('fantasma');
    await criarUsuariosConfirmados([email]);
    const a = await assinaturaDaResposta(await postar(app, '/api/senha/esqueci', { email }));
    const b = await assinaturaDaResposta(await postar(app, '/api/senha/esqueci', { email: fantasma }));
    expect(a.status).toBe(202);
    expect(b).toEqual(a);
    await vi.waitFor(() => expect(caixa.para(email)).toHaveLength(1));
    expect(caixa.para(email)[0]?.texto).toContain('https://teste.exemplo.local/redefinir-senha#t=');
    expect(caixa.para(fantasma)).toHaveLength(0);
  });

  it('o tempo fica na mesma faixa para e-mail existente e inexistente (mediana de 8, tolerância de 60 ms)', async () => {
    // Nenhum dos caminhos roda bcrypt e o e-mail sai depois da resposta (waitUntil): a diferença é de poucas
    // escritas no banco. 60 ms absorve o ruído local e do CI.
    const { app } = appDeAcesso();
    const N = 8;
    const existentes = Array.from({ length: N }, () => emailAleatorio('esqueci'));
    await criarUsuariosConfirmados(existentes);
    const tExistente: number[] = [];
    const tInexistente: number[] = [];
    for (let i = 0; i < N; i += 1) {
      tExistente.push(await cronometrar(() => postar(app, '/api/senha/esqueci', { email: existentes[i] })));
      tInexistente.push(await cronometrar(() => postar(app, '/api/senha/esqueci', { email: emailAleatorio('nada') })));
    }
    expect(Math.abs(mediana(tExistente) - mediana(tInexistente))).toBeLessThan(60);
  }, 60_000);

  it('no máximo 1 link de recuperação a cada 2 min; o novo invalida o anterior', async () => {
    const r = relogioControlado();
    const { app, caixa } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    await postar(app, '/api/senha/esqueci', { email });
    const primeiro = caixa.ultimoToken(email);
    r.avancar(30 * 1000);
    await postar(app, '/api/senha/esqueci', { email });
    expect(caixa.para(email)).toHaveLength(1);
    r.avancar(2 * MINUTO);
    await postar(app, '/api/senha/esqueci', { email });
    await vi.waitFor(() => expect(caixa.para(email)).toHaveLength(2));
    const segundo = caixa.ultimoToken(email);
    expect((await postar(app, '/api/senha/redefinir', { token: primeiro, senha: SENHA_NOVA })).status).toBe(400);
    expect((await postar(app, '/api/senha/redefinir', { token: segundo, senha: SENHA_NOVA })).status).toBe(204);
  });
});

describe.skipIf(!bancoDisponivel)('redefinir a senha', () => {
  it('troca a senha e revoga TODAS as sessões do usuário (G-16, CA-19.6)', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const s1 = await entrarComo(app, email);
    const s2 = await entrarComo(app, email);
    await postar(app, '/api/senha/esqueci', { email });
    const r = await postar(app, '/api/senha/redefinir', { token: caixa.ultimoToken(email), senha: SENHA_NOVA });
    expect(r.status).toBe(204);
    for (const s of [s1, s2]) expect((await obter(app, '/api/sessao', { cookie: cookieSid(s) })).status).toBe(401);

    const velha = await postar(app, '/api/sessao/entrar', { email, senha: SENHA_BOA });
    expect(velha.status).toBe(400);
    expect(await velha.json()).toMatchObject({ code: 'credenciais_invalidas' });
    await entrarComo(app, email, SENHA_NOVA);
  });

  it('uso único: o mesmo link não redefine duas vezes', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    await postar(app, '/api/senha/esqueci', { email });
    const token = caixa.ultimoToken(email);
    expect((await postar(app, '/api/senha/redefinir', { token, senha: SENHA_NOVA })).status).toBe(204);
    const de_novo = await postar(app, '/api/senha/redefinir', { token, senha: 'terceira-senha-789' });
    expect(de_novo.status).toBe(400);
    expect(await de_novo.json()).toMatchObject({ code: 'link_expirado' });
    await entrarComo(app, email, SENHA_NOVA);
  });

  it('vale 30 min: com 30 min, link_expirado e a senha continua a mesma', async () => {
    const r = relogioControlado();
    const { app, caixa } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    await postar(app, '/api/senha/esqueci', { email });
    r.avancar(30 * MINUTO);
    const resp = await postar(app, '/api/senha/redefinir', { token: caixa.ultimoToken(email), senha: SENHA_NOVA });
    expect(resp.status).toBe(400);
    expect(await resp.json()).toMatchObject({ code: 'link_expirado' });
    await entrarComo(app, email, SENHA_BOA);
  });

  it('senha fraca: 400 senha_fraca e o link NÃO é consumido (dá para tentar de novo)', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    await postar(app, '/api/senha/esqueci', { email });
    const token = caixa.ultimoToken(email);
    const fraca = await postar(app, '/api/senha/redefinir', { token, senha: 'curta' });
    expect(fraca.status).toBe(400);
    expect(await fraca.json()).toMatchObject({ code: 'senha_fraca' });
    expect((await postar(app, '/api/senha/redefinir', { token, senha: SENHA_NOVA })).status).toBe(204);
  });

  it('o token de confirmação não serve para redefinir senha', async () => {
    const { app, caixa } = appDeAcesso();
    const email = emailAleatorio();
    await postar(app, '/api/cadastro', {
      nome: 'Ana',
      email,
      senha: SENHA_BOA,
      aceite: { termos: '2026-10-24', privacidade: '2026-10-24' },
    });
    const r = await postar(app, '/api/senha/redefinir', { token: caixa.ultimoToken(email), senha: SENHA_NOVA });
    expect(r.status).toBe(400);
  });
});
