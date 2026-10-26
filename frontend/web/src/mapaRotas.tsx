import { Navigate, type RouteObject } from 'react-router';
import type { HandleRota } from './ganchos/useTituloDaPagina';
import { AreaAutenticada } from './paginas/AreaAutenticada';
import { AreaPublica } from './paginas/AreaPublica';
import { NaoEncontrada } from './paginas/NaoEncontrada';
import { Inicio } from './paginas/app/Inicio';

/**
 * Rotas do front (SDD 9.3). Acesso em `/entrar` e `/redefinir-senha`; o app inteiro sob `/app`.
 * Fica para a etapa 12 o resto de `/app/*`; para a 14, a landing em `/`.
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
    element: <AreaAutenticada />,
    children: [
      { path: '/app', element: <Inicio />, handle: { titulo: 'Início' } satisfies HandleRota },
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
      { path: '/app/*', Component: NaoEncontrada, handle: { titulo: 'Página não encontrada' } satisfies HandleRota },
    ],
  },
  { path: '*', Component: NaoEncontrada, handle: { titulo: 'Página não encontrada' } satisfies HandleRota },
];
