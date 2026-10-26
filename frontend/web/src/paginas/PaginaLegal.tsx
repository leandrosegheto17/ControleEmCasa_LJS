import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../comum/versoes';

/** Moldura das páginas legais. O texto é provisório até a revisão jurídica (etapa 14). */
function PaginaLegal({ titulo, versao, children }: { titulo: string; versao: string; children: ReactNode }) {
  return (
    <main>
      <h1>{titulo}</h1>
      <p>
        <strong>Texto provisório.</strong> Esta versão ({versao}) será revisada antes da publicação do Controle em Casa.
      </p>
      {children}
      <p>
        <Link to="/entrar">Voltar</Link>
      </p>
    </main>
  );
}

export function Termos() {
  return (
    <PaginaLegal titulo="Termos de uso" versao={VERSAO_TERMOS}>
      <p>O Controle em Casa ajuda casais a registrar e acompanhar as despesas e metas da casa.</p>
      <p>
        Você é responsável pela veracidade dos dados que registra e pela guarda da sua senha. O serviço pode ser
        alterado ou interrompido para manutenção.
      </p>
    </PaginaLegal>
  );
}

export function Privacidade() {
  return (
    <PaginaLegal titulo="Política de privacidade" versao={VERSAO_PRIVACIDADE}>
      <p>
        Guardamos seu nome, e-mail e os dados financeiros que você registra. Os registros individuais não são visíveis
        para a outra pessoa do lar.
      </p>
      <p>Você pode pedir a exclusão da conta; os dados são apagados após o prazo de carência.</p>
    </PaginaLegal>
  );
}
