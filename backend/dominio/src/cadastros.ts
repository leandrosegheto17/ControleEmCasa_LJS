import type { Centavos } from '@controle/contrato';
import { validarSaldoInicial, validarSaldoReal } from './centavos';
import { recusa, sucesso, type Resultado } from './resultado';
import type { EscopoCategoria, TipoCategoria } from './lar';
import {
  NOME_CONTA_MAX_CARACTERES,
  normalizarTextoObrigatorio,
  TEXTO_LIVRE_MAX_CARACTERES,
  validarDiaVencimento,
} from './validacoes';

/**
 * Cadastros de conta, forma de pagamento e categoria (RN-03, RN-12, RN-17, RN-18). Regras puras: a API lê o
 * estado sob RLS e pede a decisão aqui; a ordem das recusas (RT-02) fica com a API.
 * Origem: A salvar_conta.sql, A salvar_forma.sql, A salvar_categoria.sql, A definir_preferida.sql e
 * A ajustar_saldo.sql do legado.
 */

// ---------------------------------------------------------------------------------------------------
// Conta (RN-03)

export interface ContaNormalizada {
  readonly nome: string;
  readonly saldoInicialCentavos: Centavos;
}

/**
 * Nome de 1 a 80 caracteres depois do `trim`; saldo inicial ausente vira 0 e pode ser negativo, de −10^11 a
 * 10^11 (CA-18.1 e RN-18). Origem: A salvar_conta.sql:18-30.
 */
export function normalizarConta(dados: {
  nome: unknown;
  saldoInicialCentavos?: unknown;
}): Resultado<ContaNormalizada, 'valor_invalido'> {
  const nome = normalizarTextoObrigatorio(
    typeof dados.nome === 'string' ? dados.nome : null,
    NOME_CONTA_MAX_CARACTERES,
  );
  if (!nome.ok) return recusa('valor_invalido');
  const saldo = validarSaldoInicial(dados.saldoInicialCentavos ?? 0);
  if (!saldo.ok) return recusa('valor_invalido');
  return sucesso({ nome: nome.valor, saldoInicialCentavos: saldo.valor });
}

// ---------------------------------------------------------------------------------------------------
// Ajuste de saldo (RN-12)

export interface AjusteDeSaldo {
  /** Saldo real menos o saldo calculado (com sinal): o que a API devolve. */
  readonly diferencaCentavos: Centavos;
  /** O movimento `ajuste` a gravar; nulo quando a diferença é 0 (CA-12.3: nada é gravado). */
  readonly movimento: { readonly sentido: 'entrada' | 'saida'; readonly valorCentavos: Centavos } | null;
}

/**
 * O saldo real informado vira a diferença com sinal sobre o saldo calculado até hoje (CA-12.2): positiva é
 * entrada, negativa é saída. Saldo real negativo é aceito. Origem: A ajustar_saldo.sql:38-52.
 */
export function calcularAjusteDeSaldo(
  saldoReal: unknown,
  saldoAtual: Centavos,
): Resultado<AjusteDeSaldo, 'valor_invalido'> {
  const real = validarSaldoReal(saldoReal);
  if (!real.ok) return recusa('valor_invalido');
  const diferenca = real.valor - saldoAtual;
  if (!Number.isSafeInteger(diferenca)) return recusa('valor_invalido');
  if (diferenca === 0) return sucesso({ diferencaCentavos: 0, movimento: null });
  return sucesso({
    diferencaCentavos: diferenca,
    movimento: { sentido: diferenca > 0 ? 'entrada' : 'saida', valorCentavos: Math.abs(diferenca) },
  });
}

// ---------------------------------------------------------------------------------------------------
// Forma de pagamento (RN-03)

export type TipoFormaCadastro = 'pix' | 'debito' | 'credito';

export interface FormaNormalizada {
  readonly nome: string;
  readonly tipo: TipoFormaCadastro;
  readonly contaId: string | null;
  readonly diaVencimento: number | null;
}

const TIPOS_FORMA: readonly string[] = ['pix', 'debito', 'credito'];

