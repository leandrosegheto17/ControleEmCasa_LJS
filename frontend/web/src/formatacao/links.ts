import type { Escopo } from '../comum/enums';
import { paraEscopoUrl } from './escopoUrl';

/** `mes` vem primeiro na URL; os demais parâmetros seguem a ordem recebida e os ausentes ficam de fora. */
function montar(caminho: string, mes: string, parametros: Record<string, string | undefined> = {}): string {
  const busca = new URLSearchParams({ mes });
  for (const [nome, valor] of Object.entries(parametros)) if (valor !== undefined) busca.set(nome, valor);
  return `${caminho}?${busca.toString()}`;
}

export const linkLancamentos = (a: { mes: string; escopo: Escopo; categoria?: string }) =>
  montar('/lancamentos', a.mes, { escopo: paraEscopoUrl(a.escopo), categoria: a.categoria });

export const linkOrcamento = (a: { mes: string; escopo: Escopo; editar?: string }) =>
  montar('/orcamento', a.mes, { escopo: paraEscopoUrl(a.escopo), editar: a.editar });

/** `pagar` abre a tela de marcar como paga para a despesa fixa (D-14). */
export const linkFixas = (a: { mes: string; pagar?: string }) => montar('/fixas', a.mes, { pagar: a.pagar });

/** Folha de envios pendentes, lida pela própria tela quando existir. */
export const linkEnvios = (mes: string) => montar('/', mes, { envios: '1' });

/** `movimentar` abre a folha de aporte ou retirada sobre o detalhe da meta. */
export const linkMeta = (id: string, a: { movimentar?: 'aporte' | 'retirada' } = {}) =>
  a.movimentar === undefined ? `/metas/${id}` : `/metas/${id}?movimentar=${a.movimentar}`;
export const linkConta = (id: string) => `/ajustes/contas/${id}`;
export const linkForma = (id: string) => `/ajustes/formas/${id}`;
