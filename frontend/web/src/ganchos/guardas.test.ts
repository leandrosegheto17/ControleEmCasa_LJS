import type { SaidaSessaoAtual } from '@controle/contrato';
import { describe, expect, it } from 'vitest';
import {
  ROTA_BEM_VINDO,
  ROTA_INICIO,
  ROTA_TERMOS,
  decidirRotaDoApp,
  decidirRotaPublica,
  destinoDeVolta,
  type EstadoSessao,
} from './guardas';

const ID = '00000000-0000-4000-8000-0000000000a1';
const LAR = { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' } as unknown as NonNullable<
  SaidaSessaoAtual['lar']
>;

function ativa(extra: Partial<SaidaSessaoAtual> = {}): EstadoSessao {
  return {
    situacao: 'ativa',
    sessao: {
      usuario: { id: ID, nome: 'Ana', email: 'ana@exemplo.com' },
      membro: null,
      lar: LAR,
      plano: null,
      termos_pendentes: false,
      ...extra,
    },
  };
}

const semSessao: EstadoSessao = { situacao: 'sem-sessao' };
const carregando: EstadoSessao = { situacao: 'carregando' };
const presumida: EstadoSessao = { situacao: 'presumida' };

describe('rotas do app: sem sessão vai para /entrar?volta=', () => {
  it('guarda o caminho e a consulta no volta', () => {
    expect(decidirRotaDoApp(semSessao, '/app/lancamentos', '?mes=2026-10-01')).toEqual({
      tipo: 'ir',
      para: '/entrar?volta=%2Fapp%2Flancamentos%3Fmes%3D2026-10-01',
    });
  });

  it('enquanto carrega a sessão, espera (não pisca a tela de entrada)', () => {
    expect(decidirRotaDoApp(carregando, '/app')).toEqual({ tipo: 'esperar' });
    expect(decidirRotaPublica(carregando, { redirecionaComSessao: true })).toEqual({ tipo: 'esperar' });
  });

  it('sem rede mas com usuário lembrado neste aparelho, o app abre (lançar offline)', () => {
    expect(decidirRotaDoApp(presumida, '/app')).toEqual({ tipo: 'seguir' });
  });
});

describe('rotas do app: com sessão', () => {
  it('sessão com lar segue', () => {
    expect(decidirRotaDoApp(ativa(), '/app/metas')).toEqual({ tipo: 'seguir' });
  });

  it('termos pendentes levam ao aceite, de qualquer tela', () => {
    expect(decidirRotaDoApp(ativa({ termos_pendentes: true }), '/app')).toEqual({ tipo: 'ir', para: ROTA_TERMOS });
    expect(decidirRotaDoApp(ativa({ termos_pendentes: true }), ROTA_TERMOS)).toEqual({ tipo: 'seguir' });
  });

  it('sem termos pendentes a tela de aceite volta ao início', () => {
    expect(decidirRotaDoApp(ativa(), ROTA_TERMOS)).toEqual({ tipo: 'ir', para: ROTA_INICIO });
  });

  it('sessão sem lar vai para /app/bem-vindo, menos em bem-vindo e em ajustes/conta', () => {
    const semLar = ativa({ lar: null });
    expect(decidirRotaDoApp(semLar, '/app/lancamentos')).toEqual({ tipo: 'ir', para: ROTA_BEM_VINDO });
    expect(decidirRotaDoApp(semLar, ROTA_BEM_VINDO)).toEqual({ tipo: 'seguir' });
    expect(decidirRotaDoApp(semLar, '/app/ajustes/conta')).toEqual({ tipo: 'seguir' });
  });

  it('com lar, /app/bem-vindo volta ao início', () => {
    expect(decidirRotaDoApp(ativa(), ROTA_BEM_VINDO)).toEqual({ tipo: 'ir', para: ROTA_INICIO });
  });

  it('termos pendentes valem antes da checagem do lar', () => {
    expect(decidirRotaDoApp(ativa({ lar: null, termos_pendentes: true }), '/app')).toEqual({
      tipo: 'ir',
      para: ROTA_TERMOS,
    });
  });
});

describe('telas de acesso', () => {
  it('Entrar e Cadastro mandam quem já entrou para o app', () => {
    expect(decidirRotaPublica(ativa(), { redirecionaComSessao: true })).toEqual({ tipo: 'ir', para: '/app' });
    expect(decidirRotaPublica(presumida, { redirecionaComSessao: true })).toEqual({ tipo: 'ir', para: '/app' });
  });

  it('depois do login volta para onde a pessoa estava', () => {
    expect(decidirRotaPublica(ativa(), { redirecionaComSessao: true, volta: '/app/metas' })).toEqual({
      tipo: 'ir',
      para: '/app/metas',
    });
  });

  it('sem sessão, Entrar segue', () => {
    expect(decidirRotaPublica(semSessao, { redirecionaComSessao: true })).toEqual({ tipo: 'seguir' });
  });

  it('Redefinir senha e Confirmar seguem mesmo com sessão (o link com token não pode se perder)', () => {
    expect(decidirRotaPublica(ativa(), { redirecionaComSessao: false })).toEqual({ tipo: 'seguir' });
  });
});

describe('destinoDeVolta: nunca um redirecionamento aberto', () => {
  it.each(['/app', '/app/lancamentos', '/app/lancamentos?mes=2026-10-01', '/app/metas#topo'])('aceita %s', (v) => {
    expect(destinoDeVolta(v)).toBe(v);
  });

  it.each([
    'https://mau.exemplo/app',
    '//mau.exemplo/app',
    '/app//mau.exemplo',
    '/\\mau.exemplo',
    '/apple',
    '/entrar',
    '/api/sessao',
    'app/metas',
    '/app/\nx',
    `/app/${'a'.repeat(600)}`,
    '',
    null,
    undefined,
  ])('recusa %j e volta ao início', (v) => {
    expect(destinoDeVolta(v as string | null | undefined)).toBe('/app');
  });
});
