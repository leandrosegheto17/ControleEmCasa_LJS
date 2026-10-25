import type { EntradaAjustarSaldo, EntradaSalvarConta, SaidaAjuste, SaidaLinhaContas } from '@controle/contrato';
import { calcularAjusteDeSaldo, hojeEmSaoPaulo, normalizarConta } from '@controle/dominio';
import { listarContasComSaldo, saldoDaConta } from '../../consultas/saldos';
import {
  arquivarConta as arquivarContaNoBanco,
  atualizarConta,
  buscarContaDoDono,
  excluirConta as excluirContaNoBanco,
  inserirAjusteDeSaldo,
  inserirContaSeLivre,
} from '../../infraestrutura/db/repositorios/contas';
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

/** `GET /api/contas` (RN-03, RN-12): as contas do membro com o saldo atual (até hoje em São Paulo). */
export async function listarContas(deps: DepsLar): Promise<SaidaLinhaContas[]> {
  const v = vinculoDe(deps);
  return listarContasComSaldo(deps.tx, v.membroId, hojeEmSaoPaulo(deps.agora));
}

/**
 * `PUT /api/contas/:id` (RN-03; ADR-010): cria ou atualiza a conta do membro. O id é do cliente; reenviar a mesma
 * escrita devolve o mesmo resultado sem duplicar. Id de outro membro ou de outro lar: `registro_invalido`.
 * Não mexe em `arquivada`. Origem: A salvar_conta.sql.
 */
export async function salvarConta(deps: DepsLar, id: string, entrada: EntradaSalvarConta): Promise<ResultadoSalvar> {
  const v = vinculoDe(deps);
  const dados = normalizarConta({ nome: entrada.nome, saldoInicialCentavos: entrada.saldo_inicial_centavos });
  if (!dados.ok) throw erroValorInvalido();
  const { nome, saldoInicialCentavos } = dados.valor;

  await travarEscritaPorId(deps.tx, id);
  let atual = await buscarContaDoDono(deps.tx, { id, donoId: v.membroId, travar: true });
  if (!atual) {
    const criou = await inserirContaSeLivre(deps.tx, {
      id,
      larId: v.larId,
      donoId: v.membroId,
      nome,
      saldoInicialCentavos,
      agora: deps.agora,
    });
    if (criou) return { id, criado: true };
    // O id já existe: do mesmo membro (corrida entre dois reenvios) ou de quem a RLS esconde.
    atual = await buscarContaDoDono(deps.tx, { id, donoId: v.membroId, travar: true });
    if (!atual) throw erroRegistroInvalido();
  }
  await atualizarConta(deps.tx, { id, donoId: v.membroId, nome, saldoInicialCentavos });
  return { id, criado: false };
}

/**
 * `POST /api/contas/:id/ajuste` (RN-12; CA-12.2, CA-12.3): grava a diferença entre o saldo real informado e o
 * saldo calculado até hoje como movimento `ajuste`, ou só a devolve em `simular`. Diferença 0 não grava.
 * Conta arquivada pode ser ajustada. A linha da conta é travada: dois ajustes simultâneos se serializam.
 */
export async function ajustarSaldo(deps: DepsLar, id: string, entrada: EntradaAjustarSaldo): Promise<SaidaAjuste> {
  const v = vinculoDe(deps);
  const conta = await buscarContaDoDono(deps.tx, { id, donoId: v.membroId, travar: true });
  if (!conta) throw erroRegistroInvalido();
  const hoje = hojeEmSaoPaulo(deps.agora);
  const saldo = await saldoDaConta(deps.tx, v.membroId, id, hoje);
  if (saldo === null) throw erroRegistroInvalido();
  const ajuste = calcularAjusteDeSaldo(entrada.saldo_real_centavos, saldo);
  if (!ajuste.ok) throw erroValorInvalido();
  const { movimento, diferencaCentavos } = ajuste.valor;
  if (movimento && !entrada.simular) {
    await inserirAjusteDeSaldo(deps.tx, {
      larId: v.larId,
      donoId: v.membroId,
      contaId: id,
      sentido: movimento.sentido,
      valorCentavos: movimento.valorCentavos,
      data: hoje,
      agora: deps.agora,
    });
  }
  return { diferenca_centavos: diferencaCentavos };
}

/** `POST /api/contas/:id/arquivar` (idempotente; só o estado muda). */
export async function arquivarConta(deps: DepsLar, id: string): Promise<void> {
  const v = vinculoDe(deps);
  if ((await arquivarContaNoBanco(deps.tx, { id, donoId: v.membroId })) !== 1) throw erroRegistroInvalido();
}

/** `DELETE /api/contas/:id`: com movimento ou forma ligados → `em_uso` (CA-03.5); alheia → `registro_invalido`. */
export async function excluirConta(deps: DepsLar, id: string): Promise<void> {
  const v = vinculoDe(deps);
  await excluirComVinculo(() => excluirContaNoBanco(deps.tx, { id, donoId: v.membroId }), erroEmUso);
}
