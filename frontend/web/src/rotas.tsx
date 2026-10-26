import { Outlet, type RouteObject } from 'react-router';
import { SpriteIcones } from './componentes/base/SpriteIcones';
import { mapaRotas } from './mapaRotas';

function Raiz() {
  return (
    <>
      <SpriteIcones />
      <Outlet />
    </>
  );
}

// Sem HydrateFallback o React Router avisa no console; a primeira tela só aparece depois da guarda de sessão.
export const rotas: RouteObject[] = [{ element: <Raiz />, HydrateFallback: () => null, children: mapaRotas }];
