import { z } from 'zod';

/**
 * Contrato da exclusão de conta (SDD 6.2 "Conta"; RN-26; CA-26.1 a CA-26.10; G-49; ADR-013).
 * O pedido exige a senha do usuário da sessão; a confirmação é pública e leva só o token do link (fragmento `#t=`).
 */

/** Dias entre a confirmação da exclusão e a purga dos dados (RN-26, CA-26.2). */
export const PRAZO_PURGA_DIAS = 30;
/** Dias até a purga apagar uma conta que nunca confirmou o e-mail (CA-19.8). */
export const PRAZO_CONTA_NAO_CONFIRMADA_DIAS = 7;
/** Dias depois da saída ou remoção até a purga apagar o individual do ex-membro (CA-23.12). */
export const PRAZO_INDIVIDUAL_EX_MEMBRO_DIAS = 30;

/** Teto do campo antes de conferir a senha (a política não se aplica aqui, como no entrar). */
const SENHA_MAX_CAMPO = 1024;
/** Token de link (256 bits em base64url). O formato errado é tratado como link vencido pela API. */
const Token = z.string().min(1).max(128);

export const entradaConta = {
  /** `POST /api/conta/exclusao` (A0): a senha atual confirma que é o dono da conta. */
  PedirExclusao: z.object({ senha: z.string().min(1).max(SENHA_MAX_CAMPO) }).strict(),
  /** `POST /api/conta/exclusao/confirmar` (P): o token do link do e-mail. */
  ConfirmarExclusao: z.object({ token: Token }).strict(),
} as const;

export type EntradaPedirExclusao = z.infer<typeof entradaConta.PedirExclusao>;
export type EntradaConfirmarExclusao = z.infer<typeof entradaConta.ConfirmarExclusao>;

/**
 * Códigos de erro das rotas de conta (SDD 7). Nenhum é novo: senha errada no pedido é `credenciais_invalidas`, o
 * bloqueio por tentativas é `muitas_tentativas`, o link vencido, usado ou desconhecido é `link_expirado`, e o login
 * de uma conta em exclusão é `conta_em_exclusao` (já em `CODIGOS_ERRO_ACESSO`). A lista só cresce.
 */
export const CODIGOS_ERRO_CONTA = [
  'credenciais_invalidas',
  'muitas_tentativas',
  'link_expirado',
  'sessao_expirada',
  'conta_em_exclusao',
] as const;
export type CodigoErroConta = (typeof CODIGOS_ERRO_CONTA)[number];
