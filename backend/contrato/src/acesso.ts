import { z } from 'zod';

/**
 * Contrato das rotas de acesso (SDD 6.2: cadastro, sessão, senha e termos; RN-19, RN-20, RN-21).
 * Único para a API e o front. Nenhum schema ecoa o valor recebido no erro.
 */

/** Versões vigentes dos documentos legais (RN-19, G-48). Mudar uma delas exige novo aceite (CA-19.7). */
export const VERSAO_TERMOS = '2026-10-24';
export const VERSAO_PRIVACIDADE = '2026-10-24';

/** Política de senha (RN-19, G-17): de 12 caracteres a 72 bytes UTF-8 (o bcrypt ignora o resto). */
export const SENHA_MIN_CARACTERES = 12;
export const SENHA_MAX_BYTES = 72;
/** Teto do campo antes da política, só para não processar texto gigante (entrar não aplica a política). */
const SENHA_MAX_CAMPO = 1024;

/** Limites de entrada (SDD 2.1 `LIMITES`). */
export const LIMITES = {
  corpoBytes: 64 * 1024,
  emailCaracteres: 254,
  nomeCaracteres: 60,
} as const;

/** `true` se a senha cumpre a política; senão a API responde `senha_fraca` (CA-19.4). */
export function senhaAtendePolitica(senha: string): boolean {
  const caracteres = [...senha].length;
  const bytes = new TextEncoder().encode(senha).length;
  return caracteres >= SENHA_MIN_CARACTERES && bytes <= SENHA_MAX_BYTES;
}

/** E-mail normalizado (RN-19: `trim` e minúsculas), validado e com no máximo 254 caracteres. */
export const Email = z.string().trim().toLowerCase().pipe(z.email().max(LIMITES.emailCaracteres));

const Nome = z.string().trim().min(1).max(LIMITES.nomeCaracteres);
const Senha = z.string().min(1).max(SENHA_MAX_CAMPO);
/** Token de link (256 bits em base64url). O formato errado é tratado como link vencido pela API. */
const Token = z.string().min(1).max(128);
const Versao = z.string().min(1).max(40);

export const VersoesAceitas = z.object({ termos: Versao, privacidade: Versao }).strict();

export const entrada = {
  Cadastro: z.object({ nome: Nome, email: Email, senha: Senha, aceite: VersoesAceitas }).strict(),
  Confirmar: z.object({ token: Token }).strict(),
  Reenviar: z.object({ email: Email }).strict(),
  Entrar: z.object({ email: Email, senha: Senha }).strict(),
  Esqueci: z.object({ email: Email }).strict(),
  Redefinir: z.object({ token: Token, senha: Senha }).strict(),
  AceiteTermos: VersoesAceitas,
} as const;

export const saida = {
  /**
   * `GET /api/sessao` (SDD 5.2). `membro`, `lar` e `plano` ficam nulos até as etapas 6 e 13.
   * Nunca leva o token da sessão (CA-20.8).
   */
  SessaoAtual: z
    .object({
      usuario: z.object({ id: z.uuid(), nome: z.string(), email: z.string() }).strict(),
      membro: z.null(),
      lar: z.null(),
      plano: z.null(),
      termos_pendentes: z.boolean(),
    })
    .strict(),
} as const;

export type EntradaCadastro = z.infer<typeof entrada.Cadastro>;
export type EntradaEntrar = z.infer<typeof entrada.Entrar>;
export type SaidaSessaoAtual = z.infer<typeof saida.SessaoAtual>;

/** Códigos de erro estáveis das rotas de acesso (SDD 7; PRD-TECNICO 3). A lista só cresce. */
export const CODIGOS_ERRO_ACESSO = [
  'valor_invalido',
  'credenciais_invalidas',
  'senha_fraca',
  'link_expirado',
  'sessao_expirada',
  'email_nao_confirmado',
  'conta_em_exclusao',
  'muitas_tentativas',
  'muitas_requisicoes',
  'origem_invalida',
] as const;
export type CodigoErroAcesso = (typeof CODIGOS_ERRO_ACESSO)[number];
