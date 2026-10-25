/**
 * Tradução dos erros do Postgres para os códigos estáveis da API (SDD 7). Só o SQLSTATE e o nome da
 * constraint são lidos: nunca a mensagem nem o detalhe, que podem trazer o valor gravado (G-46).
 */
export interface ErroTraduzido {
  status: 400 | 404 | 409;
  code: string;
  message: string;
}

const POR_CONSTRAINT: Record<string, ErroTraduzido> = {
  membro_um_convidado: { status: 409, code: 'lar_cheio', message: 'Este lar já tem 2 membros.' },
  membro_um_titular: { status: 409, code: 'lar_cheio', message: 'Este lar já tem 2 membros.' },
  membro_um_lar_ativo: { status: 409, code: 'ja_tem_lar', message: 'Você já faz parte de um lar.' },
  convite_um_pendente: { status: 409, code: 'convite_pendente', message: 'Já existe um convite em aberto.' },
  categoria_unica: { status: 409, code: 'nome_repetido', message: 'Já existe uma categoria com esse nome.' },
};

const REGISTRO_INVALIDO: ErroTraduzido = { status: 404, code: 'registro_invalido', message: 'Registro inválido.' };
const VALOR_INVALIDO: ErroTraduzido = { status: 400, code: 'valor_invalido', message: 'Dados inválidos.' };

export function traduzirErroDoBanco(erro: unknown): ErroTraduzido | null {
  if (!(erro instanceof Error)) return null;
  const { code, constraint } = erro as { code?: unknown; constraint?: unknown };
  if (code === '23505' && typeof constraint === 'string') return POR_CONSTRAINT[constraint] ?? null;
  // Violação de RLS ou de grant: o mesmo erro de um id inexistente (RT-01).
  if (code === '42501') return REGISTRO_INVALIDO;
  if (code === '23514') return VALOR_INVALIDO;
  return null;
}
