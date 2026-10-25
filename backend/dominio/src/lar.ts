import { recusa, sucesso, type Resultado } from './resultado';

/**
 * Lar, membros e convite (RN-17, RN-22, RN-23; ADR-009). Regras puras: a API lê o estado dentro da
 * transação, sob RLS, e pede a decisão aqui. O instante entra por parâmetro.
 * Origem das categorias: A inicializar_membro.sql:19-46 do legado (Almoço/Alimentação fora é conjunta).
 */

export type TipoCategoria = 'despesa' | 'receita';
export type EscopoCategoria = 'conjunto' | 'individual';

export interface CategoriaInicial {
  readonly tipo: TipoCategoria;
  readonly nome: string;
  /** Só despesa distingue variável; receita é nula (check `categoria_variavel_so_despesa`). */
  readonly variavel: boolean | null;
}

/** As 6 conjuntas, criadas uma vez por lar (RN-17). */
export const CATEGORIAS_INICIAIS_CONJUNTAS: readonly CategoriaInicial[] = [
  { tipo: 'despesa', nome: 'Mercado', variavel: true },
  { tipo: 'despesa', nome: 'Delivery/iFood do casal', variavel: true },
  { tipo: 'despesa', nome: 'Moradia', variavel: false },
  { tipo: 'despesa', nome: 'Contas da casa', variavel: false },
  { tipo: 'despesa', nome: 'Outros da casa', variavel: false },
  { tipo: 'despesa', nome: 'Almoço/Alimentação fora', variavel: true },
];

/** As 7 individuais, criadas para cada membro (RN-17): 4 de despesa e 3 de receita. */
export const CATEGORIAS_INICIAIS_INDIVIDUAIS: readonly CategoriaInicial[] = [
  { tipo: 'despesa', nome: 'Delivery pessoal', variavel: true },
  { tipo: 'despesa', nome: 'Transporte', variavel: true },
  { tipo: 'despesa', nome: 'Lazer pessoal', variavel: true },
  { tipo: 'despesa', nome: 'Outros', variavel: false },
  { tipo: 'receita', nome: 'Salário', variavel: null },
  { tipo: 'receita', nome: 'Extra', variavel: null },
  { tipo: 'receita', nome: 'Outros', variavel: null },
];

/** Validade do convite (RN-23; THREAT-MODEL E-04): 7 dias. */
export const VALIDADE_CONVITE_MS = 7 * 24 * 60 * 60 * 1000;
/** Cota de convites por lar numa janela de 24 h (RN-23; TM-API-16). */
export const LIMITE_CONVITES_POR_DIA = 5;
/** Intervalo mínimo entre dois convites para o mesmo endereço (RN-23; TM-API-16). */
export const INTERVALO_REENVIO_CONVITE_MS = 2 * 60 * 1000;
/** Nome que o membro que sai ou é removido passa a exibir (RN-23, CA-23.12). */
export const NOME_EX_MEMBRO = 'Ex-membro';

const NOME_LAR_MAX = 60;

/** Nome do lar criado no primeiro acesso (RN-22): "Lar de <nome do cadastro>", até 60 caracteres. */
export function nomeLarPadrao(nomeUsuario: string): string {
  return `Lar de ${nomeUsuario.trim()}`.slice(0, NOME_LAR_MAX);
}

/** Uma categoria do lar como a API a lê (só o que diz se ela ainda é a inicial, intacta). */
export interface LinhaCategoriaLar {
  readonly tipo: TipoCategoria;
  readonly escopo: EscopoCategoria;
  readonly nome: string;
  readonly variavel: boolean | null;
  readonly arquivada: boolean;
}

const chave = (c: { tipo: string; escopo: string; nome: string; variavel: boolean | null }) =>
  `${c.tipo}|${c.escopo}|${c.nome}|${String(c.variavel)}`;

const CHAVES_INICIAIS = [
  ...CATEGORIAS_INICIAIS_CONJUNTAS.map((c) => chave({ ...c, escopo: 'conjunto' })),
  ...CATEGORIAS_INICIAIS_INDIVIDUAIS.map((c) => chave({ ...c, escopo: 'individual' })),
].sort();

