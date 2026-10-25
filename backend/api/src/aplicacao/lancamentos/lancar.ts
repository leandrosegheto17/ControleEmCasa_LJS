import type { EntradaLancarDespesa, EntradaLancarReceita, SaidaLancamentoGravado } from '@controle/contrato';
import {
  calcularParcelas,
  diaVencimentoAplicado,
  hojeEmSaoPaulo,
  normalizarTextoOpcional,
  validarNumParcelas,
  validarValorLancamento,
} from '@controle/dominio';
import { buscarCategoriaVisivel } from '../../infraestrutura/db/repositorios/categorias';
import { buscarContaDoDono } from '../../infraestrutura/db/repositorios/contas';
import { buscarFormaDoDono } from '../../infraestrutura/db/repositorios/formas';
import { travarEscritaPorId } from '../../infraestrutura/db/repositorios/idempotencia';
import {
  buscarGravadoDoDono,
  buscarLancamentoVisivel,
  inserirLancamentoSeLivre,
  inserirPagamento,
  inserirParcelas,
} from '../../infraestrutura/db/repositorios/lancamentos';
import {
  erroCategoriaArquivada,
  erroContaArquivada,
  erroFormaArquivada,
  erroRegistroInvalido,
  erroValorInvalido,
  vinculoDe,
  type DepsLar,
} from './comum';

/** Resultado de lançar: `criado` decide entre 201 e 200 (ADR-010; decisão do usuário: `ja_existia` no corpo). */
export interface ResultadoLancar {
  criado: boolean;
  corpo: SaidaLancamentoGravado;
}

/**
 * Idempotência pelo id do cliente (RT-03; CA-T3.1, CA-T3.2): com o id travado (ADR-010 item 4), um lançamento já
 * gravado por ESTE membro devolve o gravado com `ja_existia: true`, sem comparar o corpo do reenvio; um id visível
 * de outro membro (a conjunta dele) é `registro_invalido`. Id invisível segue: o insert não grava e vira
 * `registro_invalido` adiante. Origem: F resposta_lancamento.sql:25-46.
 */
async function jaGravado(deps: DepsLar, id: string): Promise<ResultadoLancar | null> {
  const v = vinculoDe(deps);
  await travarEscritaPorId(deps.tx, id);
  const existente = await buscarLancamentoVisivel(deps.tx, { id, larId: v.larId, membroId: v.membroId });
  if (!existente) return null;
  if (existente.dono_id !== v.membroId) throw erroRegistroInvalido();
  return { criado: false, corpo: await gravado(deps, id, true) };
}

async function gravado(deps: DepsLar, id: string, jaExistia: boolean): Promise<SaidaLancamentoGravado> {
  const r = await buscarGravadoDoDono(deps.tx, { id, donoId: vinculoDe(deps).membroId });
  if (!r) throw erroRegistroInvalido();
  return { ...r, ja_existia: jaExistia };
}

/**
 * `POST /api/lancamentos/despesas` (#20; RN-01, RN-05, RN-14, RN-18; CA-01.1 a CA-01.3, CA-14.2).
 * Ordem das recusas (RT-02, com a exceção herdada: o valor vem depois da idempotência e antes da categoria):
 * idempotência → `valor_invalido` (valor) → `registro_invalido` (categoria de despesa visível; forma do membro)
 * → `valor_invalido` (descrição, nº de parcelas da forma, total ≥ N) → `categoria_arquivada` → `forma_arquivada`.
 * O escopo vem da categoria; o pagador é quem lança. Origem: A lancar_despesa.sql.
 */
