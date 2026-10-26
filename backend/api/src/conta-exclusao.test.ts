import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';
import { bancoDisponivel } from './testes-suporte';
import { comoOwner, MINUTO, postar, SENHA_BOA, tokenDoCookie } from './testes-suporte-acesso';
import { larParaCadastros } from './testes-suporte-cadastros';
import { lancarDespesa, larParaLancar, pagamentoNoBanco } from './testes-suporte-lancamentos';
import { json, linhasComoOwner, pedir, pessoa, type Pessoa } from './testes-suporte-lar';
import { assinarOk, assinaturaNoBanco, DIA, larDePlano, type App } from './testes-suporte-plano';

/**
 * Exclusão de conta pela API (RN-26; SDD 6.2 "Conta", E-1, E-2; CA-26.1, CA-26.2, CA-26.6, CA-26.7, CA-26.9,
 * CA-23.12; G-49; ADR-013). A purga em si (30 dias depois) é do `purgar.ts`, testado em `backend/scripts`.
 */

/** Senha real (bcrypt de custo baixo: só a preparação; a verificação usa o hash gravado). */
async function definirSenha(quem: Pessoa, senha = SENHA_BOA): Promise<void> {
  await comoOwner((db) =>
    sql`update app.usuario set senha_hash = app.crypt(${senha}, app.gen_salt('bf', 4)) where id = ${quem.id}`.execute(
      db,
    ),
  );
}

interface Caixinha {
  ultimoToken(email: string): string;
  para(email: string): Array<{ assunto: string; texto: string }>;
}

function pedirExclusao(app: App, quem: Pessoa, senha = SENHA_BOA): Promise<Response> {
  return pedir(app, 'POST', '/api/conta/exclusao', quem, { senha });
}

function confirmar(app: App, token: string): Promise<Response> {
  return pedir(app, 'POST', '/api/conta/exclusao/confirmar', null, { token });
}

/** Pede e devolve o token do link enviado. */
async function pedirOk(app: App, caixa: Caixinha, quem: Pessoa): Promise<string> {
  const r = await pedirExclusao(app, quem);
  if (r.status !== 202) throw new Error(`pedido falhou: ${r.status} ${await r.text()}`);
  return caixa.ultimoToken(quem.email);
}

async function confirmarOk(app: App, token: string): Promise<void> {
  const r = await confirmar(app, token);
  if (r.status !== 204) throw new Error(`confirmação falhou: ${r.status} ${await r.text()}`);
}

interface LinhaExclusao {
  solicitada_em: Date;
  confirmada_em: Date | null;
  purgar_em: Date | null;
  purgada_em: Date | null;
}

async function exclusoesDe(quem: Pessoa): Promise<LinhaExclusao[]> {
  return linhasComoOwner(sql<LinhaExclusao>`
    select solicitada_em, confirmada_em, purgar_em, purgada_em from app.exclusao_conta where usuario_id = ${quem.id}`);
}

async function sessoesDe(quem: Pessoa): Promise<number> {
  const r = await linhasComoOwner(
    sql<{ n: number }>`select count(*)::int as n from app.sessao where usuario_id = ${quem.id}`,
  );
  return r[0]!.n;
}

const statusDaSessao = async (app: App, quem: Pessoa) => (await pedir(app, 'GET', '/api/sessao', quem)).status;

