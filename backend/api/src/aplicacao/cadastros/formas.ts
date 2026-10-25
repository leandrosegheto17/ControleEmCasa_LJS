import type { EntradaDefinirPreferida, EntradaSalvarForma, SaidaLinhaFormasPagamento } from '@controle/contrato';
import { contaDaFormaPodeSer, formaPodeSerPreferida, normalizarForma, tipoDaFormaPodeMudar } from '@controle/dominio';
import { buscarContaDoDono } from '../../infraestrutura/db/repositorios/contas';
import {
  arquivarForma as arquivarFormaNoBanco,
  atualizarForma,
  buscarFormaDoDono,
  definirPreferidaDoDono,
  excluirForma as excluirFormaNoBanco,
  inserirFormaSeLivre,
  listarFormasDoDono,
  travarFormasDoDono,
} from '../../infraestrutura/db/repositorios/formas';
import { travarEscritaPorId } from '../../infraestrutura/db/repositorios/idempotencia';
import {
  erroEmUso,
  erroRegistroInvalido,
  erroValorInvalido,
  excluirComVinculo,
  vinculoDe,
  type DepsLar,
  type ResultadoSalvar,
} from './comum';

/**
 * `GET /api/formas` (RN-03).
 * SPEC_DEVIATION: o SDD (§6.1 #10) devolve também o gasto do mês e o comprometido futuro do Crédito, que somam
 * parcelas (etapas 8 e 9). Até lá não há lançamento, então o Crédito leva 0 e Pix e Débito levam nulo; a
 * agregação em SQL entra na etapa 9.
 */
export async function listarFormas(deps: DepsLar): Promise<SaidaLinhaFormasPagamento[]> {
  const v = vinculoDe(deps);
  const formas = await listarFormasDoDono(deps.tx, v.membroId);
  return formas.map((f) => ({
    ...f,
    gasto_mes_centavos: f.tipo === 'credito' ? 0 : null,
    comprometido_futuro_centavos: f.tipo === 'credito' ? 0 : null,
  }));
}

/**
 * `PUT /api/formas/:id` (RN-03; ADR-010): cria ou atualiza a forma do membro. Ordem das recusas (RT-02):
 * `valor_invalido` do corpo (regra do domínio) → `registro_invalido` (conta que não é do membro) → conta
 * arquivada trocada (`valor_invalido`) → tipo trocado (`valor_invalido`). Não mexe em `preferida` nem em
 * `arquivada`. Origem: A salvar_forma.sql.
 */
export async function salvarForma(deps: DepsLar, id: string, entrada: EntradaSalvarForma): Promise<ResultadoSalvar> {
  const v = vinculoDe(deps);
  const dados = normalizarForma({
    nome: entrada.nome,
    tipo: entrada.tipo,
    contaId: entrada.conta_id ?? null,
    diaVencimento: entrada.dia_vencimento ?? null,
  });
  if (!dados.ok) throw erroValorInvalido();
  const forma = dados.valor;

  const conta = forma.contaId ? await buscarContaDoDono(deps.tx, { id: forma.contaId, donoId: v.membroId }) : null;
  if (forma.contaId && !conta) throw erroRegistroInvalido();

  await travarEscritaPorId(deps.tx, id);
  let atual = await buscarFormaDoDono(deps.tx, { id, donoId: v.membroId, travar: true });
  if (conta && !contaDaFormaPodeSer(conta, atual?.conta_id ?? null)) throw erroValorInvalido();

  if (!atual) {
    const criou = await inserirFormaSeLivre(deps.tx, {
      id,
      larId: v.larId,
      donoId: v.membroId,
      nome: forma.nome,
      tipo: forma.tipo,
      contaId: forma.contaId,
      diaVencimento: forma.diaVencimento,
      agora: deps.agora,
    });
    if (criou) return { id, criado: true };
    // O id já existe: do mesmo membro (corrida entre dois reenvios) ou de quem a RLS esconde.
    atual = await buscarFormaDoDono(deps.tx, { id, donoId: v.membroId, travar: true });
    if (!atual) throw erroRegistroInvalido();
    if (conta && !contaDaFormaPodeSer(conta, atual.conta_id)) throw erroValorInvalido();
  }
  if (!tipoDaFormaPodeMudar(atual.tipo, forma.tipo)) throw erroValorInvalido();
  await atualizarForma(deps.tx, {
    id,
    donoId: v.membroId,
    nome: forma.nome,
    contaId: forma.contaId,
    diaVencimento: forma.diaVencimento,
  });
  return { id, criado: false };
}

/** `POST /api/formas/:id/arquivar` (idempotente): arquiva e tira a preferência. */
export async function arquivarForma(deps: DepsLar, id: string): Promise<void> {
  const v = vinculoDe(deps);
  if ((await arquivarFormaNoBanco(deps.tx, { id, donoId: v.membroId })) !== 1) throw erroRegistroInvalido();
}

/** `DELETE /api/formas/:id`: com vínculo → `em_uso`; alheia → `registro_invalido` antes de qualquer vínculo (CA-T1.3). */
export async function excluirForma(deps: DepsLar, id: string): Promise<void> {
  const v = vinculoDe(deps);
  await excluirComVinculo(() => excluirFormaNoBanco(deps.tx, { id, donoId: v.membroId }), erroEmUso);
}

/**
 * `PUT /api/formas/:id/preferida` (CA-03.4): liga ou desliga a preferida do membro; ao ligar, a anterior dele
 * deixa de ser, sem afetar o outro membro. Forma de outro membro: `registro_invalido`, antes de olhar se está
 * arquivada. Forma arquivada não vira preferida (`valor_invalido`). Idempotente nos dois sentidos.
 */
export async function definirPreferida(deps: DepsLar, id: string, entrada: EntradaDefinirPreferida): Promise<void> {
  const v = vinculoDe(deps);
  await travarFormasDoDono(deps.tx, v.membroId);
  const forma = await buscarFormaDoDono(deps.tx, { id, donoId: v.membroId });
  if (!forma) throw erroRegistroInvalido();
  if (!formaPodeSerPreferida(forma.arquivada, entrada.preferida)) throw erroValorInvalido();
  await definirPreferidaDoDono(deps.tx, { id, donoId: v.membroId, preferida: entrada.preferida });
}
