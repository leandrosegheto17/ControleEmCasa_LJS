import type { EntradaSalvarFixa, SaidaLinhaDespesasFixas } from '@controle/contrato';
import {
  fixaPodeSerEditada,
  hojeEmSaoPaulo,
  inicioMes,
  normalizarFixa,
  vencimentoDaOcorrencia,
} from '@controle/dominio';
import { buscarCategoriaVisivel } from '../../infraestrutura/db/repositorios/categorias';
import {
  apagarPendentesDepoisDe,
  atualizarFixa,
  atualizarOcorrenciaPendente,
  buscarFixaDoLar,
  encerrarFixa as encerrarFixaNoBanco,
  inserirFixaSeLivre,
  listarFixasDoLar,
  pendentesDaFixaDesde,
} from '../../infraestrutura/db/repositorios/fixas';
import { travarEscritaPorId } from '../../infraestrutura/db/repositorios/idempotencia';
import type { ResultadoSalvar } from '../cadastros/comum';
import { erroRegistroInvalido, erroValorInvalido, vinculoDe, type DepsLar } from '../lancamentos/comum';

/**
 * Modelos de despesa fixa (RN-15; SDD 6.1 #27 a #29). A fixa é do lar: qualquer membro cria, edita e encerra; é
 * sempre conjunta de despesa; não se exclui. O lar vem do vínculo derivado no banco (G-03).
 */

/** `GET /api/fixas` (#27): os modelos do lar, encerrados inclusive (com `encerrada_em`). */
export async function listarFixas(deps: DepsLar): Promise<SaidaLinhaDespesasFixas[]> {
  return listarFixasDoLar(deps.tx, vinculoDe(deps).larId);
}

/**
 * `PUT /api/fixas/:id` (#28; RN-15; CA-15.9; ADR-010): cria ou edita, idempotente pelo id do cliente.
 * Ordem das recusas (a do legado, como nos cadastros da etapa 7): `valor_invalido` do corpo (descrição, previsto,
 * dia) → `registro_invalido` (categoria que não é conjunta de despesa do lar: individual, de receita, de outro lar
 * ou inexistente; id de fixa de outro lar) → `valor_invalido` (fixa encerrada não é editada).
 * Editar previsto ou dia atualiza as ocorrências PENDENTES do mês corrente em diante; as pagas e os meses passados
 * ficam intactos. A categoria arquivada é aceita, como no legado (o `*_arquivada` vale só nos lançamentos; decisão
 * da etapa 7). Origem: A salvar_despesa_fixa.sql.
 */
export async function salvarFixa(deps: DepsLar, id: string, entrada: EntradaSalvarFixa): Promise<ResultadoSalvar> {
  const v = vinculoDe(deps);
  const modelo = normalizarFixa({
    descricao: entrada.descricao,
    valorPrevistoCentavos: entrada.valor_previsto_centavos,
    diaVencimento: entrada.dia_vencimento,
  });
  if (!modelo.ok) throw erroValorInvalido();
  const m = modelo.valor;

  const categoria = await buscarCategoriaVisivel(deps.tx, {
    id: entrada.categoria_id,
    larId: v.larId,
    membroId: v.membroId,
  });
  if (!categoria || categoria.tipo !== 'despesa' || categoria.escopo !== 'conjunto') throw erroRegistroInvalido();

  await travarEscritaPorId(deps.tx, id);
  const hoje = hojeEmSaoPaulo(deps.agora);
  let atual = await buscarFixaDoLar(deps.tx, { id, larId: v.larId });
  if (!atual) {
    const criou = await inserirFixaSeLivre(deps.tx, {
      id,
      larId: v.larId,
      descricao: m.descricao,
      categoriaId: categoria.id,
      valorPrevistoCentavos: m.valorPrevistoCentavos,
      diaVencimento: m.diaVencimento,
      inicio: inicioMes(hoje),
      agora: deps.agora,
    });
    if (criou) return { id, criado: true };
    // O id já existe e a RLS o esconde (fixa de outro lar): RT-03.
    atual = await buscarFixaDoLar(deps.tx, { id, larId: v.larId });
    if (!atual) throw erroRegistroInvalido();
  }
  if (!fixaPodeSerEditada(atual.encerrada_em).ok) throw erroValorInvalido();

  await atualizarFixa(deps.tx, {
    id,
    larId: v.larId,
    descricao: m.descricao,
    categoriaId: categoria.id,
    valorPrevistoCentavos: m.valorPrevistoCentavos,
    diaVencimento: m.diaVencimento,
  });
  for (const o of await pendentesDaFixaDesde(deps.tx, { fixaId: id, larId: v.larId, desde: inicioMes(hoje) })) {
    const vencimento = vencimentoDaOcorrencia(o.mes, m.diaVencimento);
    if (!vencimento.ok) throw erroValorInvalido();
    await atualizarOcorrenciaPendente(deps.tx, {
      id: o.id,
      larId: v.larId,
      vencimento: vencimento.valor,
      valorPrevistoCentavos: m.valorPrevistoCentavos,
    });
  }
  return { id, criado: false };
}

/**
 * `POST /api/fixas/:id/encerrar` (#29; RN-15; CA-15.4, CA-T3.5): grava `encerrada_em` = hoje só na primeira vez e
 * apaga as ocorrências pendentes dos meses em que a fixa deixa de gerar (depois do mês do encerramento); a do mês
 * do encerramento fica e as pagas nunca são apagadas. Qualquer membro encerra. Inexistente ou de outro lar:
 * `registro_invalido`. Origem: A encerrar_despesa_fixa.sql.
 */
export async function encerrarFixa(deps: DepsLar, id: string): Promise<void> {
  const v = vinculoDe(deps);
  const r = await encerrarFixaNoBanco(deps.tx, { id, larId: v.larId, hoje: hojeEmSaoPaulo(deps.agora) });
  if (!r) throw erroRegistroInvalido();
  await apagarPendentesDepoisDe(deps.tx, { fixaId: id, larId: v.larId, mes: inicioMes(r.encerrada_em) });
}
