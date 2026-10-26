import { Link } from 'react-router';
import { BotaoLink } from '../../componentes/base/BotaoLink';
import { Icone } from '../../componentes/base/Icone';
import { useMetaDaPagina } from '../../ganchos/useMetaDaPagina';
import { useSessao } from '../../ganchos/useSessao';
import { useTituloDaPagina } from '../../ganchos/useTituloDaPagina';
import { DESCRICAO_LANDING, PASSOS_COMO_FUNCIONA, PLANOS, PROPOSTA_DE_VALOR, SUBTITULO_LANDING } from './textosLanding';
import estilo from './Landing.module.css';

/**
 * Landing em `/` (SDD 9.3; etapa 14). Pública e sem guarda: quem já entrou não é redirecionado, ganha o link "Abrir o
 * app" no lugar de "Começar grátis" e "Entrar". Enquanto a sessão carrega vale a versão de visitante (sem piscar).
 */
export function Landing() {
  useTituloDaPagina();
  useMetaDaPagina(DESCRICAO_LANDING, '/');
  const estado = useSessao();
  const dentro = estado.situacao === 'ativa' || estado.situacao === 'presumida';

  return (
    <div className={estilo.pagina}>
      <header className={estilo.cabecalho}>
        <Link to="/" className={estilo.logo} aria-label="Controle em Casa, página inicial">
          <Icone nome="casa" />
          Controle em Casa
        </Link>
        <nav className={estilo.menu} aria-label="Acesso">
          {dentro ? (
            <BotaoLink para="/app" variante="secundario">
              Abrir o app
            </BotaoLink>
          ) : (
            <>
              <BotaoLink para="/entrar" variante="texto">
                Entrar
              </BotaoLink>
              <BotaoLink para="/cadastro" variante="secundario">
                Começar grátis
              </BotaoLink>
            </>
          )}
        </nav>
      </header>

      <main className={estilo.conteudo}>
        <section className={estilo.heroi} aria-labelledby="titulo-heroi">
          <h1 id="titulo-heroi" className={estilo.titulo}>
            {PROPOSTA_DE_VALOR}
          </h1>
          <p className={estilo.subtitulo}>{SUBTITULO_LANDING}</p>
          <div className={estilo.acoes}>
            {dentro ? (
              <BotaoLink para="/app" variante="principal">
                Abrir o app
              </BotaoLink>
            ) : (
              <>
                <BotaoLink para="/cadastro" variante="principal">
                  Começar grátis
                </BotaoLink>
                <BotaoLink para="/entrar" variante="texto">
                  Já tenho conta
                </BotaoLink>
              </>
            )}
          </div>
          <p className={estilo['nota-heroi']}>14 dias de Pro, sem cartão. Depois, continue no Free ou assine o Pro.</p>
        </section>

        <section className={estilo.secao} aria-labelledby="titulo-como">
          <h2 id="titulo-como" className={estilo['titulo-secao']}>
            Como funciona
          </h2>
          <ol className={`${estilo.grade} ${estilo['grade-tres']}`}>
            {PASSOS_COMO_FUNCIONA.map((passo, i) => (
              <li key={passo.titulo} className={estilo.cartao}>
                <span className={estilo.numero} aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className={estilo['titulo-cartao']}>{passo.titulo}</h3>
                <p className="texto-2">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={estilo.secao} aria-labelledby="titulo-planos">
          <h2 id="titulo-planos" className={estilo['titulo-secao']}>
            Planos
          </h2>
          <div className={estilo.grade}>
            {PLANOS.map((plano) => (
              <article
                key={plano.nome}
                className={`${estilo.cartao} ${plano.destaque ? estilo['cartao-destaque'] : ''}`}
                aria-labelledby={`plano-${plano.nome}`}
              >
                <h3 id={`plano-${plano.nome}`} className={estilo['titulo-cartao']}>
                  {plano.nome}
                </h3>
                <p className={estilo.preco}>
                  {plano.preco} <small>{plano.periodo}</small>
                </p>
                <ul className={estilo.itens}>
                  {plano.itens.map((item) => (
                    <li key={item}>
                      <Icone nome="marcado" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          {dentro ? null : (
            <div className={estilo.acoes}>
              <BotaoLink para="/cadastro" variante="principal">
                Começar grátis
              </BotaoLink>
            </div>
          )}
        </section>
      </main>

      <footer className={estilo.rodape}>
        <span>Controle em Casa</span>
        <nav aria-label="Rodapé">
          <Link to="/termos">Termos de uso</Link>
          <Link to="/privacidade">Política de privacidade</Link>
          {dentro ? <Link to="/app">Abrir o app</Link> : <Link to="/entrar">Entrar</Link>}
        </nav>
      </footer>
    </div>
  );
}