describe.skipIf(!bancoDisponivel)('pedido de exclusão (CA-26.1)', () => {
  it('senha certa: 202 sem corpo, e-mail com o link de 30 min; nada muda na conta até confirmar', async () => {
    const l = await larDePlano('exc.pedido');
    await definirSenha(l.titular);
    const r = await pedirExclusao(l.app, l.titular);
    expect(r.status).toBe(202);
    expect(await r.text()).toBe('');
    const msg = l.caixa.para(l.titular.email).at(-1)!;
    expect(msg.assunto).toMatch(/exclusão/i);
    expect(msg.texto).toContain('https://teste.exemplo.local/confirmar-exclusao#t=');
    expect(msg.texto).toMatch(/30 minutos/);
    // Nada excluído (CA-26.1): sessão viva, lar intacto, pedido aberto e não confirmado.
    expect(await statusDaSessao(l.app, l.titular)).toBe(200);
    expect((await pedir(l.app, 'GET', '/api/lar', l.titular)).status).toBe(200);
    const linhas = await exclusoesDe(l.titular);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.confirmada_em).toBeNull();
    expect(linhas[0]!.purgar_em).toBeNull();
    // E ainda entra normalmente (o bloqueio só vale depois de confirmar).
    expect((await postar(l.app, '/api/sessao/entrar', { email: l.titular.email, senha: SENHA_BOA })).status).toBe(204);
  });

  it('senha errada: 400 credenciais_invalidas, sem e-mail e sem pedido aberto', async () => {
    const l = await larDePlano('exc.senha');
    await definirSenha(l.titular);
    const antes = l.caixa.para(l.titular.email).length;
    const r = await pedirExclusao(l.app, l.titular, 'senha-errada-123456');
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'credenciais_invalidas' });
    expect(l.caixa.para(l.titular.email).length).toBe(antes);
    expect(await exclusoesDe(l.titular)).toEqual([]);
  });

  it('5 senhas erradas bloqueiam a 6ª tentativa, mesmo com a senha certa (muitas_tentativas)', async () => {
    const l = await larDePlano('exc.bloqueio');
    await definirSenha(l.titular);
    for (let i = 0; i < 5; i += 1)
      expect((await pedirExclusao(l.app, l.titular, `errada-${i}-xxxxxxxx`)).status).toBe(400);
    const r = await pedirExclusao(l.app, l.titular);
    expect(r.status).toBe(429);
    expect(await json(r)).toMatchObject({ code: 'muitas_tentativas' });
    expect(await exclusoesDe(l.titular)).toEqual([]);
  });

  it('sem sessão: 401 sessao_expirada; corpo inválido: 400 valor_invalido', async () => {
    const l = await larDePlano('exc.semsessao');
    const r = await pedir(l.app, 'POST', '/api/conta/exclusao', null, { senha: SENHA_BOA });
    expect(r.status).toBe(401);
    expect(await json(r)).toMatchObject({ code: 'sessao_expirada' });
    const v = await pedir(l.app, 'POST', '/api/conta/exclusao', l.titular, { senha: '' });
    expect(v.status).toBe(400);
    expect(await json(v)).toMatchObject({ code: 'valor_invalido' });
  });

  it('novo pedido em menos de 2 min não manda outro e-mail; depois de 2 min, o link novo invalida o anterior', async () => {
    const l = await larDePlano('exc.reenvio');
    await definirSenha(l.titular);
    const primeiro = await pedirOk(l.app, l.caixa, l.titular);
    const enviados = l.caixa.para(l.titular.email).length;
    expect((await pedirExclusao(l.app, l.titular)).status).toBe(202);
    expect(l.caixa.para(l.titular.email).length).toBe(enviados);

    await l.avancar(2 * MINUTO + 1000);
    const segundo = await pedirOk(l.app, l.caixa, l.titular);
    expect(segundo).not.toBe(primeiro);
    expect(await exclusoesDe(l.titular)).toHaveLength(1);
    const r = await confirmar(l.app, primeiro);
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'link_expirado' });
    await confirmarOk(l.app, segundo);
  });
});

