import { type RouteObject } from 'react-router';
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

/** Push no iPhone/iPad só existe com o app instalado: `paginas/` não importa `pwa/`, a raiz informa. */
function NotificacoesInstalavel({
  Notificacoes,
}: {
  Notificacoes: typeof import('./paginas/Notificacoes').Notificacoes;
}) {
  const { plataforma, instalado } = useInstalacao();
  return <Notificacoes iosForaDoInstalado={plataforma === 'ios' && !instalado} />;
}

const estreito = { estreito: true };
const comMes = { comMes: true };

/**
 * Rotas do front (SDD 9.3). Acesso em `/entrar` e `/redefinir-senha`; o app inteiro sob `/app`.
 * Etapa 12: Início, Lançar, Lançamentos e Ajustes (lotes 1 e 2), fixas e orçamento (lote 3), metas e convite de membro (lote 4).
 * Rotas de `/app/...` ficam antes do coringa `/app/*`. Etapa 14: landing em `/`, `/confirmar-exclusao` e `/app/ajustes/conta`.
 */
export const mapaRotas: RouteObject[] = [
  // Landing pública, sem guarda e sem redirecionar quem já entrou: ele vê "Abrir o app" (etapa 14).
  {
    path: '/',
    lazy: () => import('./paginas/publicas/Landing').then((m) => ({ Component: m.Landing })),
    handle: { titulo: 'As finanças da casa, em dois' } satisfies HandleRota,
  },
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
        path: '/confirmar-exclusao',
        lazy: () => import('./paginas/ConfirmarExclusao').then((m) => ({ Component: m.ConfirmarExclusao })),
        handle: { titulo: 'Excluir conta' } satisfies HandleRota,
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
        path: '/app/fixas',
        lazy: () => import('./paginas/DespesasFixas').then((m) => ({ Component: m.DespesasFixas })),
        handle: { titulo: 'Despesas fixas', ...comMes, ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/fixas/nova',
        lazy: () => import('./paginas/DespesaFixa').then((m) => ({ Component: m.DespesaFixa })),
        handle: { titulo: 'Nova despesa fixa', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/fixas/:id',
        lazy: () => import('./paginas/DespesaFixa').then((m) => ({ Component: m.DespesaFixa })),
        handle: { titulo: 'Despesa fixa', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/orcamento',
        lazy: () => import('./paginas/Orcamento').then((m) => ({ Component: m.Orcamento })),
        handle: { titulo: 'Orçamento', ...comMes } satisfies HandleRota,
      },
      {
        path: '/app/metas',
        lazy: () => import('./paginas/Metas').then((m) => ({ Component: m.Metas })),
        handle: { titulo: 'Metas' } satisfies HandleRota,
      },
      {
        path: '/app/metas/nova',
        lazy: () => import('./paginas/MetaFormulario').then((m) => ({ Component: m.MetaFormulario })),
        handle: { titulo: 'Nova meta', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/metas/:id',
        lazy: () => import('./paginas/Meta').then((m) => ({ Component: m.Meta })),
        handle: { titulo: 'Meta' } satisfies HandleRota,
      },
      {
        path: '/app/metas/:id/editar',
        lazy: () => import('./paginas/MetaFormulario').then((m) => ({ Component: m.MetaFormulario })),
        handle: { titulo: 'Editar meta', ...estreito } satisfies HandleRota,
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
        path: '/app/ajustes/conta',
        lazy: () => import('./paginas/ExcluirConta').then((m) => ({ Component: m.ExcluirConta })),
        handle: { titulo: 'Conta', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/notificacoes',
        lazy: () =>
          import('./paginas/Notificacoes').then((m) => ({
            Component: () => <NotificacoesInstalavel Notificacoes={m.Notificacoes} />,
          })),
        handle: { titulo: 'Notificações', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/lar',
        lazy: () => import('./paginas/Lar').then((m) => ({ Component: m.Lar })),
        handle: { titulo: 'Casa e membros', ...estreito } satisfies HandleRota,
      },
      {
        path: '/app/ajustes/plano',
        lazy: () => import('./paginas/MeuPlano').then((m) => ({ Component: m.MeuPlano })),
        handle: { titulo: 'Meu plano', ...estreito } satisfies HandleRota,
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
