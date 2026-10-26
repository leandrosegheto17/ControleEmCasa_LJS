import type { ComponentProps } from 'react';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { RegiaoAvisos } from '../componentes/base/RegiaoAvisos';
import { EstruturaApp } from '../componentes/EstruturaApp';
import { ProvedorInstalar } from '../componentes/instalar/ProvedorInstalar';
import { lerMesDaUrl } from '../formatacao/mes';
import { decidirRotaDoApp } from '../ganchos/guardas';
import { useContexto } from '../ganchos/useContexto';
import { useSessao } from '../ganchos/useSessao';
import { useHandleDaRota, useTituloDaPagina } from '../ganchos/useTituloDaPagina';

type PropsInstalar = Omit<ComponentProps<typeof ProvedorInstalar>, 'children'>;

/** Telas com a moldura do app (trilho e barra). As de passagem (bem-vindo, termos) ficam sem ela. */
const SEM_MOLDURA = new Set(['/app/bem-vindo', '/app/aceitar-termos']);

function Moldura() {
  const [params] = useSearchParams();
  const handle = useHandleDaRota();
  const mesDaUrl = lerMesDaUrl(params);
  const contexto = useContexto();
  useTituloDaPagina(mesDaUrl ?? contexto.data?.mes_corrente);
  // SPEC_DEVIATION: a folha "Lançar" (botão "+") é do lote 2 da etapa 12; até lá o botão não abre nada.
  return (
    <EstruturaApp aoLancar={() => {}} mes={mesDaUrl ?? undefined} estreito={handle?.estreito}>
      <Outlet />
    </EstruturaApp>
  );
}

/**
 * Guarda de navegação de `/app/*` (SDD 9.3): sem sessão vai para `/entrar?volta=`; termos pendentes e falta de lar
 * levam às suas telas. A proteção dos dados é do servidor (sessão, RLS); esta guarda só encaminha.
 */
export function AreaAutenticada(instalacao: PropsInstalar) {
  const estado = useSessao();
  const { pathname, search } = useLocation();
  const decisao = decidirRotaDoApp(estado, pathname, search);
  if (decisao.tipo === 'esperar') return null;
  if (decisao.tipo === 'ir') return <Navigate to={decisao.para} replace />;
  return (
    <RegiaoAvisos>
      <ProvedorInstalar {...instalacao}>{SEM_MOLDURA.has(pathname) ? <SemMoldura /> : <Moldura />}</ProvedorInstalar>
    </RegiaoAvisos>
  );
}

function SemMoldura() {
  useTituloDaPagina();
  return <Outlet />;
}
