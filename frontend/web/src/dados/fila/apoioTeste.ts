/**
 * Apoio dos testes da fila (não entra no bundle: só os `*.test.ts` o importam).
 * Simula o par `obterSessao` / `donoLembrado` de `dados/sessao.ts` sobre um "servidor" controlável.
 */
export const A = '00000000-0000-4000-8000-0000000000a1';
export const B = '00000000-0000-4000-8000-0000000000b1';

export const RESPOSTA_GRAVADA = {
  id: '00000000-0000-4000-8000-0000000000c1',
  escopo: 'conjunto' as const,
  categoria: 'Mercado',
  valor_total_centavos: 36000,
  num_parcelas: 3,
  primeira_parcela_data: '2026-10-09',
  ja_existia: false,
};

export const EXIBICAO = { categoria_nome: 'Mercado', forma_nome: 'Cartão de crédito XP' };

export function argsDeDespesa(descricao: string) {
  return {
    valor_centavos: 36000,
    categoria_id: '00000000-0000-4000-8000-000000000401',
    forma_id: '00000000-0000-4000-8000-000000000303',
    parcelas: 3,
    data: '2026-10-09',
    descricao,
  };
}

export function criarServidorDeSessao() {
  const estado = { usuario: null as string | null, semRede: false, lembrado: undefined as string | undefined };
  return {
    estado,
    /** Equivale a `GET /api/sessao` (o que o `useSessao` faz ao abrir o app e depois de entrar). */
    obterSessao: async () => {
      if (estado.semRede) throw { tipo: 'rede' };
      if (!estado.usuario) {
        estado.lembrado = undefined;
        return null;
      }
      estado.lembrado = estado.usuario;
      return { usuario: { id: estado.usuario, nome: 'Fulano', email: 'f@exemplo.com' } };
    },
    donoLembrado: () => estado.lembrado,
  };
}
