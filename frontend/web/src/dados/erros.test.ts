import { describe, expect, it } from 'vitest';
import { CODIGOS_ERRO } from '../comum/erros';
import { ehErroDados, traduzirFalhaDeEnvio, traduzirResposta } from './erros';

describe('traduzirResposta', () => {
  it.each(CODIGOS_ERRO.filter((c) => c !== 'sessao_expirada'))(
    'o código "%s" vira erro de regra com o mesmo código',
    (code) => {
      expect(traduzirResposta(400, { code, message: 'qualquer' })).toEqual({ tipo: 'regra', codigo: code });
    },
  );

  it.each([
    'credenciais_invalidas',
    'link_expirado',
    'senha_fraca',
    'valor_invalido',
    'email_nao_confirmado',
    'conta_em_exclusao',
    'origem_invalida',
    'sem_lar',
    'convite_invalido',
    'lar_cheio',
    'ja_tem_lar',
  ] as const)('os códigos de acesso e de lar ("%s") são reconhecidos', (code) => {
    expect(traduzirResposta(400, { code }).tipo).toBe('regra');
  });

  it('muitas_requisicoes e muitas_tentativas (429) mantêm o código, para a tela mostrar o texto próprio', () => {
    expect(traduzirResposta(429, { code: 'muitas_tentativas' })).toEqual({
      tipo: 'regra',
      codigo: 'muitas_tentativas',
    });
    expect(traduzirResposta(429, { code: 'muitas_requisicoes' })).toEqual({
      tipo: 'regra',
      codigo: 'muitas_requisicoes',
    });
  });

  it('401 vira autenticação, com ou sem corpo', () => {
    expect(traduzirResposta(401, { code: 'sessao_expirada' })).toEqual({ tipo: 'autenticacao' });
    expect(traduzirResposta(401, undefined)).toEqual({ tipo: 'autenticacao' });
  });

  it('sessao_expirada vira autenticação mesmo com outro status', () => {
    expect(traduzirResposta(403, { code: 'sessao_expirada' })).toEqual({ tipo: 'autenticacao' });
  });

  it('429 sem código reconhecido e 5xx viram indisponível, inclusive com corpo que não é JSON da API', () => {
    expect(traduzirResposta(429, undefined)).toEqual({ tipo: 'indisponivel' });
    expect(traduzirResposta(500, { code: 'erro_interno' })).toEqual({ tipo: 'indisponivel' });
    expect(traduzirResposta(503, { code: 'indisponivel' })).toEqual({ tipo: 'indisponivel' });
    expect(traduzirResposta(502, undefined)).toEqual({ tipo: 'indisponivel' });
  });

  it('código desconhecido em erro 4xx vira desconhecido, sem repassar o texto do servidor', () => {
    const erro = traduzirResposta(418, { code: 'codigo_novo', message: 'texto do servidor' });
    expect(erro).toEqual({ tipo: 'desconhecido' });
    expect(JSON.stringify(erro)).not.toContain('texto do servidor');
  });

  it('corpo que não é objeto não quebra', () => {
    expect(traduzirResposta(400, 'texto')).toEqual({ tipo: 'desconhecido' });
    expect(traduzirResposta(400, null)).toEqual({ tipo: 'desconhecido' });
  });
});

describe('traduzirFalhaDeEnvio', () => {
  it('falha de rede (TypeError do fetch) e prazo estourado (AbortError) viram "rede"', () => {
    expect(traduzirFalhaDeEnvio(new TypeError('Failed to fetch'))).toEqual({ tipo: 'rede' });
    expect(traduzirFalhaDeEnvio(new DOMException('abortado', 'AbortError'))).toEqual({ tipo: 'rede' });
  });

  it('outro erro vira desconhecido', () => {
    expect(traduzirFalhaDeEnvio(new Error('x'))).toEqual({ tipo: 'desconhecido' });
  });
});

describe('ehErroDados', () => {
  it('reconhece os formatos de ErroDados e recusa o resto', () => {
    expect(ehErroDados({ tipo: 'rede' })).toBe(true);
    expect(ehErroDados({ tipo: 'regra', codigo: 'sem_lar' })).toBe(true);
    expect(ehErroDados({ tipo: 'regra', codigo: 'inventado' })).toBe(false);
    expect(ehErroDados(new Error('x'))).toBe(false);
    expect(ehErroDados(null)).toBe(false);
  });
});
