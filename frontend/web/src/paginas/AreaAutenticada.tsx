import { Navigate, Outlet, useLocation } from 'react-router';
import { RegiaoAvisos } from '../componentes/base/RegiaoAvisos';
import { decidirRotaDoApp } from '../ganchos/guardas';
import { useSessao } from '../ganchos/useSessao';
import { useTituloDaPagina } from '../ganchos/useTituloDaPagina';

/**
 * Guarda de navegação de `/app/*` (SDD 9.3): sem sessão vai para `/entrar?volta=`; termos pendentes e falta de lar
 * levam às suas telas. A proteção dos dados é do servidor (sessão, RLS); esta guarda só encaminha.
 */
export function AreaAutenticada() {
  const estado = useSessao();
  const { pathname, search } = useLocation();
  useTituloDaPagina();
  const decisao = decidirRotaDoApp(estado, pathname, search);
  if (decisao.tipo === 'esperar') return null;
  if (decisao.tipo === 'ir') return <Navigate to={decisao.para} replace />;
  return (
    <RegiaoAvisos>
      <Outlet />
    </RegiaoAvisos>
  );
}