/**
 * Pix e Débito exigem conta própria e o dia é ignorado (gravado nulo); Crédito exige dia de 1 a 31 e a conta
 * é opcional (CA-03.1, CA-03.2). Nome de 1 a 120 caracteres. Origem: A salvar_forma.sql:34-50.
 */
export function normalizarForma(dados: {
  nome: unknown;
  tipo: unknown;
  contaId?: string | null;
  diaVencimento?: unknown;
}): Resultado<FormaNormalizada, 'valor_invalido'> {
  const nome = normalizarTextoObrigatorio(
    typeof dados.nome === 'string' ? dados.nome : null,
    TEXTO_LIVRE_MAX_CARACTERES,
  );
  if (!nome.ok) return recusa('valor_invalido');
  const tipo = dados.tipo;
  if (typeof tipo !== 'string' || !TIPOS_FORMA.includes(tipo)) return recusa('valor_invalido');
  const contaId = dados.contaId ?? null;
  if (tipo === 'credito') {
    const dia = validarDiaVencimento(dados.diaVencimento);
    if (!dia.ok) return recusa('valor_invalido');
    return sucesso({ nome: nome.valor, tipo, contaId, diaVencimento: dia.valor });
  }
  if (contaId === null) return recusa('valor_invalido');
  return sucesso({ nome: nome.valor, tipo: tipo as TipoFormaCadastro, contaId, diaVencimento: null });
}

/** O tipo da forma não muda depois de criada (RN-03). Origem: A salvar_forma.sql:62-65. */
export function tipoDaFormaPodeMudar(atual: TipoFormaCadastro, novo: TipoFormaCadastro): boolean {
  return atual === novo;
}

/**
 * A conta de uma forma só é recusada por estar arquivada quando a conta da forma MUDA para ela
 * (RN-03 "Conta arquivada na forma"): reeditar uma forma que já usa uma conta arquivada é aceito.
 */
export function contaDaFormaPodeSer(nova: { arquivada: boolean; id: string }, atualId: string | null): boolean {
  return !nova.arquivada || nova.id === atualId;
}

/** Forma arquivada não vira preferida (RN-03); desligar a preferência é sempre aceito. */
export function formaPodeSerPreferida(arquivada: boolean, preferida: boolean): boolean {
  return !preferida || !arquivada;
}

// ---------------------------------------------------------------------------------------------------
// Categoria (RN-17)

export interface CategoriaNormalizada {
  readonly nome: string;
  readonly tipo: TipoCategoria;
  readonly escopo: EscopoCategoria;
  /** Só despesa tem a marca; receita é nula. */
  readonly variavel: boolean | null;
}

/**
 * Receita é sempre individual (o escopo enviado é ignorado; CA-17.1) e sem a marca variável; despesa grava
 * `variavel` (ausente vira falso). Nome de 1 a 120 caracteres. Origem: A salvar_categoria.sql:35-55.
 */
export function normalizarCategoria(dados: {
  nome: unknown;
  tipo: unknown;
  escopo: unknown;
  variavel?: boolean | null;
}): Resultado<CategoriaNormalizada, 'valor_invalido'> {
  const nome = normalizarTextoObrigatorio(
    typeof dados.nome === 'string' ? dados.nome : null,
    TEXTO_LIVRE_MAX_CARACTERES,
  );
  if (!nome.ok) return recusa('valor_invalido');
  const { tipo, escopo } = dados;
  if (tipo !== 'despesa' && tipo !== 'receita') return recusa('valor_invalido');
  if (escopo !== 'conjunto' && escopo !== 'individual') return recusa('valor_invalido');
  if (tipo === 'receita') return sucesso({ nome: nome.valor, tipo, escopo: 'individual', variavel: null });
  return sucesso({ nome: nome.valor, tipo, escopo, variavel: dados.variavel ?? false });
}

/** Tipo e escopo não mudam depois de criada (RN-17). Origem: A salvar_categoria.sql:61-63. */
export function categoriaPodeMudar(
  atual: { tipo: TipoCategoria; escopo: EscopoCategoria },
  nova: { tipo: TipoCategoria; escopo: EscopoCategoria },
): boolean {
  return atual.tipo === nova.tipo && atual.escopo === nova.escopo;
}
