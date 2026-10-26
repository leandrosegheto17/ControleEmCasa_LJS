import { z } from 'zod';

/**
 * Contrato do plano do lar (SDD 6.2 "Plano" e "Webhook"; RN-24, RN-25; CA-24.11; G-31, G-34).
 * O CPF/CNPJ só entra em `POST /api/plano/assinar`: a API repassa ao Asaas e não grava nem registra em log.
 */

/** Só os dígitos do CPF/CNPJ (aceita pontuação comum na entrada). */
export function digitosCpfCnpj(texto: string): string {
  return texto.replace(/[.\-/\s]/g, '');
}

function digitoVerificador(numeros: number[], pesos: number[]): number {
  const soma = numeros.reduce((acc, n, i) => acc + n * (pesos[i] as number), 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CPF (11 dígitos) ou CNPJ (14 dígitos) com os dígitos verificadores certos; sequências repetidas são recusadas. */
export function cpfCnpjValido(texto: string): boolean {
  const d = digitosCpfCnpj(texto);
  if (!/^\d+$/.test(d) || (d.length !== 11 && d.length !== 14) || /^(\d)\1+$/.test(d)) return false;
  const n = [...d].map(Number);
  if (d.length === 11) {
    const d1 = digitoVerificador(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = digitoVerificador(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === n[9] && d2 === n[10];
  }
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = digitoVerificador(n.slice(0, 12), p1);
  const d2 = digitoVerificador(n.slice(0, 13), [6, ...p1]);
  return d1 === n[12] && d2 === n[13];
}

/** CPF ou CNPJ: devolve só os dígitos. Tamanho máximo antes de limpar: 18 (CNPJ formatado). */
const CpfCnpj = z
  .string()
  .max(18)
  .refine((v) => cpfCnpjValido(v), { message: 'cpf_cnpj_invalido' })
  .transform(digitosCpfCnpj);

export const SituacaoAssinatura = z.enum(['trial', 'ativa', 'atrasada', 'cancelada', 'free']);
export const PlanoEfetivo = z.enum(['free', 'pro']);
const Instante = z.iso.datetime();
const Data = z.iso.date();

export const entradaPlano = {
  /** `POST /api/plano/assinar` (titular). */
  Assinar: z.object({ cpf_cnpj: CpfCnpj }).strict(),
} as const;

/**
 * Cobrança em aberto do lar (só para o titular). O Pix vem do Asaas na hora; se o Asaas não responder, os dois
 * campos do Pix vêm nulos e a tela pede para tentar de novo.
 */
const CobrancaAberta = z
  .object({
    vencimento: Data,
    valor_centavos: z.number().int().positive(),
    situacao: z.enum(['pendente', 'vencida']),
    pix_copia_cola: z.string().nullable(),
    qr_png_base64: z.string().nullable(),
  })
  .strict();

export const saidaPlano = {
  /**
   * `GET /api/plano`, `POST /api/plano/assinar` (201). O convidado vê só o plano e a validade (PRD-TECNICO §2):
   * `cobranca` nunca aparece para ele. `plano` é o efetivo (calculado no servidor a cada requisição).
   */
  MeuPlano: z
    .object({
      plano: PlanoEfetivo,
      situacao: SituacaoAssinatura,
      trial_ate: Instante,
      periodo_ate: Instante.nullable(),
      preco_centavos: z.number().int().positive(),
      sou_titular: z.boolean(),
      cobranca: CobrancaAberta.optional(),
    })
    .strict(),
} as const;

export type EntradaAssinar = z.infer<typeof entradaPlano.Assinar>;
export type SaidaMeuPlano = z.infer<typeof saidaPlano.MeuPlano>;

/**
 * Códigos de erro do plano e do webhook (SDD 7; PRD-TECNICO 1.1). A lista só cresce.
 * `plano_necessario` é a recusa das escritas de orçamento e metas no Free (RN-25). `indisponivel`: Asaas fora do ar
 * ao assinar ou cancelar.
 */
export const CODIGOS_ERRO_PLANO = [
  'plano_necessario',
  'registro_invalido',
  'valor_invalido',
  'assinatura_ativa',
  'sem_assinatura',
  'token_invalido',
  'indisponivel',
] as const;
export type CodigoErroPlano = (typeof CODIGOS_ERRO_PLANO)[number];
