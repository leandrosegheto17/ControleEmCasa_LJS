import { saida } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import {
  ACEITE,
  appDeAcesso,
  assinaturaDaResposta,
  cadastrarEConfirmar,
  caixaDeEmail,
  cookieSid,
  criarUsuariosConfirmados,
  emailAleatorio,
  entrarComo,
  HORA,
  MINUTO,
  obter,
  postar,
  relogioControlado,
} from './testes-suporte-acesso';

/**
 * Sessão (RN-20; CA-20.1 a CA-20.6, CA-20.8; CA-19.7; G-15, G-16, G-48; SDD 5.2).
 * Relógio injetado: "14:59 vale, 15:01 expira"; 12 h absolutas mesmo com uso a cada 5 min.
 */
const SEGUNDO = 1000;

async function corpoDeErro(r: Response) {
  return (await r.json()) as { code: string };
}

describe.skipIf(!bancoDisponivel)('GET /api/sessao', () => {
  it('devolve a sessão atual no formato do contrato, sem o token (CA-20.8)', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const token = await entrarComo(app, email);
    const r = await obter(app, '/api/sessao', { cookie: cookieSid(token) });
    expect(r.status).toBe(200);
    const texto = await r.text();
    expect(texto).not.toContain(token);
    const corpo = saida.SessaoAtual.parse(JSON.parse(texto));
    expect(corpo.usuario.email).toBe(email);
    expect(corpo).toMatchObject({ membro: null, lar: null, plano: null });
  });

  it('CA-20.6: cookie ausente, malformado, repetido, desconhecido, revogado e vencido → a mesma resposta sessao_expirada', async () => {
    const r = relogioControlado();
    const { app } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const revogado = await entrarComo(app, email);
    await postar(app, '/api/sessao/sair', {}, { cookie: cookieSid(revogado) });
    const vencido = await entrarComo(app, email);
    const tambemVencido = await entrarComo(app, email);
    r.avancar(16 * MINUTO);
    const valido = await entrarComo(app, email);

    const casos = [
      undefined,
      cookieSid('curto'),
      `${cookieSid(valido)}; ${cookieSid(valido)}`,
      cookieSid('D'.repeat(43)),
      cookieSid(revogado),
      cookieSid(vencido),
      cookieSid(tambemVencido),
    ];
    const respostas = [];
    for (const cookie of casos) respostas.push(await obter(app, '/api/sessao', { cookie }));
    const assinaturas = await Promise.all(
      respostas.map(async (x) => {
        const a = await assinaturaDaResposta(x);
        // o cookie é limpo quando havia algum; a ausência de cookie não precisa de limpeza
        return { status: a.status, corpo: a.corpo };
      }),
    );
    for (const a of assinaturas) expect(a).toEqual(assinaturas[0]);
    expect(assinaturas[0]?.status).toBe(401);
    expect(JSON.parse(assinaturas[0]?.corpo ?? '{}')).toMatchObject({ code: 'sessao_expirada' });
    // com cookie inválido, a resposta manda apagar o cookie
    expect(respostas[4]?.headers.getSetCookie().join(';')).toMatch(/__Host-sid=;.*Max-Age=0/i);
  });
});

describe.skipIf(!bancoDisponivel)('expiração (G-16)', () => {
  it('inatividade: 14:59 sem requisição vale; 15:00 e 1 s depois do último uso, sessao_expirada (CA-20.2)', async () => {
    const r = relogioControlado();
    const { app } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const token = await entrarComo(app, email);

    r.avancar(14 * MINUTO + 59 * SEGUNDO);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(token) })).status).toBe(200);

    // o uso aos 14:59 renovou: conta de novo a partir dele
    r.avancar(15 * MINUTO + 1 * SEGUNDO);
    const expirada = await obter(app, '/api/sessao', { cookie: cookieSid(token) });
    expect(expirada.status).toBe(401);
    expect(await corpoDeErro(expirada)).toMatchObject({ code: 'sessao_expirada' });
  });

  it('a renovação não ressuscita: depois de expirar por inatividade, o mesmo token não volta a valer', async () => {
    const r = relogioControlado();
    const { app } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const token = await entrarComo(app, email);
    r.avancar(15 * MINUTO + SEGUNDO);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(token) })).status).toBe(401);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(token) })).status).toBe(401);
  });

  it('CA-20.3: com requisições a cada 5 min, a sessão vale até 11:55 e expira às 12 h do login', async () => {
    const r = relogioControlado();
    const { app } = appDeAcesso({ relogio: r.relogio });
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const token = await entrarComo(app, email);
    for (let passo = 1; passo < 144; passo += 1) {
      r.avancar(5 * MINUTO);
      const resp = await obter(app, '/api/sessao', { cookie: cookieSid(token) });
      if (resp.status !== 200) throw new Error(`expirou cedo, no passo ${passo}`);
    }
    // 143 × 5 min = 11:55; mais 5 min = 12:00 exatas desde o login
    r.avancar(5 * MINUTO);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(token) })).status).toBe(401);
  }, 60_000);
});

