import type { SaidaLinhaMetas, SaidaMovimentoMeta, EntradaMovimentarMeta, EntradaSalvarMeta } from '@controle/contrato';
import {
  atingidaEm,
  hojeEmSaoPaulo,
  movimentoCabeNoLocal,
  normalizarMeta,
  normalizarMovimentoMeta,
  progressoMeta,
  type DataCalendario,
} from '@controle/dominio';
import { ErroApi } from '../../erros';
import { buscarContaDoDono } from '../../infraestrutura/db/repositorios/contas';
import { travarEscritaPorId } from '../../infraestrutura/db/repositorios/idempotencia';
import {
  atualizarMeta,
  autorDoMovimento,
  buscarMetaVisivel,
  gravarAtingidaEm,
  guardadoNoLocal,
  guardadoPorLocal,
  inserirMetaSeLivre,
  inserirMovimentoDeConta,
  inserirMovimentoSeLivre,
  listarMetasVisiveis,
  locaisUsados,
  movimentosDaMeta,
  type MetaGravada,
} from '../../infraestrutura/db/repositorios/metas';
import type { ResultadoSalvar } from '../cadastros/comum';
import { erroRegistroInvalido, erroValorInvalido, vinculoDe, type DepsLar } from '../lancamentos/comum';

const colacao = new Intl.Collator('pt-BR');

export const erroRetiradaMaiorQueGuardado = () =>
  new ErroApi(422, 'retirada_maior_que_guardado', 'A retirada é maior que o valor guardado neste local.');

/** Progresso da meta (RN-08): guardado vem do SQL; o resto é do domínio puro. */
function progressoDe(meta: MetaGravada, hoje: DataCalendario, alvoCentavos = meta.alvo_centavos) {
  return progressoMeta({ alvoCentavos, guardadoCentavos: meta.guardado_centavos, prazo: meta.prazo, hoje });
}

/** A meta como linha do contrato: prazo em `AAAA-MM`, progresso derivado dos movimentos. */
export function linhaDaMeta(meta: MetaGravada, hoje: DataCalendario): SaidaLinhaMetas {
  const p = progressoDe(meta, hoje);
  return {
    id: meta.id,
    nome: meta.nome,
    escopo: meta.escopo,
    alvo_centavos: meta.alvo_centavos,
    guardado_centavos: p.guardadoCentavos,
    falta_centavos: p.faltaCentavos,
    percentual: p.percentual,
    prazo: meta.prazo === null ? null : meta.prazo.slice(0, 7),
    mensal_necessario_centavos: p.mensalNecessarioCentavos,
    atingida: p.atingida,
  };
}

/** `GET /api/metas` (#37): as metas visíveis, não atingidas primeiro, depois por nome. */
export async function listarMetas(deps: DepsLar): Promise<SaidaLinhaMetas[]> {
  const v = vinculoDe(deps);
  const hoje = hojeEmSaoPaulo(deps.agora);
  const metas = await listarMetasVisiveis(deps.tx, { larId: v.larId, membroId: v.membroId });
  return metas
    .map((m) => linhaDaMeta(m, hoje))
    .sort((a, b) => Number(a.atingida) - Number(b.atingida) || colacao.compare(a.nome, b.nome));
}

/** `GET /api/metas/:id` (#37): a meta com o guardado por local. Inexistente ou individual do outro: `registro_invalido`. */
export async function detalheDaMeta(deps: DepsLar, id: string): Promise<SaidaLinhaMetas> {
  const v = vinculoDe(deps);
  const meta = await buscarMetaVisivel(deps.tx, { larId: v.larId, membroId: v.membroId, id });
  if (!meta) throw erroRegistroInvalido();
  return { ...linhaDaMeta(meta, hojeEmSaoPaulo(deps.agora)), por_local: await guardadoPorLocal(deps.tx, id) };
}

/**
 * Reavalia `atingida_em` a partir do guardado atual (CA-08.3, CA-08.4): marca com hoje quando a meta passa a estar
 * atingida (mantém a data original), desmarca quando deixa de estar. Só grava quando muda.
 */
