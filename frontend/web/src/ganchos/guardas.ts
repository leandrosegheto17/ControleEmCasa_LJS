import type { SaidaSessaoAtual } from '@controle/contrato';

/**
 * Regras das guardas de rota (SDD 9.3), sem React: dado o estado da sessão e o caminho, para onde ir.
 * "Estou logado?" vem sempre de `GET /api/sessao` (o cookie é HttpOnly, o front não o lê).
 */

export const ROTA_ENTRAR = '/entrar';
export const ROTA_INICIO = '/app';
export const ROTA_BEM_VINDO = '/app/bem-vindo';
export const ROTA_TERMOS = '/app/aceitar-termos';
/** Telas do app que exigem sessão, mas não exigem lar (SDD 9.3: `/app/ajustes/conta` é "sessão"). */
const SEM_LAR = new Set([ROTA_BEM_VINDO, ROTA_TERMOS, '/app/ajustes/conta']);

export type EstadoSessao =
  | { situacao: 'carregando' }
  | { situacao: 'sem-sessao' }
  /** Sem rede para perguntar ao servidor, mas há um usuário lembrado deste aparelho: o app abre para lançar offline. */
  | { situacao: 'presumida' }
  | { situacao: 'ativa'; sessao: SaidaSessaoAtual };

export type Decisao = { tipo: 'esperar' } | { tipo: 'seguir' } | { tipo: 'ir'; para: string };

const esperar: Decisao = { tipo: 'esperar' };
const seguir: Decisao = { tipo: 'seguir' };
const ir = (para: string): Decisao => ({ tipo: 'ir', para });

/**
 * Destino de volta depois do login (`/entrar?volta=`): só caminhos do app (`/app` e abaixo). Qualquer outra coisa
 * (outro site, `//host`, barra invertida, caractere de controle) vira o início, para não haver redirecionamento aberto.
 */
export function destinoDeVolta(volta: string | null | undefined): string {
  if (!volta || volta.length > 500) return ROTA_INICIO;
  if (!/^\/app(?:[/?#]|$)/.test(volta)) return ROTA_INICIO;
  const proibido = [...volta].some((c) => c === '\\' || c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
  if (proibido || volta.includes('//')) return ROTA_INICIO;
  return volta;
}

/** Telas de acesso. `redirecionaComSessao`: quem já entrou vai para o app (`/entrar`, `/cadastro`). */
export function decidirRotaPublica(
  estado: EstadoSessao,
  opcoes: { redirecionaComSessao: boolean; volta?: string | null },
): Decisao {
  if (estado.situacao === 'carregando') return esperar;
  if (opcoes.redirecionaComSessao && (estado.situacao === 'ativa' || estado.situacao === 'presumida')) {
    return ir(destinoDeVolta(opcoes.volta));
  }
  return seguir;
}

/** Telas de `/app/*`. `caminho` é o `pathname`; `busca` guarda a consulta para o `volta` do login. */
export function decidirRotaDoApp(estado: EstadoSessao, caminho: string, busca = ''): Decisao {
  switch (estado.situacao) {
    case 'carregando':
      return esperar;
    case 'sem-sessao':
      return ir(`${ROTA_ENTRAR}?volta=${encodeURIComponent(`${caminho}${busca}`)}`);
    case 'presumida':
      return seguir;
    case 'ativa': {
      const { sessao } = estado;
      if (sessao.termos_pendentes) return caminho === ROTA_TERMOS ? seguir : ir(ROTA_TERMOS);
      if (caminho === ROTA_TERMOS) return ir(ROTA_INICIO);
      if (sessao.lar === null) return SEM_LAR.has(caminho) ? seguir : ir(ROTA_BEM_VINDO);
      if (caminho === ROTA_BEM_VINDO) return ir(ROTA_INICIO);
      return seguir;
    }
  }
}
