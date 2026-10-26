import { fila } from './fila';

const INTERVALO_PADRAO_MS = 30_000;

/** Uma rodada agora; resolve quando a fila termina de esvaziar. Sem sessão confirmada pelo servidor nada é enviado. */
export async function enviarAgora(): Promise<void> {
  await fila.esvaziar();
}

/**
 * Esvazia a fila ao abrir, ao voltar a rede, ao voltar à aba e a cada intervalo enquanto houver item aguardando.
 * Devolve o `parar`.
 */
export function iniciarEnvioAutomatico({ intervaloMs = INTERVALO_PADRAO_MS } = {}): () => void {
  let ativo = true;
  let relogio: ReturnType<typeof setInterval> | undefined;

  async function rodada() {
    if (!ativo) return;
    await enviarAgora();
  }
  const disparar = () => void rodada().catch(() => undefined);

  async function reavaliarRelogio() {
    const itens = await fila.listar();
    if (!ativo) return;
    const haAguardando = itens.some((i) => i.situacao === 'aguardando');
    if (haAguardando && relogio === undefined) relogio = setInterval(disparar, intervaloMs);
    if (!haAguardando && relogio !== undefined) {
      clearInterval(relogio);
      relogio = undefined;
    }
  }
  const reavaliar = () => void reavaliarRelogio().catch(() => undefined);

  const aoVoltarVisivel = () => {
    if (document.visibilityState === 'visible') disparar();
  };

  window.addEventListener('online', disparar);
  document.addEventListener('visibilitychange', aoVoltarVisivel);
  const cancelarAssinatura = fila.assinar(reavaliar);
  reavaliar();
  disparar();

  return () => {
    ativo = false;
    window.removeEventListener('online', disparar);
    document.removeEventListener('visibilitychange', aoVoltarVisivel);
    cancelarAssinatura();
    if (relogio !== undefined) clearInterval(relogio);
    relogio = undefined;
  };
}