describe.skipIf(!bancoDisponivel)('confirmação da exclusão (CA-26.2, CA-26.9)', () => {
  it('204: revoga TODAS as sessões e agenda a purga para a confirmação + 30 dias', async () => {
    const l = await larDePlano('exc.confirma');
    await definirSenha(l.titular);
    const login = await postar(l.app, '/api/sessao/entrar', { email: l.titular.email, senha: SENHA_BOA });
    const outroAparelho = { ...l.titular, cookie: `__Host-sid=${tokenDoCookie(login)}` };
    const token = await pedirOk(l.app, l.caixa, l.titular);
    await l.avancar(10 * MINUTO);
    const confirmadaEm = l.relogio.agora();
    const r = await confirmar(l.app, token);
    expect(r.status).toBe(204);
    // O cookie deste navegador também sai.
    expect(r.headers.getSetCookie().join(';')).toMatch(/__Host-sid=;/);

    expect(await sessoesDe(l.titular)).toBe(0);
    expect(await statusDaSessao(l.app, l.titular)).toBe(401);
    expect(await statusDaSessao(l.app, outroAparelho)).toBe(401);
    const [linha] = await exclusoesDe(l.titular);
    expect(linha!.confirmada_em!.toISOString()).toBe(confirmadaEm.toISOString());
    expect(linha!.purgar_em!.getTime()).toBe(confirmadaEm.getTime() + 30 * DIA);
    expect(linha!.purgada_em).toBeNull();
    // Os dados continuam lá até a purga (só a purga apaga).
    const lar = await linhasComoOwner(sql<{ n: number }>`select count(*)::int as n from app.lar where id = ${l.larId}`);
    expect(lar[0]!.n).toBe(1);
  });

  it('o mesmo link de novo: 400 link_expirado, sem efeito', async () => {
    const l = await larDePlano('exc.reuso');
    await definirSenha(l.titular);
    const token = await pedirOk(l.app, l.caixa, l.titular);
    await confirmarOk(l.app, token);
    const [antes] = await exclusoesDe(l.titular);
    const r = await confirmar(l.app, token);
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'link_expirado' });
    expect(await exclusoesDe(l.titular)).toEqual([antes]);
  });

  it('link com mais de 30 min: 400 link_expirado e nada muda (sessões vivas, pedido não confirmado)', async () => {
    const l = await larDePlano('exc.expirado');
    await definirSenha(l.titular);
    const token = await pedirOk(l.app, l.caixa, l.titular);
    await l.avancar(30 * MINUTO + 1000);
    const r = await confirmar(l.app, token);
    expect(r.status).toBe(400);
    expect(await json(r)).toMatchObject({ code: 'link_expirado' });
    expect(await statusDaSessao(l.app, l.titular)).toBe(200);
    expect((await exclusoesDe(l.titular))[0]!.confirmada_em).toBeNull();
  });

  it('token errado, malformado ou de outra finalidade (confirmação de cadastro): 400 link_expirado', async () => {
    const l = await larDePlano('exc.errado');
    await definirSenha(l.titular);
    await pedirOk(l.app, l.caixa, l.titular);
    const falso = 'A'.repeat(43);
    for (const token of [falso, 'curto', '!!!']) {
      const r = await confirmar(l.app, token);
      expect(r.status, token).toBe(400);
      expect(await json(r)).toMatchObject({ code: 'link_expirado' });
    }
    // Token válido de recuperação de senha não serve para excluir.
    await postar(l.app, '/api/senha/esqueci', { email: l.titular.email });
    const recuperacao = l.caixa.ultimoToken(l.titular.email);
    const r = await confirmar(l.app, recuperacao);
    expect(r.status).toBe(400);
    expect(await statusDaSessao(l.app, l.titular)).toBe(200);
    expect((await exclusoesDe(l.titular))[0]!.confirmada_em).toBeNull();
  });

  it('login depois de confirmar: senha certa → 403 conta_em_exclusao sem criar sessão; senha errada → credenciais_invalidas', async () => {
    const l = await larDePlano('exc.login');
    await definirSenha(l.titular);
    await confirmarOk(l.app, await pedirOk(l.app, l.caixa, l.titular));
    const r = await postar(l.app, '/api/sessao/entrar', { email: l.titular.email, senha: SENHA_BOA });
    expect(r.status).toBe(403);
    expect(await json(r)).toMatchObject({ code: 'conta_em_exclusao' });
    expect(tokenDoCookie(r)).toBeNull();
    expect(await sessoesDe(l.titular)).toBe(0);
    const errada = await postar(l.app, '/api/sessao/entrar', { email: l.titular.email, senha: 'outra-senha-qualquer' });
    expect(errada.status).toBe(400);
    expect(await json(errada)).toMatchObject({ code: 'credenciais_invalidas' });
    // E não reativa: o pedido continua confirmado (CA-26.6).
    expect((await exclusoesDe(l.titular))[0]!.confirmada_em).not.toBeNull();
  });

  it('nada de token ou e-mail no log durante pedido e confirmação (G-46)', async () => {
    const l = await larDePlano('exc.log');
    await definirSenha(l.titular);
    const espioes = (['info', 'warn', 'error', 'log'] as const).map((n) =>
      vi.spyOn(console, n).mockImplementation(() => undefined),
    );
    const token = await pedirOk(l.app, l.caixa, l.titular);
    await confirmarOk(l.app, token);
    await confirmar(l.app, token);
    const texto = espioes.flatMap((e) => e.mock.calls.map((c) => c.join(' '))).join('\n');
    for (const e of espioes) e.mockRestore();
    expect(texto).not.toContain(token);
    expect(texto).not.toContain(l.titular.email);
  });
});

