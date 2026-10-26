import { Link } from 'react-router';
import { useMetaDaPagina } from '../../ganchos/useMetaDaPagina';
import { VERSAO_PRIVACIDADE, VERSAO_TERMOS } from '../../comum/versoes';
import { AVISO_RASCUNHO, SECOES_PRIVACIDADE, SECOES_TERMOS, type SecaoLegal } from './textosLegais';
import estilo from './PaginaLegal.module.css';

interface Props {
  titulo: string;
  descricao: string;
  caminho: string;
  versao: string;
  secoes: readonly SecaoLegal[];
}

/** Moldura das páginas legais: título, aviso de rascunho, a versão vigente (a que o aceite registra) e as seções. */
function PaginaLegal({ titulo, descricao, caminho, versao, secoes }: Props) {
  useMetaDaPagina(descricao, caminho);
  return (
    <main className={estilo.pagina}>
      <h1 className={estilo.titulo}>{titulo}</h1>
      <p className={estilo.aviso}>{AVISO_RASCUNHO}</p>
      <p className={estilo.versao}>Versão {versao}</p>
      {secoes.map((secao, i) => (
        <section key={secao.titulo} className={estilo.secao} aria-labelledby={`secao-legal-${i}`}>
          <h2 id={`secao-legal-${i}`}>{secao.titulo}</h2>
          {secao.paragrafos?.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {secao.itens ? (
            <ul>
              {secao.itens.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <nav className={estilo.rodape} aria-label="Outras páginas">
        <Link to="/">Página inicial</Link>
        <Link to="/termos">Termos de uso</Link>
        <Link to="/privacidade">Política de privacidade</Link>
        <Link to="/entrar">Entrar</Link>
      </nav>
    </main>
  );
}

export function Termos() {
  return (
    <PaginaLegal
      titulo="Termos de uso"
      descricao="Termos de uso do Controle em Casa: conta, planos, pagamento e exclusão."
      caminho="/termos"
      versao={VERSAO_TERMOS}
      secoes={SECOES_TERMOS}
    />
  );
}

export function Privacidade() {
  return (
    <PaginaLegal
      titulo="Política de privacidade"
      descricao="Política de privacidade do Controle em Casa: dados coletados, finalidade, operadores, direitos do titular e exclusão."
      caminho="/privacidade"
      versao={VERSAO_PRIVACIDADE}
      secoes={SECOES_PRIVACIDADE}
    />
  );
}
