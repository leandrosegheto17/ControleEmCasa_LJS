import { describe, expect, it } from 'vitest';
import { DADOS_COLETADOS_SENTRY, limparEventoSentry, limparMigalhaSentry, limparTextoSentry } from './observabilidade';

/**
 * G-45 e TM-OBS-01 / TM-ASA-05 (etapa 16): nada de dado pessoal, segredo ou dado financeiro no Sentry. O evento e as
 * migalhas (breadcrumbs) saem sem e-mail, senha, token, cookie (`__Host-sid`), cabeçalhos `Cookie`, `Authorization` e
 * `asaas-access-token`, CPF/CNPJ, corpo de requisição, query string, fragmento com token e valores ou descrições
 * financeiras. A limpeza é a mesma no Worker (`@sentry/cloudflare`) e no front (`@sentry/react`).
 */

const EMAIL = 'ana.souza@exemplo.com';
const SENHA = 'senha-bem-longa-1';
const TOKEN = 'Zm9vYmFyLXRva2VuLWRlLXNlc3Nhby1jb20tMzItYnl0ZXM';
const CPF = '529.982.247-25';
const CPF_SEM = '52998224725';
const CNPJ = '11.222.333/0001-81';
const CNPJ_SEM = '11222333000181';
const SID = `__Host-sid=${TOKEN}`;
const ASAAS = '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwMDAwMDA6OiRhYWNoXzRlNTU';
const VALOR = 'R$ 1.234,56';
const DESCRICAO = 'Mercado do mês com a sogra';

/** Tudo o que não pode aparecer, em qualquer lugar do JSON do evento. */
const PROIBIDOS = [EMAIL, SENHA, TOKEN, CPF, CPF_SEM, CNPJ, CNPJ_SEM, ASAAS, VALOR, '1.234,56', DESCRICAO, '4590'];

function eventoSujo() {
  return {
    event_id: 'abc',
    level: 'error',
    release: '0123456789abcdef0123456789abcdef01234567',
    environment: 'producao',
    message: `Falha para ${EMAIL} com ${VALOR}`,
    logentry: { message: `login de ${EMAIL}`, params: [EMAIL, SENHA] },
    transaction: `/api/sessao/entrar?email=${EMAIL}`,
    exception: {
      values: [
        {
          type: 'Error',
          value: `insert falhou: {"email":"${EMAIL}","senha":"${SENHA}","cpf_cnpj":"${CPF}","valor_centavos":4590,"descricao":"${DESCRICAO}"} token=${TOKEN}`,
          stacktrace: {
            frames: [
              {
                filename: `https://controle.exemplo/assets/app.js?t=${TOKEN}#t=${TOKEN}`,
                abs_path: `https://controle.exemplo/confirmar#t=${TOKEN}`,
                function: 'entrar',
                lineno: 10,
                vars: { email: EMAIL, senha: SENHA, valor: 4590 },
              },
            ],
          },
        },
      ],
    },
    request: {
      method: 'POST',
      url: `https://controle.exemplo/api/plano/assinar?cpf=${CPF_SEM}#t=${TOKEN}`,
      query_string: `email=${EMAIL}`,
      data: { email: EMAIL, senha: SENHA, cpf_cnpj: CNPJ, valor_centavos: 4590, descricao: DESCRICAO },
      cookies: { '__Host-sid': TOKEN },
      headers: {
        Cookie: SID,
        Authorization: `Bearer ${TOKEN}`,
        'asaas-access-token': ASAAS,
        'X-Forwarded-For': '203.0.113.9',
      },
      env: { REMOTE_ADDR: '203.0.113.9' },
    },
    user: { id: 'u1', email: EMAIL, ip_address: '203.0.113.9', username: 'ana' },
    extra: { corpo: { email: EMAIL, valor_centavos: 4590 } },
    contexts: {
      runtime: { name: 'cloudflare' },
      response: { headers: { 'set-cookie': SID }, status_code: 500 },
      corpo: { descricao: DESCRICAO },
    },
    tags: { rota: `/api/x?email=${EMAIL}`, area: 'acesso' },
    sdkProcessingMetadata: { normalizedRequest: { data: { email: EMAIL } } },
    breadcrumbs: [
      { category: 'console', level: 'log', message: `${EMAIL} lançou ${VALOR}` },
      {
        type: 'http',
        category: 'fetch',
        data: {
          method: 'POST',
          url: `/api/lancamentos/despesas?descricao=${DESCRICAO}`,
          status_code: 500,
          body: { valor_centavos: 4590 },
        },
      },
    ],
  };
}

