import { Navigate, Outlet, useSearchParams } from 'react-router';
import { RegiaoAvisos } from '../componentes/base/RegiaoAvisos';
import { decidirRotaPublica } from '../ganchos/guardas';
import { useSessao } from '../ganchos/useSessao';
import { useTituloDaPagina } from '../ganchos/useTituloDaPagina';

/** Telas de acesso, sem moldura. `redirecionaComSessao` manda quem já entrou para o app (ou para o `volta`). */
export function AreaPublica({ redirecionaComSessao = false }: { redirecionaComSessao?: boolean }) {
  const estado = useSessao();
  const [params] = useSearchParams();
  useTituloDaPagina();
  const decisao = decidirRotaPublica(estado, { redirecionaComSessao, volta: params.get('volta') });
  if (decisao.tipo === 'esperar') return null;
  if (decisao.tipo === 'ir') return <Navigate to={decisao.para} replace />;
  return (
    <RegiaoAvisos>
      <Outlet />
    </RegiaoAvisos>
  );
}