async function sincronizarAtingida(deps: DepsLar, meta: MetaGravada): Promise<void> {
  const v = vinculoDe(deps);
  const hoje = hojeEmSaoPaulo(deps.agora);
  const novo = atingidaEm({
    atingidaEmAtual: meta.atingida_em,
    atingida: progressoDe(meta, hoje).atingida,
    hoje,
  });
  if (novo !== meta.atingida_em) {
    await gravarAtingidaEm(deps.tx, { larId: v.larId, membroId: v.membroId, id: meta.id, atingidaEm: novo });
  }
}

/**
 * `PUT /api/metas/:id` (#38; RN-08; CA-08.1, CA-08.2, CA-08.4; ADR-010): cria ou edita, idempotente pelo id do
 * cliente. A meta nasce com guardado 0, sem movimento. O escopo só vale na criação (obrigatório nela): na edição um
 * escopo diferente do gravado é `valor_invalido` e a ausência é aceita. O prazo é gravado como dia 1 do mês. Editar o
 * alvo reavalia `atingida_em`. Ordem das recusas (a do legado): `valor_invalido` do corpo → (meta existente)
 * `valor_invalido` de escopo trocado → (meta nova) `valor_invalido` de escopo ausente → `registro_invalido` (id de
 * meta que a RLS esconde: individual do outro membro ou de outro lar). Origem: A salvar_meta.sql.
 */
export async function salvarMeta(deps: DepsLar, id: string, entrada: EntradaSalvarMeta): Promise<ResultadoSalvar> {
  const v = vinculoDe(deps);
  const visao = { larId: v.larId, membroId: v.membroId };
  const dados = normalizarMeta({ nome: entrada.nome, alvoCentavos: entrada.alvo_centavos, prazo: entrada.prazo });
  if (!dados.ok) throw erroValorInvalido();
  const m = dados.valor;

  await travarEscritaPorId(deps.tx, id);
  const travada = await buscarMetaVisivel(deps.tx, { ...visao, id, travar: true });
  // Relida depois da trava, em outra consulta: o guardado enxerga o movimento que a requisição anterior confirmou.
  const atual = travada && (await buscarMetaVisivel(deps.tx, { ...visao, id }));
  if (atual) {
    if (entrada.escopo !== undefined && entrada.escopo !== atual.escopo) throw erroValorInvalido();
    await atualizarMeta(deps.tx, { ...visao, id, nome: m.nome, alvoCentavos: m.alvoCentavos, prazo: m.prazo });
    await sincronizarAtingida(deps, { ...atual, alvo_centavos: m.alvoCentavos, prazo: m.prazo });
    return { id, criado: false };
  }
  if (entrada.escopo === undefined) throw erroValorInvalido();
  const criou = await inserirMetaSeLivre(deps.tx, {
    ...visao,
    id,
    nome: m.nome,
    alvoCentavos: m.alvoCentavos,
    prazo: m.prazo,
    escopo: entrada.escopo,
    agora: deps.agora,
  });
  // O id já existe e a RLS o esconde (individual do outro membro ou de outro lar): RT-03.
  if (!criou) throw erroRegistroInvalido();
  return { id, criado: true };
}

/**
 * `POST /api/metas/:id/movimentos` (#39; RN-08, RN-09; CA-08.3, CA-09.1 a CA-09.4; ADR-010): aporte ou retirada.
 * Ordem (a do legado): `valor_invalido` (tipo, valor, local) → reenvio do mesmo id pelo mesmo autor (devolve o
 * gravado, sem gravar de novo e sem comparar o corpo; de outro autor: `registro_invalido`) → `registro_invalido`
 * (meta inexistente, de outro lar ou individual do outro membro) → `registro_invalido` (conta que não é do autor,
 * arquivada ou inexistente) → `retirada_maior_que_guardado` (limite do guardado NAQUELE local).
 * A meta é travada (`for update`) antes de ler o guardado: duas retiradas simultâneas se serializam e só a que cabe
 * passa (CA-09.2). Com conta, grava o movimento de conta privado do autor (aporte debita, retirada credita) e a
 * resposta é só o id (a conta nunca volta para o outro membro). Reavalia `atingida_em` ao final.
 */
