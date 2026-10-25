import { z } from 'zod';

/**
 * Contrato de lar, membros e convite (SDD 6.2; RN-22, RN-23; ADR-009). Nenhuma rota aceita `lar_id`,
 * `dono_id` ou papel vindos do cliente: o lar vem do vínculo validado no banco (G-03).
 */

const NOME_LAR_MAX = 60;
const NomeLar = z.string().trim().min(1).max(NOME_LAR_MAX);
/** E-mail normalizado (RN-19: `trim` e minúsculas), como no cadastro. */
const EmailConvite = z.string().trim().toLowerCase().pipe(z.email().max(254));
/** Token do link do convite (256 bits em base64url). O formato errado vira `convite_invalido` na API. */
const TokenConvite = z.string().min(1).max(128);

export const Papel = z.enum(['titular', 'membro']);
export type Papel = z.infer<typeof Papel>;

const Instante = z.iso.datetime();

export const entradaLar = {
  /** `POST /api/lar` (primeiro acesso): o nome é opcional; sem ele, "Lar de <nome>". */
  CriarLar: z.object({ nome: NomeLar.optional() }).strict(),
  /** `PATCH /api/lar` (titular). */
  AtualizarLar: z.object({ nome: NomeLar }).strict(),
  /** `POST /api/lar/convites` (titular). */
  Convidar: z.object({ email: EmailConvite }).strict(),
  /** `POST /api/convites/aceitar` e `POST /api/convites/recusar`. */
  TokenConvite: z.object({ token: TokenConvite }).strict(),
} as const;

const LarResumo = z.object({ id: z.uuid(), nome: z.string() }).strict();
const MembroDaSessao = z.object({ id: z.uuid(), nome: z.string(), papel: Papel }).strict();

export const saidaLar = {
  /** `POST /api/lar` (201 criado; 200 quando já havia lar). */
  Lar: LarResumo,
  /** Vínculo atual em `GET /api/sessao` (SDD 5.2). */
  MembroDaSessao,
  /**
   * `GET /api/lar`. Os membros ativos, sem o e-mail do outro membro (PRD-TECNICO §2). O convite pendente
   * só aparece ao titular; sem convite, a chave não existe (G-11).
   */
  LarDetalhe: z
    .object({
      lar: LarResumo,
      membros: z.array(z.object({ id: z.uuid(), nome: z.string(), papel: Papel, sou_eu: z.boolean() }).strict()),
      convite_pendente: z.object({ id: z.uuid(), email: z.string(), expira_em: Instante }).strict().optional(),
    })
    .strict(),
  /** `POST /api/lar/convites` (201). Nunca leva o token. */
  ConviteCriado: z.object({ id: z.uuid(), email: z.string(), expira_em: Instante }).strict(),
  /** `GET /api/convites/atual?token=`: o que a tela de aceite mostra. Sem o e-mail convidado. */
  ConviteAtual: z.object({ lar_nome: z.string(), convidado_por_nome: z.string(), expira_em: Instante }).strict(),
} as const;

export type EntradaCriarLar = z.infer<typeof entradaLar.CriarLar>;
export type EntradaConvidar = z.infer<typeof entradaLar.Convidar>;
export type SaidaLar = z.infer<typeof saidaLar.Lar>;
export type SaidaMembroDaSessao = z.infer<typeof saidaLar.MembroDaSessao>;
export type SaidaLarDetalhe = z.infer<typeof saidaLar.LarDetalhe>;
export type SaidaConviteCriado = z.infer<typeof saidaLar.ConviteCriado>;
export type SaidaConviteAtual = z.infer<typeof saidaLar.ConviteAtual>;

/** Códigos de erro das rotas de lar e convite (SDD 7; PRD-TECNICO 1.1). A lista só cresce. */
export const CODIGOS_ERRO_LAR = [
  'registro_invalido',
  'titular_obrigatorio',
  'sem_lar',
  'convite_invalido',
  'lar_cheio',
  'convite_pendente',
  'ja_tem_lar',
] as const;
export type CodigoErroLar = (typeof CODIGOS_ERRO_LAR)[number];