describe.skipIf(!bancoDisponivel)('titular sem convidado (CA-26.3 na confirmação; RN-24)', () => {
  it('cancela a assinatura no Asaas na confirmação e revoga o convite pendente', async () => {
    const l = await larDePlano('exc.asaas');
    await definirSenha(l.titular);
    const { assinaturaId } = await assinarOk(l);
    const convidado = await pessoa('exc.asaas.convidado');
    expect((await pedir(l.app, 'POST', '/api/lar/convites', l.titular, { email: convidado.email })).status).toBe(201);
    const tokenConvite = l.caixa.ultimoToken(convidado.email);

    await confirmarOk(l.app, await pedirOk(l.app, l.caixa, l.titular));
    expect(l.asaas.canceladas).toEqual([assinaturaId]);
    expect((await assinaturaNoBanco(l.larId))?.situacao).toBe('cancelada');
    // Ninguém entra num lar que vai ser apagado.
    const r = await pedir(l.app, 'POST', '/api/convites/aceitar', convidado, { token: tokenConvite });
    expect(r.status).toBe(404);
    expect(await json(r)).toMatchObject({ code: 'convite_invalido' });
  });

  it('lar sem assinatura no Asaas (trial): a confirmação não chama o Asaas', async () => {
    const l = await larDePlano('exc.trial');
    await definirSenha(l.titular);
    await confirmarOk(l.app, await pedirOk(l.app, l.caixa, l.titular));
    expect(l.asaas.chamadas).toEqual([]);
  });

  it('Asaas fora do ar: a exclusão é confirmada mesmo assim e a pendência fica no log, sem dado pessoal', async () => {
    const l = await larDePlano('exc.asaasfalha');
    await definirSenha(l.titular);
    const { assinaturaId } = await assinarOk(l);
    const token = await pedirOk(l.app, l.caixa, l.titular);
    l.asaas.falhar.add('cancelarAssinatura');
    const log = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = await confirmar(l.app, token);
    const texto = log.mock.calls.map((c) => c.join(' ')).join('\n');
    log.mockRestore();
    expect(r.status).toBe(204);
    expect((await exclusoesDe(l.titular))[0]!.confirmada_em).not.toBeNull();
    const linha = await assinaturaNoBanco(l.larId);
    expect(linha?.situacao).not.toBe('cancelada');
    expect(linha?.asaas_assinatura_id).toBe(assinaturaId);
    expect(texto).toContain('asaas_cancelamento_pendente');
    expect(texto).not.toContain(l.titular.email);
  });
});

describe.skipIf(!bancoDisponivel)('titular com convidado ativo: o lar é encerrado com aviso (D1, CA-26.7)', () => {
  it('o convidado recebe o e-mail e o aviso no app com a data da purga; continua usando o lar até lá', async () => {
    const l = await larDePlano('exc.d1', { comMembro: true });
    const membro = l.membro!;
    await definirSenha(l.titular);
    const { assinaturaId } = await assinarOk(l);
    const semAviso = await json<Record<string, unknown>>(await pedir(l.app, 'GET', '/api/sessao', membro));
    expect('encerramento' in semAviso).toBe(false);

    await confirmarOk(l.app, await pedirOk(l.app, l.caixa, l.titular));
    const purga = (await exclusoesDe(l.titular))[0]!.purgar_em!;

    // E-mail ao convidado: diz que o lar, o conjunto e o individual dele somem, e quando.
    const aviso = l.caixa.para(membro.email).at(-1)!;
    expect(aviso.assunto).toMatch(/encerrado/i);
    expect(aviso.texto).toMatch(/individuais/);
    expect(aviso.texto).toMatch(/conjuntos/);
    expect(aviso.texto).toContain('23/11/2026'); // 24/10/2026 + 30 dias, no calendário de São Paulo
    expect(aviso.texto).not.toContain(l.titular.email);
    expect(aviso.texto).not.toContain(l.titular.nome);

    // Aviso no app (GET /api/sessao) e o lar ainda funciona até a purga.
    const sessao = await json<{ encerramento?: { purga_em: string } }>(
      await pedir(l.app, 'GET', '/api/sessao', membro),
    );
    expect(sessao.encerramento).toEqual({ purga_em: purga.toISOString() });
    expect((await pedir(l.app, 'GET', '/api/lar', membro)).status).toBe(200);

    // Assinatura cancelada na confirmação (CA-26.7).
    expect(l.asaas.canceladas).toEqual([assinaturaId]);
    // O titular não aparece com o aviso (não entra mais) e o lar continua com os dois até a purga.
    const membros = await linhasComoOwner(
      sql<{ n: number }>`select count(*)::int as n from app.membro where lar_id = ${l.larId} and saiu_em is null`,
    );
    expect(membros[0]!.n).toBe(2);
  });
});

