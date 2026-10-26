import { Navigate, type RouteObject } from 'react-router';
import type { HandleRota } from './ganchos/useTituloDaPagina';
import { AreaAutenticada } from './paginas/AreaAutenticada';
import { AreaPublica } from './paginas/AreaPublica';
import { NaoEncontrada } from './paginas/NaoEncontrada';
import { Inicio } from './paginas/app/Inicio';

/**
 * Rotas do front (SDD 9.3). Acesso em `/entrar` e `/redefinir-senha`; o app inteiro sob `/app`.
 * Fica para a etapa 12 o resto de `/app/*`; para a 14, a landing em `/`; para o lote 2 da 11, cadastro e confirmação.
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
    ],
  },
  {
    element: <AreaAutenticada />,
    children: [
      { path: '/app', element: <Inicio />, handle: { titulo: 'Início' } satisfies HandleRota },
      { path: '/app/*', Component: NaoEncontrada, handle: { titulo: 'Página não encontrada' } satisfies HandleRota },
    ],
  },
  { path: '*', Component: NaoEncontrada, handle: { titulo: 'Página não encontrada' } satisfies HandleRota },
];
