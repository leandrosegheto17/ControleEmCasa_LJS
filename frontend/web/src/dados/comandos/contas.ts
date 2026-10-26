import type { SaidaAjuste, SaidaIdSalvo } from '@controle/contrato';
import { chamar } from '../transporte';

export interface DadosSalvarConta {
  /** Gerado no cliente, uma vez por abertura do formulário: o reenvio é idempotente (ADR-010). */
  id: string;
  nome: string;
  saldoInicialCentavos: number;
}

/** `PUT /api/contas/:id`: cria ou atualiza. */
export const salvarConta = (d: DadosSalvarConta) =>
  chamar<SaidaIdSalvo>(
    'PUT',
    `/api/contas/${d.id}`,
    { nome: d.nome, saldo_inicial_centavos: d.saldoInicialCentavos },
    { saida: 'IdSalvo' },
  );

export const arquivarConta = async (id: string): Promise<void> => {
  await chamar('POST', `/api/contas/${id}/arquivar`);
};

export const excluirConta = async (id: string): Promise<void> => {
  await chamar('DELETE', `/api/contas/${id}`);
};

export interface AjusteSaldo {
  contaId: string;
  saldoRealCentavos: number;
  /** `true` só calcula a diferença, sem gravar o lançamento de ajuste. */
  simular: boolean;
}

/** `POST /api/contas/:id/ajuste`. Diferença em centavos entre o saldo real e o saldo do app (positiva = entrada). */
export const ajustarSaldo = async ({ contaId, saldoRealCentavos, simular }: AjusteSaldo): Promise<number> => {
  const r = await chamar<SaidaAjuste>(
    'POST',
    `/api/contas/${contaId}/ajuste`,
    { saldo_real_centavos: saldoRealCentavos, simular },
    { saida: 'Ajuste' },
  );
  return r.diferenca_centavos;
};