describe.skipIf(!bancoDisponivel)('sair e sair de todos (CA-20.4, CA-20.5)', () => {
  it('sair revoga a sessão deste aparelho no servidor e apaga o cookie; as outras continuam', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const aparelho1 = await entrarComo(app, email);
    const aparelho2 = await entrarComo(app, email);
    const r = await postar(app, '/api/sessao/sair', {}, { cookie: cookieSid(aparelho1) });
    expect(r.status).toBe(204);
    expect(r.headers.getSetCookie().join(';')).toMatch(/__Host-sid=;.*Max-Age=0/i);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(aparelho1) })).status).toBe(401);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(aparelho2) })).status).toBe(200);
  });

  it('sair é idempotente: sem cookie ou com sessão já revogada, 204', async () => {
    const { app } = appDeAcesso();
    expect((await postar(app, '/api/sessao/sair', {})).status).toBe(204);
    expect((await postar(app, '/api/sessao/sair', {}, { cookie: cookieSid('Z'.repeat(43)) })).status).toBe(204);
  });

  it('sair de todos revoga todas as sessões do usuário, inclusive a atual, e não toca nas de outro usuário', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    const outro = emailAleatorio('outro');
    await criarUsuariosConfirmados([email, outro]);
    const s1 = await entrarComo(app, email);
    const s2 = await entrarComo(app, email);
    const s3 = await entrarComo(app, email);
    const doOutro = await entrarComo(app, outro);

    const r = await postar(app, '/api/sessao/sair-de-todos', {}, { cookie: cookieSid(s2) });
    expect(r.status).toBe(204);
    expect(r.headers.getSetCookie().join(';')).toMatch(/__Host-sid=;.*Max-Age=0/i);
    for (const s of [s1, s2, s3]) expect((await obter(app, '/api/sessao', { cookie: cookieSid(s) })).status).toBe(401);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(doOutro) })).status).toBe(200);
  });

  it('CA-20.5: repetir "sair de todos" é sucesso sem efeito (o 400 do legado deixou de existir)', async () => {
    const { app } = appDeAcesso();
    const email = emailAleatorio();
    await criarUsuariosConfirmados([email]);
    const s = await entrarComo(app, email);
    expect((await postar(app, '/api/sessao/sair-de-todos', {}, { cookie: cookieSid(s) })).status).toBe(204);
    expect((await postar(app, '/api/sessao/sair-de-todos', {}, { cookie: cookieSid(s) })).status).toBe(204);
    expect((await postar(app, '/api/sessao/sair-de-todos', {})).status).toBe(204);
  });

  it('sair e sair de todos exigem o cabeçalho de CSRF (escrita)', async () => {
    const { app } = appDeAcesso();
    const r = await postar(app, '/api/sessao/sair-de-todos', {}, { cabecalhos: { 'X-Controle-Em-Casa': '0' } });
    expect(r.status).toBe(403);
  });
});

describe.skipIf(!bancoDisponivel)('termos versionados (CA-19.7, G-48)', () => {
  it('quem aceitou a versão vigente no cadastro não tem termos pendentes', async () => {
    const caixa = caixaDeEmail();
    const { app } = appDeAcesso({ caixa });
    const email = emailAleatorio();
    await cadastrarEConfirmar(app, caixa, email);
    const token = await entrarComo(app, email);
    const corpo = saida.SessaoAtual.parse(await (await obter(app, '/api/sessao', { cookie: cookieSid(token) })).json());
    expect(corpo.termos_pendentes).toBe(false);
  });

  it('versão nova: termos pendentes até aceitar; só a versão vigente é aceita; o aceite fica registrado', async () => {
    const caixa = caixaDeEmail();
    const antigo = appDeAcesso({ caixa }).app;
    const email = emailAleatorio();
    await cadastrarEConfirmar(antigo, caixa, email);

    const vigentes = { termos: '2027-01-01', privacidade: ACEITE.privacidade };
    const { app } = appDeAcesso({ caixa, versoes: vigentes });
    const token = await entrarComo(app, email);
    const cookie = cookieSid(token);
    const antes = saida.SessaoAtual.parse(await (await obter(app, '/api/sessao', { cookie })).json());
    expect(antes.termos_pendentes).toBe(true);

    const velha = await postar(app, '/api/termos/aceite', ACEITE, { cookie });
    expect(velha.status).toBe(400);
    expect(await corpoDeErro(velha)).toMatchObject({ code: 'valor_invalido' });

    expect((await postar(app, '/api/termos/aceite', vigentes, { cookie })).status).toBe(204);
    expect((await postar(app, '/api/termos/aceite', vigentes, { cookie })).status).toBe(204); // repetir não duplica
    const depois = saida.SessaoAtual.parse(await (await obter(app, '/api/sessao', { cookie })).json());
    expect(depois.termos_pendentes).toBe(false);
  });

  it('aceitar termos exige sessão', async () => {
    const { app } = appDeAcesso();
    const r = await postar(app, '/api/termos/aceite', ACEITE);
    expect(r.status).toBe(401);
    expect(await corpoDeErro(r)).toMatchObject({ code: 'sessao_expirada' });
  });
});

describe.skipIf(!bancoDisponivel)('ponta a ponta', () => {
  it('cadastro → confirmar → entrar → sessão → sair', async () => {
    const caixa = caixaDeEmail();
    const r = relogioControlado();
    const { app } = appDeAcesso({ caixa, relogio: r.relogio });
    const email = emailAleatorio();
    await cadastrarEConfirmar(app, caixa, email);
    const token = await entrarComo(app, email);
    r.avancar(HORA / 4 - MINUTO);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(token) })).status).toBe(200);
    expect((await postar(app, '/api/sessao/sair', {}, { cookie: cookieSid(token) })).status).toBe(204);
    expect((await obter(app, '/api/sessao', { cookie: cookieSid(token) })).status).toBe(401);
  });
});
