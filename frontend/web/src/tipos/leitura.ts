export type SituacaoLeitura = 'carregando' | 'erro' | 'cache' | 'pronto';

export interface LeituraComCache<T> {
  situacao: SituacaoLeitura;
  dados: T | undefined;
  /** Epoch em ms da última carga com sucesso; sem formatar. */
  atualizadoEm: number;
}
