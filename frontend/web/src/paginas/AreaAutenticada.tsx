import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { flushSync } from 'react-dom';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { RegiaoAvisos } from '../componentes/base/RegiaoAvisos';
import { correcaoDoItem } from '../componentes/envios/correcaoDoItem';
import { EstruturaApp } from '../componentes/EstruturaApp';
import { ProvedorInstalar } from '../componentes/instalar/ProvedorInstalar';
import { lerMesDaUrl } from '../formatacao/mes';
import { decidirRotaDoApp } from '../ganchos/guardas';
import { saiuDePropositoAgora, desmarcarSaidaDeProposito } from '../ganchos/saidaDeProposito';
import { useAcoesFila } from '../ganchos/useAcoesFila';
import { useContexto } from '../ganchos/useContexto';
import { useEnvioAutomatico } from '../ganchos/useEnvioAutomatico';
import { useSessao } from '../ganchos/useSessao';
import type { ItemFila } from '../ganchos/usePendentes';
import { useHandleDaRota, useTituloDaPagina } from '../ganchos/useTituloDaPagina';
import { EnviosConectado } from './envios/EnviosConectado';
import { LancarConectado } from './lancar/LancarConectado';
import { useAberturaLancar } from './lancar/useAberturaLancar';

type PropsInstalar = Omit<ComponentProps<typeof ProvedorInstalar>, 'children'>;

/** Telas com a moldura do app (trilho e barra). As de passagem (bem-vindo, termos) ficam sem ela. */
const SEM_MOLDURA = new Set(['/app/bem-vindo', '/app/aceitar-termos']);

function Moldura() {
  const [params] = useSearchParams();
  const handle = useHandleDaRota();
  const mesDaUrl = lerMesDaUrl(params);
  const contexto = useContexto();
  useTituloDaPagina(mesDaUrl ?? contexto.data?.mes_corrente);
  useEnvioAutomatico();
  const { aberta, abrir, fechar } = useAberturaLancar();
  const refValor = useRef<HTMLInputElement>(null);
  const acoes = useAcoesFila();
  const [correcao, setCorrecao] = useState<ComponentProps<typeof LancarConectado>['correcao']>();

  // Mostrar a folha e focar o valor no mesmo handler síncrono: o iOS só abre o teclado
  // se o foco acontece dentro do gesto do toque.
  function lancar() {
    flushSync(abrir);
    refValor.current?.focus();
  }

  function corrigir(item: ItemFila) {
    flushSync(() => {
      setCorrecao((atual) => ({ chave: (atual?.chave ?? 0) + 1, valores: correcaoDoItem(item) }));
      abrir();
    });
    refValor.current?.focus();
  }

  function fecharLancar() {
    acoes.cancelarCorrecao();
    fechar();
  }

  return (
    <>
      <EstruturaApp aoLancar={lancar} mes={mesDaUrl ?? undefined} estreito={handle?.estreito}>
        <Outlet />
      </EstruturaApp>
      <LancarConectado
        aberta={aberta}
        aoFechar={fecharLancar}
        refValor={refValor}
        correcao={correcao}
        aoAceitar={() => void acoes.concluirCorrecao()}
      />
      <EnviosConectado acoes={acoes} aoCorrigir={corrigir} />
    </>
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
  const ativa = estado.situacao === 'ativa';
  // A marca de "saí de propósito" só vale até a próxima sessão ativa (a guarda só a lê).
  useEffect(() => {
    if (ativa) desmarcarSaidaDeProposito();
  }, [ativa]);
  if (decisao.tipo === 'esperar') return null;
  if (decisao.tipo === 'ir') {
    // Saída escolhida pelo membro: o login seguinte não deve voltar a uma tela privada (ex.: Ajustes).
    const semVolta = estado.situacao === 'sem-sessao' && saiuDePropositoAgora();
    return (
      <>
        <Navigate to={semVolta ? '/entrar' : decisao.para} replace />
        {semVolta ? <GastarMarcaDeSaida /> : null}
      </>
    );
  }
  return (
    <RegiaoAvisos>
      <ProvedorInstalar {...instalacao}>{SEM_MOLDURA.has(pathname) ? <SemMoldura /> : <Moldura />}</ProvedorInstalar>
    </RegiaoAvisos>
  );
}

/** A marca de "saí de propósito" vale para um redirecionamento só (a guarda renderiza mais de uma vez). */
function GastarMarcaDeSaida() {
  useEffect(() => {
    desmarcarSaidaDeProposito();
  }, []);
  return null;
}

function SemMoldura() {
  useTituloDaPagina();
  return <Outlet />;
}