export async function movimentarMeta(
  deps: DepsLar,
  metaId: string,
  entrada: EntradaMovimentarMeta,
): Promise<ResultadoSalvar> {
  const v = vinculoDe(deps);
  const visao = { larId: v.larId, membroId: v.membroId };
  const dados = normalizarMovimentoMeta({
    tipo: entrada.tipo,
    valorCentavos: entrada.valor_centavos,
    local: entrada.local,
  });
  if (!dados.ok) throw erroValorInvalido();
  const mov = dados.valor;
  const data = entrada.data ?? hojeEmSaoPaulo(deps.agora);

  await travarEscritaPorId(deps.tx, entrada.id);
  const autor = await autorDoMovimento(deps.tx, entrada.id);
  if (autor !== null) {
    if (autor === v.membroId) return { id: entrada.id, criado: false };
    throw erroRegistroInvalido();
  }

  const meta = await buscarMetaVisivel(deps.tx, { ...visao, id: metaId, travar: true });
  if (!meta) throw erroRegistroInvalido();

  if (entrada.conta_id) {
    const conta = await buscarContaDoDono(deps.tx, { id: entrada.conta_id, donoId: v.membroId });
    if (!conta || conta.arquivada) throw erroRegistroInvalido();
  }

  // Lido depois da trava, em outra consulta: enxerga o que a retirada anterior já confirmou.
  const noLocal = await guardadoNoLocal(deps.tx, { metaId, local: mov.local });
  if (!movimentoCabeNoLocal({ tipo: mov.tipo, valorCentavos: mov.valorCentavos, guardadoNoLocalCentavos: noLocal })) {
    throw erroRetiradaMaiorQueGuardado();
  }

  const gravou = await inserirMovimentoSeLivre(deps.tx, {
    ...visao,
    id: entrada.id,
    metaId,
    tipo: mov.tipo,
    valorCentavos: mov.valorCentavos,
    data,
    local: mov.local,
    agora: deps.agora,
  });
  // O id já existe e a RLS o esconde (movimento de meta que o autor não vê): RT-03.
  if (!gravou) throw erroRegistroInvalido();

  if (entrada.conta_id) {
    await inserirMovimentoDeConta(deps.tx, {
      ...visao,
      contaId: entrada.conta_id,
      movimentoMetaId: entrada.id,
      tipo: mov.tipo,
      valorCentavos: mov.valorCentavos,
      data,
      agora: deps.agora,
    });
  }

  const depois = await buscarMetaVisivel(deps.tx, { ...visao, id: metaId });
  if (!depois) throw new Error('meta_sumiu');
  await sincronizarAtingida(deps, depois);
  return { id: entrada.id, criado: true };
}

/**
 * `GET /api/metas/:id/movimentos` (#40; RN-08; CA-08.5): do mais recente ao mais antigo. Os dois membros veem valor,
 * data, local e autor da meta conjunta; a chave `conta` só existe nas linhas do próprio autor. Meta inexistente ou
 * individual do outro membro: `registro_invalido`; meta visível sem movimentos: lista vazia.
 */
export async function listarMovimentos(deps: DepsLar, metaId: string): Promise<SaidaMovimentoMeta[]> {
  const v = vinculoDe(deps);
  const meta = await buscarMetaVisivel(deps.tx, { larId: v.larId, membroId: v.membroId, id: metaId });
  if (!meta) throw erroRegistroInvalido();
  const movimentos = await movimentosDaMeta(deps.tx, { metaId, membroId: v.membroId });
  return movimentos.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    valor_centavos: m.valor_centavos,
    data: m.data,
    local: m.local,
    autor: { nome: m.autor_nome, sou_eu: m.autor_sou_eu },
    ...(m.conta_nome === null ? {} : { conta: { nome: m.conta_nome } }),
  }));
}

/** `GET /api/metas/locais` (#41; CA-09.5, CA-02.3): locais já usados nas metas visíveis, do uso mais recente ao mais antigo. */
export async function listarLocais(deps: DepsLar): Promise<string[]> {
  const v = vinculoDe(deps);
  return locaisUsados(deps.tx, { larId: v.larId, membroId: v.membroId });
}
