import { MAX_PARCELAS, type TipoForma } from './parcelas';
import { recusa, sucesso, type Resultado } from './resultado';

/**
 * Validações de textos, parcelas e dia de vencimento (RN-18, RN-03, RN-14). Os valores em centavos
 * estão em `centavos.ts` e as datas em `datas.ts` / `fixas.ts`.
 */

/** Teto dos textos livres (descrição, nome de categoria, forma, meta, fixa): decisão de 2026-10-24. */
export const TEXTO_LIVRE_MAX_CARACTERES = 120;
/** Nome de conta: 1–80 caracteres (A salvar_conta.sql:25). */
export const NOME_CONTA_MAX_CARACTERES = 80;
/** Local de meta: 1–60 caracteres (T movimento_meta.sql:10). */
export const LOCAL_META_MAX_CARACTERES = 60;

/** Tamanho em caracteres (pontos de código), como o `char_length` do Postgres. */
export function tamanhoEmCaracteres(texto: string): number {
  return [...texto].length;
}

/**
 * Texto opcional (descrição): `trim`; vazio vira `null` (CA-18.2). Sem checar o tamanho.
 * SPEC_DEVIATION: o legado usa `btrim`, que só remove o espaço U+0020; aqui o `trim` do JavaScript
 * (o mesmo do `z.string().trim()` do contrato) remove todo espaço em branco Unicode (tab, quebra de
 * linha, NBSP). Ver ADR-007.
 */
export function normalizarTextoOpcionalSemLimite(texto: string | null | undefined): string | null {
  if (texto === null || texto === undefined) return null;
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

/** Texto opcional com teto (padrão 120): `trim`, vazio → `null`, acima do teto → `valor_invalido`. */
export function normalizarTextoOpcional(
  texto: string | null | undefined,
  maxCaracteres = TEXTO_LIVRE_MAX_CARACTERES,
): Resultado<string | null, 'valor_invalido'> {
  const limpo = normalizarTextoOpcionalSemLimite(texto);
  if (limpo !== null && tamanhoEmCaracteres(limpo) > maxCaracteres) return recusa('valor_invalido');
  return sucesso(limpo);
}

/**
 * Texto obrigatório (nome, local, descrição da fixa): `trim`; vazio ou acima do teto →
 * `valor_invalido` (RN-18). Origem: A salvar_conta.sql:18-25; A movimentar_meta.sql:23.
 */
export function normalizarTextoObrigatorio(
  texto: string | null | undefined,
  maxCaracteres = TEXTO_LIVRE_MAX_CARACTERES,
): Resultado<string, 'valor_invalido'> {
  const limpo = normalizarTextoOpcionalSemLimite(texto);
  if (limpo === null || tamanhoEmCaracteres(limpo) > maxCaracteres) return recusa('valor_invalido');
  return sucesso(limpo);
}

/** Dia de vencimento: inteiro de 1 a 31 (CA-03.2, CA-14.4). */
export function validarDiaVencimento(dia: unknown): Resultado<number, 'valor_invalido'> {
  if (typeof dia !== 'number' || !Number.isInteger(dia) || dia < 1 || dia > 31) return recusa('valor_invalido');
  return sucesso(dia);
}

/**
 * Nº de parcelas: 1 a 24, e só o Crédito passa de 1 (RN-14, RN-18). Receita é sempre 1.
 * Origem: T lancamento.sql:16; F calcular_parcelas.sql:26-29.
 */
export function validarNumParcelas(tipo: TipoForma | 'receita', n: unknown): Resultado<number, 'valor_invalido'> {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_PARCELAS) return recusa('valor_invalido');
  if (tipo !== 'credito' && n !== 1) return recusa('valor_invalido');
  return sucesso(n);
}
