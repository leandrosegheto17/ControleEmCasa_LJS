import { Navigate, type RouteObject } from 'react-router';
import type { HandleRota } from './ganchos/useTituloDaPagina';
import { AreaAutenticada } from './paginas/AreaAutenticada';
import { AreaPublica } from './paginas/AreaPublica';
import { NaoEncontrada } from './paginas/NaoEncontrada';
import { Inicio } from './paginas/app/Inicio';
import { useInstalar } from './componentes/instalar/ContextoInstalar';
import { dispensar, pedirInstalacao } from './pwa/instalacao';
import { useInstalacao } from './pwa/useInstalacao';

/** `paginas/` não importa `pwa/`: a raiz liga o estado de instalação à área autenticada. */
function AreaComInstalacao() {
  const { plataforma, instalado, temPrompt, mostrarFaixa } = useInstalacao();
  return (
    <AreaAutenticada
      plataforma={plataforma}
      instalado={instalado}
      temPrompt={temPrompt}
      mostrarFaixa={mostrarFaixa}
      aoPedirPrompt={() => void pedirInstalacao().catch(() => {})}
      aoDispensar={dispensar}
    />
  );
}

function AjustesInstalavel({ Ajustes }: { Ajustes: typeof import('./paginas/Ajustes').Ajustes }) {
  const { instalado, instalar } = useInstalar();
  return <Ajustes instalado={instalado} aoInstalar={instalar} />;
}

const estreito = { estreito: true };
const comMes = { comMes: true };

/**
 * Rotas do front (SDD 9.3). Acesso em `/entrar` e `/redefinir-senha`; o app inteiro sob `/app`.
 * Etapa 12: Início, Lançar, Lançamentos e Ajustes (lotes 1 e 2); fixas, orçamento e metas vêm nos lotes seguintes.
 * Rotas de `/app/...` ficam antes do coringa `/app/*`. Para a etapa 14, a landing em `/`.
 */
export const mapaRotas: RouteObject[] = [
  // SPEC_DEVIATION: a landing (`/`) é da etapa 14; até lá a raiz leva ao app, e a guarda a leva a /entrar sem sessão.
  { path: '/', element: <Navigate to="/app" replace /> },
  {
    // Quem já entrou vai para o app (ou para o `volta`).
    element: <AreaPublica redirecionaComSessao />,
    children: [
      {
        path: '/entrar',
        lazy: () => import('./paginas/Entrar').then((m) => ({ Component: m.Entrar })),
        handle: { titulo: 'Entrar' } satisfies HandleRota,
      },
      {
        path: '/cadastro',
        lazy: () => import('./paginas/Cadastro').then((m) => ({ Component: m.Cadastro })),
        handle: { titulo: 'Criar conta' } satisfies HandleRota,
      },
    ],
  },
  {
    // O link do e-mail com token tem de funcionar mesmo com outra sessão aberta.
    element: <AreaPublica />,
    children: [
      {
        path: '/redefinir-senha',
        lazy: () => import('./paginas/RedefinirSenha').then((m) => ({ Component: m.RedefinirSenha })),
        handle: { titulo: 'Redefinir senha' } satisfies HandleRota,
      },
      {
        path: '/confirmar',
        lazy: () => import('./paginas/Confirmar').then((m) => ({ Component: m.Confirmar })),
        handle: { titulo: 'Confirmar e-mail' } satisfies HandleRota,
      },
      {
        path: '/convite',
        lazy: () => import('./paginas/Convite').then((m) => ({ Component: m.Convite })),
        handle: { titulo: 'Convite' } satisfies HandleRota,
      },
      {
        path: '/termos',
        lazy: () => import('./paginas/PaginaLegal').then((m) => ({ Component: m.Termos })),
        handle: { titulo: 'Termos de uso' } satisfies HandleRota,
      },
      {
        path: '/privacidade',
        lazy: () => import('./paginas/PaginaLegal').then((m) => ({ Component: m.Privacidade })),
        handle: { titulo: 'Política de privacidade' } satisfies HandleRota,
      },
    ],
  },
  {
    element: <AreaComInstalacao />,
    children: [
      { path: '/app', element: <Inicio />, handle: { titulo: 'Início', ...comMes } satisfies HandleRota },
      // A rota abre a folha Lançar sobre o Início; fechá-la volta a `/app` (`useAberturaLancar`).
      { path: '/app/lancar', element: <Inicio />, handle: { titulo: 'Lançar' } satisfies HandleRota },
      {
        path: '/app/lancamentos',
        lazy: () => import('./paginas/Lancamentos').then((m) => ({ Component: m.Lancamentos })),
        handle: { titulo: 'Lançamentos', ...comMes } satisfies HandleRota,
      },
      {
        path: '/app/lancamentos/:id',
        lazy: () => import('./paginas/Lancamento').then((m) => ({ Component: m.Lancamento })),
        handle: { titulo: 'Lançamento', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/bem-vindo',
        lazy: () => import('./paginas/app/BemVindo').then((m) => ({ Component: m.BemVindo })),
        handle: { titulo: 'Bem-vindo' } satisfies HandleRota,
      },
      {
        path: '/app/aceitar-termos',
        lazy: () => import('./paginas/app/AceitarTermos').then((m) => ({ Component: m.AceitarTermos })),
        handle: { titulo: 'Termos atualizados' } satisfies HandleRota,
      },
      {
        path: '/app/ajustes',
        lazy: () =>
          import('./paginas/Ajustes').then((m) => ({ Component: () => <AjustesInstalavel Ajustes={m.Ajustes} /> })),
        handle: { titulo: 'Ajustes', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/contas',
        lazy: () => import('./paginas/Contas').then((m) => ({ Component: m.Contas })),
        handle: { titulo: 'Contas', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/contas/nova',
        lazy: () => import('./paginas/Conta').then((m) => ({ Component: m.Conta })),
        handle: { titulo: 'Nova conta', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/contas/:id',
        lazy: () => import('./paginas/Conta').then((m) => ({ Component: m.Conta })),
        handle: { titulo: 'Conta', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/formas',
        lazy: () => import('./paginas/FormasPagamento').then((m) => ({ Component: m.FormasPagamento })),
        handle: { titulo: 'Formas de pagamento', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/formas/nova',
        lazy: () => import('./paginas/FormaPagamento').then((m) => ({ Component: m.FormaPagamento })),
        handle: { titulo: 'Nova forma', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/formas/:id',
        lazy: () => import('./paginas/FormaPagamento').then((m) => ({ Component: m.FormaPagamento })),
        handle: { titulo: 'Forma de pagamento', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/categorias',
        lazy: () => import('./paginas/Categorias').then((m) => ({ Component: m.Categorias })),
        handle: { titulo: 'Categorias', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/categorias/nova',
        lazy: () => import('./paginas/Categoria').then((m) => ({ Component: m.Categoria })),
        handle: { titulo: 'Nova categoria', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/categorias/:id',
        lazy: () => import('./paginas/Categoria').then((m) => ({ Component: m.Categoria })),
        handle: { titulo: 'Categoria', ...estreito } satisfies HandleRota,
      },
      { path: '/app/*', Component: NaoEncontrada, handle: { titulo: 'Página não encontrada' } satisfies HandleRota },
    ],
  },
  { path: '*', Component: NaoEncontrada, handle: { titulo: 'Página não encontrada' } satisfies HandleRota },
];
