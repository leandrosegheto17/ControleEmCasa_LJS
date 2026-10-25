import { z } from 'zod';

/**
 * Contrato dos cadastros de conta, forma de pagamento e categoria (SDD 6.1 #5 a #19; RN-03, RN-12, RN-17,
 * RN-18; ADR-010). Nenhuma rota aceita `lar_id` nem `dono_id`: o lar e o dono vêm do vínculo validado no
 * banco (G-03). O id da escrita vai na rota (`PUT /recurso/:id`), gerado no cliente (RT-03).
 * Nenhum schema ecoa o valor recebido no erro.
 */

/** Tetos de texto (RN-18): conta 80 caracteres; forma e categoria 120. Os mesmos de `@controle/dominio`. */
export const LIMITES_CADASTRO = {
  nomeContaCaracteres: 80,
  nomeFormaCaracteres: 120,
  nomeCategoriaCaracteres: 120,
  saldoInicialMaxCentavos: 100_000_000_000,
} as const;

/**
 * Texto obrigatório: `trim`, de 1 ao teto em CARACTERES reais (pontos de código, como o `char_length` do
 * Postgres e o domínio). O `.max()` do Zod conta unidades UTF-16 e recusaria um nome de emojis dentro do teto.
 */
function textoObrigatorio(max: number) {
  return z
    .string()
    .trim()
    .refine((s) => {
      const n = [...s].length;
      return n >= 1 && n <= max;
    });
}

const Centavos = z.number().int().safe();
const SaldoInicial = Centavos.min(-LIMITES_CADASTRO.saldoInicialMaxCentavos).max(
  LIMITES_CADASTRO.saldoInicialMaxCentavos,
);
const TipoForma = z.enum(['pix', 'debito', 'credito']);
const TipoCategoria = z.enum(['despesa', 'receita']);
const EscopoCategoria = z.enum(['conjunto', 'individual']);

export const entradaCadastros = {
  /** `PUT /api/contas/:id`: cria ou atualiza. O saldo inicial ausente vale 0. */
  SalvarConta: z
    .object({
      nome: textoObrigatorio(LIMITES_CADASTRO.nomeContaCaracteres),
      saldo_inicial_centavos: SaldoInicial.optional(),
    })
    .strict(),
  /** `POST /api/contas/:id/ajuste`: o saldo real pode ser negativo; `simular` só devolve a diferença. */
  AjustarSaldo: z.object({ saldo_real_centavos: Centavos, simular: z.boolean().optional() }).strict(),
  /**
   * `PUT /api/formas/:id`. Pix e Débito exigem a conta; Crédito exige o dia (1 a 31); o dia do Pix e do Débito
   * é ignorado. As regras cruzadas ficam em `normalizarForma` (domínio).
   */
  SalvarForma: z
    .object({
      nome: textoObrigatorio(LIMITES_CADASTRO.nomeFormaCaracteres),
      tipo: TipoForma,
      conta_id: z.uuid().nullish(),
      dia_vencimento: z.number().int().min(1).max(31).nullish(),
    })
    .strict(),
  /** `PUT /api/formas/:id/preferida`. */
  DefinirPreferida: z.object({ preferida: z.boolean() }).strict(),
  /** `PUT /api/categorias/:id`. Receita é sempre individual; a marca `variavel` só vale na despesa. */
  SalvarCategoria: z
    .object({
      nome: textoObrigatorio(LIMITES_CADASTRO.nomeCategoriaCaracteres),
      tipo: TipoCategoria,
      escopo: EscopoCategoria,
      variavel: z.boolean().nullish(),
    })
    .strict(),
} as const;

export const saidaCadastros = {
  /** `{ id }` das escritas de cadastro (200 quando já existia, 201 quando criou). */
  IdSalvo: z.object({ id: z.uuid() }).strict(),
  /** `POST /api/contas/:id/ajuste`: diferença com sinal (positiva = entrada). */
  Ajuste: z.object({ diferenca_centavos: Centavos }).strict(),
  /** `GET /api/contas` (item). Sem lar nem dono. */
  LinhaContas: z
    .object({
      id: z.uuid(),
      nome: z.string(),
      saldo_inicial_centavos: Centavos,
      saldo_centavos: Centavos,
      arquivada: z.boolean(),
      pode_excluir: z.boolean(),
    })
    .strict(),
  /** `GET /api/formas` (item). Gasto e comprometido só no Crédito; Pix e Débito levam nulo. */
  LinhaFormasPagamento: z
    .object({
      id: z.uuid(),
      nome: z.string(),
      tipo: TipoForma,
      conta: z.object({ id: z.uuid(), nome: z.string() }).strict().nullable(),
      dia_vencimento: z.number().int().nullable(),
      preferida: z.boolean(),
      arquivada: z.boolean(),
      pode_excluir: z.boolean(),
      gasto_mes_centavos: Centavos.nullable(),
      comprometido_futuro_centavos: Centavos.nullable(),
    })
    .strict(),
  /** `GET /api/categorias` (item): as conjuntas do lar e as individuais do próprio membro. */
  LinhaCategorias: z
    .object({
      id: z.uuid(),
      nome: z.string(),
      tipo: TipoCategoria,
      escopo: EscopoCategoria,
      variavel: z.boolean().nullable(),
      arquivada: z.boolean(),
      pode_excluir: z.boolean(),
    })
    .strict(),
} as const;

export type EntradaSalvarConta = z.infer<typeof entradaCadastros.SalvarConta>;
export type EntradaAjustarSaldo = z.infer<typeof entradaCadastros.AjustarSaldo>;
export type EntradaSalvarForma = z.infer<typeof entradaCadastros.SalvarForma>;
export type EntradaDefinirPreferida = z.infer<typeof entradaCadastros.DefinirPreferida>;
export type EntradaSalvarCategoria = z.infer<typeof entradaCadastros.SalvarCategoria>;
export type SaidaIdSalvo = z.infer<typeof saidaCadastros.IdSalvo>;
export type SaidaAjuste = z.infer<typeof saidaCadastros.Ajuste>;
export type SaidaLinhaContas = z.infer<typeof saidaCadastros.LinhaContas>;
export type SaidaLinhaFormasPagamento = z.infer<typeof saidaCadastros.LinhaFormasPagamento>;
export type SaidaLinhaCategorias = z.infer<typeof saidaCadastros.LinhaCategorias>;

/** Códigos de erro das rotas de cadastro (SDD 7; PRD-TECNICO 1.1). A lista só cresce. */
export const CODIGOS_ERRO_CADASTROS = [
  'valor_invalido',
  'registro_invalido',
  'nome_repetido',
  'em_uso',
  'categoria_em_uso',
] as const;
export type CodigoErroCadastros = (typeof CODIGOS_ERRO_CADASTROS)[number];
