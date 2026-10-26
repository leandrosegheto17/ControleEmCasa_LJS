import { donoLembrado } from '../dados/sessao';
import { useSessao } from './useSessao';

/** `usuario.id` de quem está na tela; offline (sessão presumida) vale o usuário lembrado deste aparelho. */
export function useMembroId(): string {
  const estado = useSessao();
  if (estado.situacao === 'ativa') return estado.sessao.usuario.id;
  return donoLembrado() ?? '';
}
