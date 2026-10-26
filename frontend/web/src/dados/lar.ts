import type { SaidaLar } from '@controle/contrato';
import { chamar } from './transporte';

export interface ConviteAtual {
  lar_nome: string;
  convidado_por_nome: string;
  expira_em: string;
}

/** `POST /api/lar` (primeiro acesso): cria o lar da pessoa; 200 se ela já tinha um. */
export function criarLar(nome?: string): Promise<SaidaLar> {
  return chamar<SaidaLar>('POST', '/api/lar', nome ? { nome } : {});
}

/** `GET /api/convites/atual?token=`. O token vai codificado na consulta; nada é registrado no front. */
export function conviteAtual(token: string): Promise<ConviteAtual> {
  return chamar<ConviteAtual>('GET', `/api/convites/atual?token=${encodeURIComponent(token)}`, undefined, {
    saida: 'ConviteAtual',
    semAvisoDeSessao: true,
  });
}

export async function aceitarConvite(token: string): Promise<void> {
  await chamar('POST', '/api/convites/aceitar', { token });
}

export async function recusarConvite(token: string): Promise<void> {
  await chamar('POST', '/api/convites/recusar', { token });
}

/** `POST /api/termos/aceite` com as versões vigentes (CA-19.7). */
export async function aceitarTermos(versoes: { termos: string; privacidade: string }): Promise<void> {
  await chamar('POST', '/api/termos/aceite', versoes);
}
