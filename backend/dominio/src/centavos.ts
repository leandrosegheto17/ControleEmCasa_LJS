import type { Centavos } from '@controle/contrato';
import { recusa, sucesso, type Resultado } from './resultado';

/**
 * Dinheiro em centavos inteiros (RT-05, ADR-007). Nenhum valor monetário é fracionário; as contas
 * que dividem (percentuais, mensal da meta) usam inteiros exatos.
 */

/** Teto do valor de um lançamento: R$ 1 bilhão (CA-T5.1). Origem: T lancamento.sql:13-15. */
export const VALOR_MAXIMO_LANCAMENTO_CENTAVOS = 100_000_000_000;

/** Faixa do saldo inicial de conta: −10^11 a 10^11 centavos (RN-18, decisão de 2026-10-24). */
export const SALDO_INICIAL_MAXIMO_CENTAVOS = 100_000_000_000;

/** `true` se o valor é um inteiro seguro (centavos válidos para guardar e somar sem perda). */
export function ehCentavos(valor: unknown): valor is Centavos {
  return typeof valor === 'number' && Number.isSafeInteger(valor);
}

/** Soma valores em centavos. Função pura, sem relógio nem I/O. */
export function somarCentavos(valores: readonly Centavos[]): Centavos {
  return valores.reduce((total, valor) => total + valor, 0);
}

/** Valor de lançamento: 1 a 10^11 centavos, inclusive (CA-T5.1, CA-18.1). */
export function validarValorLancamento(valor: unknown): Resultado<Centavos, 'valor_invalido'> {
  if (!ehCentavos(valor) || valor < 1 || valor > VALOR_MAXIMO_LANCAMENTO_CENTAVOS) return recusa('valor_invalido');
  return sucesso(valor);
}

/**
 * Valor estritamente positivo: previsto de fixa, alvo de meta, orçamento, movimento de meta e
 * pagamento de cartão (RN-18). Origem: T movimento_meta.sql:8 e checks equivalentes.
 */
export function validarValorPositivo(valor: unknown): Resultado<Centavos, 'valor_invalido'> {
  if (!ehCentavos(valor) || valor <= 0) return recusa('valor_invalido');
  return sucesso(valor);
}

/** Saldo inicial de conta: qualquer inteiro de −10^11 a 10^11 (pode ser negativo; RN-03, RN-18). */
export function validarSaldoInicial(valor: unknown): Resultado<Centavos, 'valor_invalido'> {
  if (!ehCentavos(valor) || Math.abs(valor) > SALDO_INICIAL_MAXIMO_CENTAVOS) return recusa('valor_invalido');
  return sucesso(valor);
}

/** Saldo real informado no ajuste: qualquer inteiro, inclusive negativo (RN-12, RN-18). */
export function validarSaldoReal(valor: unknown): Resultado<Centavos, 'valor_invalido'> {
  if (!ehCentavos(valor)) return recusa('valor_invalido');
  return sucesso(valor);
}

/**
 * round(100 × parte ÷ total), com arredondamento "metade para longe do zero", exato em inteiros
 * (igual ao `round(numeric)` do Postgres usado no legado: F situacao_orcamento.sql:13,
 * F totais_conjunto.sql:34-38, F progresso_meta.sql:39). Total 0 → `null` (o `nullif` do legado).
 * Só para exibição (CA-T5.3).
 */
export function percentualArredondado(parte: Centavos, total: Centavos): number | null {
  if (!ehCentavos(parte) || !ehCentavos(total)) throw new RangeError('centavos inválidos');
  if (total === 0) return null;
  const negativo = parte < 0 !== total < 0;
  const p = BigInt(Math.abs(parte));
  const t = BigInt(Math.abs(total));
  // floor((200p + t) / 2t) = round(100p/t) para p, t ≥ 0, com a metade para cima.
  const r = Number((200n * p + t) / (2n * t));
  return negativo ? -r : r;
}

/** ⌈a ÷ b⌉ para a ≥ 0 e b > 0, em inteiros. */
export function divisaoParaCima(a: Centavos, b: number): Centavos {
  if (!ehCentavos(a) || a < 0 || !Number.isSafeInteger(b) || b <= 0) throw new RangeError('divisão inválida');
  return Number((BigInt(a) + BigInt(b) - 1n) / BigInt(b));
}
