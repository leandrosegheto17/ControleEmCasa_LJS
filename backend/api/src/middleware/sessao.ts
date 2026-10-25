import type { Context } from 'hono';
import type { AppEnv, Sessao } from '../env';
import { validarERenovar } from '../infraestrutura/db/repositorios/sessoes';
import { hashToken } from '../infraestrutura/seguranca/token';
import { lerTokenSessao, limparCookieSessao, temCookieSessao } from '../infraestrutura/sessao/cookie';

/**
 * Sessão da requisição (SDD 5.1 passo 6; RN-20): lê `__Host-sid`, calcula o SHA-256 e valida e renova numa
 * única instrução (15 min de inatividade, 12 h absolutas). Cookie ausente, malformado, repetido, desconhecido,
 * revogado ou vencido: sem sessão (a rota autenticada responde `sessao_expirada`, CA-20.6) e o cookie é limpo.
 */
export async function sessaoDoCookie(c: Context<AppEnv>): Promise<Sessao | null> {
  const token = lerTokenSessao(c);
  if (!token) {
    if (temCookieSessao(c)) limparCookieSessao(c);
    return null;
  }
  const valida = await validarERenovar(c.get('db'), await hashToken(token), c.get('agora'));
  if (!valida) {
    limparCookieSessao(c);
    return null;
  }
  // O lar não vem da sessão: é derivado de `app.membro` ao abrir a transação (SDD 5.3; G-03).
  return { usuarioId: valida.usuarioId, email: valida.email };
}