describe('limparEventoSentry', () => {
  it('não deixa sair nenhum dado proibido, em lugar nenhum do evento', () => {
    const limpo = limparEventoSentry(eventoSujo());
    const json = JSON.stringify(limpo);
    for (const proibido of PROIBIDOS) expect(json, proibido).not.toContain(proibido);
    expect(json).not.toContain('203.0.113.9');
    expect(json).not.toMatch(/__Host-sid=(?!\[removido\])/);
  });

  it('a requisição fica só com método e URL sem query nem fragmento', () => {
    const limpo = limparEventoSentry(eventoSujo());
    expect(limpo.request).toEqual({ method: 'POST', url: 'https://controle.exemplo/api/plano/assinar' });
  });

  it('remove usuário, extra, metadados internos e contextos fora da lista (resposta, corpo)', () => {
    const limpo = limparEventoSentry(eventoSujo()) as Record<string, unknown>;
    expect(limpo['user']).toBeUndefined();
    expect(limpo['extra']).toBeUndefined();
    expect(limpo['sdkProcessingMetadata']).toBeUndefined();
    expect(limpo['contexts']).toEqual({ runtime: { name: 'cloudflare' } });
  });

  it('mantém o que serve para depurar: tipo do erro, release, ambiente, função e linha', () => {
    const limpo = limparEventoSentry(eventoSujo());
    expect(limpo.release).toBe('0123456789abcdef0123456789abcdef01234567');
    expect(limpo.environment).toBe('producao');
    const frame = limpo.exception!.values![0]!.stacktrace!.frames![0]!;
    expect(limpo.exception!.values![0]!.type).toBe('Error');
    expect(frame).toMatchObject({ function: 'entrar', lineno: 10, filename: 'https://controle.exemplo/assets/app.js' });
    expect(frame.vars).toBeUndefined();
    expect(limpo.tags).toEqual({ rota: '/api/x', area: 'acesso' });
  });

  it('o id de correlação (UUID) fica, para ligar o evento ao log e à resposta de erro', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const limpo = limparEventoSentry({ message: `erro_interno ${id}` });
    expect(limpo.message).toBe(`erro_interno ${id}`);
  });

  it('não altera o evento recebido (devolve uma cópia)', () => {
    const original = eventoSujo();
    limparEventoSentry(original);
    expect(original.user.email).toBe(EMAIL);
  });

  it('aguenta evento mínimo, sem campos opcionais', () => {
    expect(limparEventoSentry({})).toEqual({});
  });
});

describe('limparMigalhaSentry', () => {
  it('console é descartado (pode levar qualquer texto)', () => {
    expect(limparMigalhaSentry({ category: 'console', message: 'oi' })).toBeNull();
  });

  it('fetch/xhr: só método, status e URL sem query, fragmento nem token no caminho; sem corpo', () => {
    const push = `https://fcm.googleapis.com/fcm/send/${TOKEN}${TOKEN}`;
    const m = limparMigalhaSentry({
      type: 'http',
      category: 'xhr',
      level: 'info',
      timestamp: 1,
      data: { method: 'GET', url: `${push}?k=${TOKEN}`, status_code: 201, request_body_size: 10, body: { a: EMAIL } },
    });
    expect(m).toEqual({
      type: 'http',
      category: 'xhr',
      level: 'info',
      timestamp: 1,
      data: { method: 'GET', status_code: 201, url: 'https://fcm.googleapis.com/fcm/send/[removido]' },
    });
  });

  it('navegação: de/para sem query nem fragmento (o token de confirmação vem no fragmento)', () => {
    const m = limparMigalhaSentry({
      category: 'navigation',
      data: { from: `/confirmar#t=${TOKEN}`, to: `/app/lancamentos?mes=2026-10&busca=${DESCRICAO}` },
    });
    expect(m).toEqual({ category: 'navigation', data: { from: '/confirmar', to: '/app/lancamentos' } });
  });

  it('clique na interface: fica só o seletor, limpo; sem data', () => {
    const m = limparMigalhaSentry({
      category: 'ui.click',
      message: `button[aria-label="Lançar ${VALOR}"]`,
      data: { texto: DESCRICAO },
    });
    expect(m).toEqual({ category: 'ui.click', message: 'button[aria-label="Lançar [removido]"]' });
  });

  it('outras categorias: sem data, mensagem limpa', () => {
    const m = limparMigalhaSentry({ category: 'qualquer', message: `para ${EMAIL}`, data: { cpf: CPF } });
    expect(m).toEqual({ category: 'qualquer', message: 'para [removido]' });
  });
});

describe('limparTextoSentry', () => {
  it.each([
    [`contato ${EMAIL}`, 'contato [removido]'],
    [`cpf ${CPF} e ${CPF_SEM}`, 'cpf [removido] e [removido]'],
    [`cnpj ${CNPJ} e ${CNPJ_SEM}`, 'cnpj [removido] e [removido]'],
    [`cookie ${SID}; outro=1`, 'cookie __Host-sid=[removido]; outro=1'],
    [`Authorization: Bearer ${TOKEN}`, 'Authorization: Bearer [removido]'],
    [`chave ${ASAAS}`, 'chave [removido]'],
    [`total ${VALOR} e -R$ 3,00`, 'total [removido] e [removido]'],
    [
      '{"valor_centavos":4590,"descricao":"Feira","senha":"x y"}',
      '{"valor_centavos":[removido],"descricao":[removido],"senha":[removido]}',
    ],
    ["senha='abc def' email=a", 'senha=[removido] email=[removido]'],
    [`https://x.exemplo/a/b?token=${TOKEN}#t=1 depois`, 'https://x.exemplo/a/b depois'],
  ])('%s', (entrada, saida) => {
    expect(limparTextoSentry(entrada)).toBe(saida);
  });

  it('texto comum fica como está', () => {
    expect(limparTextoSentry('TypeError: Cannot read properties of undefined')).toBe(
      'TypeError: Cannot read properties of undefined',
    );
  });
});

describe('DADOS_COLETADOS_SENTRY (dataCollection do SDK v11, que substitui o sendDefaultPii: false do G-45)', () => {
  it('desliga usuário, cookies, cabeçalhos, corpos, query string, dados de consulta e variáveis locais', () => {
    expect(DADOS_COLETADOS_SENTRY).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    });
  });
});
