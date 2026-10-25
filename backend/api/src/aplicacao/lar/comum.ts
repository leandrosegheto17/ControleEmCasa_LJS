import type { Transaction } from 'kysely';
import type { Sessao, Vinculo } from '../../env';
import { ErroApi } from '../../erros';
import type { DB } from '../../infraestrutura/db/tipos';
import type { EnviadorDeEmail } from '../../infraestrutura/email';

/**
 * Dependências dos casos de uso de lar e convite. Sem Hono e sem `c.env` (SDD 2.2, camada `aplicacao`).
 * `tx` é a transação da requisição, com o GUC já gravado; `vinculo` foi derivado no banco (G-03).
 */
export interface DepsLar {
  tx: Transaction<DB>;
  agora: Date;
  sessao: Sessao;
  vinculo: Vinculo | null;
}

export interface DepsConvite extends DepsLar {
  email: EnviadorDeEmail;
  urlPublica: string;
  agendar: (trabalho: Promise<unknown>) => void;
}

/** "Não existe", "é de outro lar" e "não é ação sua" dão a mesma resposta (RT-01; CA-23.2, CA-23.14). */
export const erroRegistroInvalido = () => new ErroApi(404, 'registro_invalido', 'Registro inválido.');

/** Ação só do titular que não tem recusa própria no critério de aceite (PRD-TECNICO 1.1). */
export const erroTitularObrigatorio = () =>
  new ErroApi(403, 'titular_obrigatorio', 'Só o titular do lar pode fazer isso.');

/** Token errado, de outro e-mail, expirado, usado ou revogado: a mesma resposta (RN-23; CA-23.4, CA-23.5). */
export const erroConviteInvalido = () =>
  new ErroApi(404, 'convite_invalido', 'Convite inválido ou expirado. Peça um novo a quem convidou.');

const ERROS_DO_DOMINIO = {
  valor_invalido: () => new ErroApi(400, 'valor_invalido', 'Dados inválidos.'),
  lar_cheio: () => new ErroApi(409, 'lar_cheio', 'Este lar já tem 2 membros.'),
  convite_pendente: () =>
    new ErroApi(409, 'convite_pendente', 'Já existe um convite recente para este e-mail. Aguarde um pouco.'),
  ja_tem_lar: () => new ErroApi(409, 'ja_tem_lar', 'Você já faz parte de um lar com dados.'),
  muitas_tentativas: () => new ErroApi(429, 'muitas_tentativas', 'Muitos convites hoje. Tente amanhã.'),
} as const;

export function erroDoDominio(codigo: keyof typeof ERROS_DO_DOMINIO): ErroApi {
  return ERROS_DO_DOMINIO[codigo]();
}

/** O vínculo existe (a rota usa `exigirLar`); aqui só estreita o tipo. */
export function vinculoDe(deps: DepsLar): Vinculo {
  if (!deps.vinculo) throw new ErroApi(409, 'sem_lar', 'Você ainda não tem um lar. Crie o seu ou aceite um convite.');
  return deps.vinculo;
}