describe.skipIf(!bancoDisponivel)('convidado que exclui a conta: sai do lar como na saída (RN-26, CA-23.12)', () => {
  it('a parte privada some na hora, a conjunta fica com "Ex-membro" e o titular segue com o lar', async () => {
    const l = await larParaLancar('exc.membro');
    await definirSenha(l.membro);
    const conjunta = await lancarDespesa(l.app, l.membro, {
      valor_centavos: 5_000,
      categoria_id: l.bruno.mercado,
      forma_id: l.bruno.pix,
    });
    expect(await pagamentoNoBanco(conjunta)).not.toBeNull();

    await confirmarOk(l.app, await pedirOk(l.app, l.caixa, l.membro));
    expect(await pagamentoNoBanco(conjunta)).toBeNull();
    const detalhe = await json<{ pagador: { nome: string; sou_eu: boolean } }>(
      await pedir(l.app, 'GET', `/api/lancamentos/${conjunta}`, l.titular),
    );
    expect(detalhe.pagador).toMatchObject({ nome: 'Ex-membro', sou_eu: false });
    const lar = await json<{ membros: Array<{ papel: string }> }>(await pedir(l.app, 'GET', '/api/lar', l.titular));
    expect(lar.membros.map((m) => m.papel)).toEqual(['titular']);
    // O titular não recebe aviso de encerramento: o lar dele continua.
    const sessao = await json<Record<string, unknown>>(await pedir(l.app, 'GET', '/api/sessao', l.titular));
    expect('encerramento' in sessao).toBe(false);
    expect(await sessoesDe(l.membro)).toBe(0);
  });
});

describe.skipIf(!bancoDisponivel)('isolamento: a exclusão de A não toca o lar B (RT-01, CA-T1.1)', () => {
  it('confirmar a exclusão do titular de A não revoga sessão, convite nem assinatura de B', async () => {
    const a = await larDePlano('exc.iso-a');
    await definirSenha(a.titular);
    const b = await larParaCadastros('exc.iso-b');
    const antesB = await linhasComoOwner(
      sql<{ n: number }>`select (select count(*) from app.categoria where lar_id = ${b.larId})::int as n`,
    );
    await confirmarOk(a.app, await pedirOk(a.app, a.caixa, a.titular));
    expect(await statusDaSessao(b.app, b.titular)).toBe(200);
    expect(await statusDaSessao(b.app, b.membro)).toBe(200);
    const sessaoB = await json<Record<string, unknown>>(await pedir(b.app, 'GET', '/api/sessao', b.membro));
    expect('encerramento' in sessaoB).toBe(false);
    const depoisB = await linhasComoOwner(
      sql<{ n: number }>`select (select count(*) from app.categoria where lar_id = ${b.larId})::int as n`,
    );
    expect(depoisB).toEqual(antesB);
    expect(await exclusoesDe(b.titular)).toEqual([]);
  });

  it('usuário sem lar também pode excluir a conta (só revoga as sessões)', async () => {
    const l = await larDePlano('exc.semlar');
    const sozinho = await pessoa('exc.semlar.sozinho', 'Sozinho', l.relogio.agora());
    await definirSenha(sozinho);
    await confirmarOk(l.app, await pedirOk(l.app, l.caixa, sozinho));
    expect(await sessoesDe(sozinho)).toBe(0);
    expect((await exclusoesDe(sozinho))[0]!.confirmada_em).not.toBeNull();
  });
});