/**
 * O lar ainda tem só as categorias iniciais, intactas (CA-23.9): as 13, nenhuma a mais ou a menos,
 * nenhuma renomeada, arquivada ou com a marca variável trocada. Qualquer diferença é dado criado ou
 * alterado pelo titular (CA-23.10).
 * As demais tabelas de negócio (conta, forma, movimento; lançamento, fixa, orçamento, meta nas etapas 8 a 10)
 * entram em `decidirAceite` pela contagem `registrosDeNegocio`, que a API lê sob RLS.
 */
export function soCategoriasIniciais(categorias: readonly LinhaCategoriaLar[]): boolean {
  if (categorias.some((c) => c.arquivada)) return false;
  const chaves = categorias.map(chave).sort();
  return chaves.length === CHAVES_INICIAIS.length && chaves.every((k, i) => k === CHAVES_INICIAIS[i]);
}

/** O vínculo atual de quem aceita o convite, lido sob RLS no lar dele. */
export interface VinculoParaAceite {
  readonly papel: 'titular' | 'membro';
  /** Outras linhas de `membro` no lar (ativas ou que já saíram), além da do próprio usuário. */
  readonly outrosMembrosNoLar: number;
  readonly categorias: readonly LinhaCategoriaLar[];
  /**
   * Linhas do próprio lar nas tabelas de negócio além de `categoria` (conta, forma de pagamento, movimento de
   * conta e as que as etapas 8 a 10 criarem). Qualquer uma é "dado" (CA-23.10). Ausente vale 0.
   */
  readonly registrosDeNegocio?: number;
}

/**
 * Quem já tem lar pode aceitar? (CA-23.9 a CA-23.11, CA-11.2)
 * - sem lar: `livre`;
 * - membro (não titular) de outro lar: `ja_tem_lar`;
 * - titular de lar que já teve outro membro: `ja_tem_lar`;
 * - titular sozinho com qualquer dado: `ja_tem_lar`;
 * - titular sozinho só com as categorias iniciais: `descartar` (o lar é descartado e o aceite segue).
 */
export function decidirAceite(vinculo: VinculoParaAceite | null): Resultado<'livre' | 'descartar', 'ja_tem_lar'> {
  if (!vinculo) return sucesso('livre');
  if (vinculo.papel !== 'titular') return recusa('ja_tem_lar');
  if (vinculo.outrosMembrosNoLar > 0) return recusa('ja_tem_lar');
  if ((vinculo.registrosDeNegocio ?? 0) > 0) return recusa('ja_tem_lar');
  return soCategoriasIniciais(vinculo.categorias) ? sucesso('descartar') : recusa('ja_tem_lar');
}

export interface EstadoConvite {
  /** E-mail convidado e o do titular, já normalizados pelo contrato (a regra normaliza de novo). */
  readonly emailConvidado: string;
  readonly emailTitular: string;
  /** Membros ativos do lar (titular incluído). */
  readonly membrosAtivos: number;
  /** Convites criados pelo lar nas últimas 24 h, em qualquer situação. */
  readonly convitesNasUltimas24h: number;
  /** Quando foi criado o último convite do lar para o mesmo endereço (ou nulo). */
  readonly ultimoConviteMesmoEmailEm: Date | null;
  readonly agora: Date;
}

const normalizar = (email: string) => email.trim().toLowerCase();

/**
 * O titular pode convidar este e-mail agora? (RN-23; CA-23.7, CA-11.1; TM-API-16)
 * Ordem (RT-02): `valor_invalido` (o próprio e-mail) → `lar_cheio` → `muitas_tentativas` (5 por dia) →
 * `convite_pendente` (o mesmo endereço há menos de 2 min). Um convite novo revoga o pendente anterior
 * (G-14): isso é efeito, não recusa, e fica com a API.
 */
export function avaliarConvite(
  e: EstadoConvite,
): Resultado<void, 'valor_invalido' | 'lar_cheio' | 'muitas_tentativas' | 'convite_pendente'> {
  if (normalizar(e.emailConvidado) === normalizar(e.emailTitular)) return recusa('valor_invalido');
  if (e.membrosAtivos >= 2) return recusa('lar_cheio');
  if (e.convitesNasUltimas24h >= LIMITE_CONVITES_POR_DIA) return recusa('muitas_tentativas');
  if (
    e.ultimoConviteMesmoEmailEm &&
    e.agora.getTime() - e.ultimoConviteMesmoEmailEm.getTime() < INTERVALO_REENVIO_CONVITE_MS
  ) {
    return recusa('convite_pendente');
  }
  return sucesso(undefined);
}