export async function lancarDespesa(deps: DepsLar, entrada: EntradaLancarDespesa): Promise<ResultadoLancar> {
  const v = vinculoDe(deps);
  const repetido = await jaGravado(deps, entrada.id);
  if (repetido) return repetido;

  const valor = validarValorLancamento(entrada.valor_centavos);
  if (!valor.ok) throw erroValorInvalido();

  const categoria = await buscarCategoriaVisivel(deps.tx, {
    id: entrada.categoria_id,
    larId: v.larId,
    membroId: v.membroId,
  });
  if (!categoria || categoria.tipo !== 'despesa') throw erroRegistroInvalido();
  const forma = await buscarFormaDoDono(deps.tx, { id: entrada.forma_id, donoId: v.membroId });
  if (!forma) throw erroRegistroInvalido();

  const descricao = normalizarTextoOpcional(entrada.descricao);
  if (!descricao.ok) throw erroValorInvalido();
  const numParcelas = validarNumParcelas(forma.tipo, entrada.parcelas ?? 1);
  if (!numParcelas.ok) throw erroValorInvalido();
  const data = entrada.data ?? hojeEmSaoPaulo(deps.agora);
  const formaDominio = { tipo: forma.tipo, diaVencimento: forma.dia_vencimento };
  const parcelas = calcularParcelas({
    tipo: forma.tipo,
    data,
    diaVencimento: forma.dia_vencimento,
    numParcelas: numParcelas.valor,
    totalCentavos: valor.valor,
  });
  if (!parcelas.ok) throw erroValorInvalido();

  if (categoria.arquivada) throw erroCategoriaArquivada();
  if (forma.arquivada) throw erroFormaArquivada();

  const criou = await inserirLancamentoSeLivre(deps.tx, {
    id: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    tipo: 'despesa',
    escopo: categoria.escopo,
    categoriaId: categoria.id,
    descricao: descricao.valor,
    valorTotalCentavos: valor.valor,
    numParcelas: numParcelas.valor,
    agora: deps.agora,
  });
  // O id existe e a RLS o esconde (individual do outro membro ou de outro lar): RT-03.
  if (!criou) throw erroRegistroInvalido();
  await inserirPagamento(deps.tx, {
    lancamentoId: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    formaId: forma.id,
    contaId: forma.tipo === 'credito' ? null : forma.conta_id,
    dataOperacao: data,
    diaVencimentoAplicado: diaVencimentoAplicado(formaDominio),
  });
  await inserirParcelas(deps.tx, {
    lancamentoId: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    escopo: categoria.escopo,
    parcelas: parcelas.valor,
  });
  return { criado: true, corpo: await gravado(deps, entrada.id, false) };
}

/**
 * `POST /api/lancamentos/receitas` (#21; RN-12, RN-17, RN-18). Receita é sempre individual, 1 parcela na data,
 * sem forma; a conta de destino é do próprio membro. Ordem das recusas: idempotência → `valor_invalido` (valor)
 * → `registro_invalido` (categoria de receita do membro; conta do membro) → `valor_invalido` (descrição) →
 * `categoria_arquivada` → `conta_arquivada`. Origem: A lancar_receita.sql.
 */
export async function lancarReceita(deps: DepsLar, entrada: EntradaLancarReceita): Promise<ResultadoLancar> {
  const v = vinculoDe(deps);
  const repetido = await jaGravado(deps, entrada.id);
  if (repetido) return repetido;

  const valor = validarValorLancamento(entrada.valor_centavos);
  if (!valor.ok) throw erroValorInvalido();

  const categoria = await buscarCategoriaVisivel(deps.tx, {
    id: entrada.categoria_id,
    larId: v.larId,
    membroId: v.membroId,
  });
  if (!categoria || categoria.tipo !== 'receita' || categoria.escopo !== 'individual') throw erroRegistroInvalido();
  const conta = await buscarContaDoDono(deps.tx, { id: entrada.conta_id, donoId: v.membroId });
  if (!conta) throw erroRegistroInvalido();

  const descricao = normalizarTextoOpcional(entrada.descricao);
  if (!descricao.ok) throw erroValorInvalido();
  const data = entrada.data ?? hojeEmSaoPaulo(deps.agora);
  const parcelas = calcularParcelas({
    tipo: 'receita',
    data,
    diaVencimento: null,
    numParcelas: 1,
    totalCentavos: valor.valor,
  });
  if (!parcelas.ok) throw erroValorInvalido();

  if (categoria.arquivada) throw erroCategoriaArquivada();
  if (conta.arquivada) throw erroContaArquivada();

  const criou = await inserirLancamentoSeLivre(deps.tx, {
    id: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    tipo: 'receita',
    escopo: 'individual',
    categoriaId: categoria.id,
    descricao: descricao.valor,
    valorTotalCentavos: valor.valor,
    numParcelas: 1,
    agora: deps.agora,
  });
  if (!criou) throw erroRegistroInvalido();
  await inserirPagamento(deps.tx, {
    lancamentoId: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    formaId: null,
    contaId: conta.id,
    dataOperacao: data,
    diaVencimentoAplicado: null,
  });
  await inserirParcelas(deps.tx, {
    lancamentoId: entrada.id,
    larId: v.larId,
    donoId: v.membroId,
    escopo: 'individual',
    parcelas: parcelas.valor,
  });
  return { criado: true, corpo: await gravado(deps, entrada.id, false) };
}
