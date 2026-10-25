import type { EntradaSalvarCategoria, SaidaLinhaCategorias } from '@controle/contrato';
import { categoriaPodeMudar, normalizarCategoria } from '@controle/dominio';
import {
  arquivarCategoria as arquivarCategoriaNoBanco,
  atualizarCategoria,
  buscarCategoriaVisivel,
  excluirCategoria as excluirCategoriaNoBanco,
  inserirCategoriaSeLivre,
  listarCategoriasVisiveis,
} from '../../infraestrutura/db/repositorios/categorias';
import { travarEscritaPorId } from '../../infraestrutura/db/repositorios/idempotencia';
import {
  erroCategoriaEmUso,
  erroRegistroInvalido,
  erroValorInvalido,
  excluirComVinculo,
  vinculoDe,
  type DepsLar,
  type ResultadoSalvar,
} from './comum';

const visaoDe = (deps: DepsLar) => {
  const v = vinculoDe(deps);
  return { larId: v.larId, membroId: v.membroId };
};

/** `GET /api/categorias` (RN-17): conjuntas do lar e individuais do próprio membro; a do outro nunca aparece. */
export async function listarCategorias(deps: DepsLar): Promise<SaidaLinhaCategorias[]> {
  return listarCategoriasVisiveis(deps.tx, visaoDe(deps));
}

/**
 * `PUT /api/categorias/:id` (RN-17; ADR-010): cria ou atualiza. Receita é sempre individual e sem a marca
 * variável (CA-17.1); tipo e escopo não mudam (`valor_invalido`). Conjunta: qualquer membro do lar; individual:
 * só o dono (a do outro não é visível: `registro_invalido`). Nome repetido no mesmo (lar, tipo, escopo, dono):
 * `nome_repetido` (23505 em `categoria_unica`, traduzido). Não mexe em `arquivada`. Origem: A salvar_categoria.sql.
 */
export async function salvarCategoria(
  deps: DepsLar,
  id: string,
  entrada: EntradaSalvarCategoria,
): Promise<ResultadoSalvar> {
  const visao = visaoDe(deps);
  const dados = normalizarCategoria(entrada);
  if (!dados.ok) throw erroValorInvalido();
  const categoria = dados.valor;

  await travarEscritaPorId(deps.tx, id);
  let atual = await buscarCategoriaVisivel(deps.tx, { ...visao, id });
  if (!atual) {
    const criou = await inserirCategoriaSeLivre(deps.tx, { ...visao, id, ...categoria, agora: deps.agora });
    if (criou) return { id, criado: true };
    // O id já existe: do mesmo membro (corrida entre dois reenvios) ou de quem a RLS esconde.
    atual = await buscarCategoriaVisivel(deps.tx, { ...visao, id });
    if (!atual) throw erroRegistroInvalido();
  }
  if (!categoriaPodeMudar(atual, categoria)) throw erroValorInvalido();
  await atualizarCategoria(deps.tx, { ...visao, id, nome: categoria.nome, variavel: categoria.variavel });
  return { id, criado: false };
}

/** `POST /api/categorias/:id/arquivar` (idempotente; só o estado muda). */
export async function arquivarCategoria(deps: DepsLar, id: string): Promise<void> {
  if ((await arquivarCategoriaNoBanco(deps.tx, { ...visaoDe(deps), id })) !== 1) throw erroRegistroInvalido();
}

/** `DELETE /api/categorias/:id`: com vínculo → `categoria_em_uso`; alheia ou inexistente → `registro_invalido`. */
export async function excluirCategoria(deps: DepsLar, id: string): Promise<void> {
  const visao = visaoDe(deps);
  await excluirComVinculo(() => excluirCategoriaNoBanco(deps.tx, { ...visao, id }), erroCategoriaEmUso);
}
