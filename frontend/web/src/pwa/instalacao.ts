import { estaInstalado } from './modoInstalado';

export type Plataforma = 'ios' | 'android' | 'outra';

export interface EstadoInstalacao {
  plataforma: Plataforma;
  instalado: boolean;
  temPrompt: boolean;
  dispensada: boolean;
  mostrarFaixa: boolean;
}

export interface EscolhaInstalacao {
  outcome: 'accepted' | 'dismissed';
  platform: string;
}

/** Evento não padronizado do Chromium; o Safari não o dispara. */
interface EventoPromptInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<EscolhaInstalacao>;
}

const CHAVE_DISPENSA = 'controle.instalar.dispensada';

let promptGuardado: EventoPromptInstalacao | null = null;
let instaladoPeloEvento = false;
let dispensada = false;
let iniciada = false;
let estado: EstadoInstalacao | null = null;
const ouvintes = new Set<() => void>();

export function plataforma(): Plataforma {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  // iPadOS 13+ se apresenta como Mac; só o toque o distingue de um Mac.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'outra';
}

function lerDispensa(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSA) !== null;
  } catch {
    return false;
  }
}

function calcular(): EstadoInstalacao {
  const plat = plataforma();
  const instalado = instaladoPeloEvento || estaInstalado();
  return {
    plataforma: plat,
    instalado,
    temPrompt: promptGuardado !== null,
    dispensada,
    mostrarFaixa: plat !== 'outra' && !instalado && !dispensada,
  };
}

function mudou() {
  estado = calcular();
  ouvintes.forEach((ouvinte) => ouvinte());
}

/** Liga os eventos de instalação; precisa rodar antes do render porque `beforeinstallprompt` dispara cedo. */
export function iniciarInstalacao(): void {
  dispensada = lerDispensa();
  estado = calcular();
  if (iniciada) return;
  iniciada = true;
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    promptGuardado = evento as EventoPromptInstalacao;
    mudou();
  });
  window.addEventListener('appinstalled', () => {
    instaladoPeloEvento = true;
    promptGuardado = null;
    mudou();
  });
}

/** Referência estável enquanto nada muda, como o `useSyncExternalStore` exige. */
export function obter(): EstadoInstalacao {
  estado ??= calcular();
  return estado;
}

export function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function dispensar(): void {
  try {
    localStorage.setItem(CHAVE_DISPENSA, '1');
  } catch {
    // sem armazenamento: a faixa só some até recarregar
  }
  dispensada = true;
  mudou();
}

/** Uso único: o navegador não deixa reaproveitar o evento. Chamar só dentro do clique do usuário. */
export async function pedirInstalacao(): Promise<EscolhaInstalacao> {
  const evento = promptGuardado;
  if (!evento) throw new Error('sem prompt de instalação disponível');
  promptGuardado = null;
  mudou();
  await evento.prompt();
  return evento.userChoice;
}
