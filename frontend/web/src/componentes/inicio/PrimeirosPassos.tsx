import { LinkMais } from '../base/LinkMais';
import passos from '../base/Passos.module.css';
import estilos from './PrimeirosPassos.module.css';

interface Props {
  temConta: boolean;
  temForma: boolean;
  instalado: boolean;
}

interface Passo {
  texto: string;
  para: string;
  feito: boolean;
}

/** Cartão de boas-vindas: some quando já existem conta e forma de pagamento. */
export function PrimeirosPassos({ temConta, temForma, instalado }: Props) {
  if (temConta && temForma) return null;

  const itens: Passo[] = [
    { texto: 'Cadastre uma conta', para: '/app/ajustes/contas/nova', feito: temConta },
    { texto: 'Cadastre uma forma de pagamento', para: '/app/ajustes/formas/nova', feito: temForma },
    { texto: 'Instale o app no celular', para: '/app/ajustes?instalar=1', feito: instalado },
  ];

  return (
    <section className={estilos['primeiros-passos']} aria-labelledby="pp-titulo">
      <h2 className={estilos.titulo} id="pp-titulo">
        Primeiros passos
      </h2>
      <p className={estilos.texto}>
        Para lançar o primeiro gasto, cadastre uma conta e uma forma de pagamento. As categorias iniciais já foram
        criadas.
      </p>
      <ol className={`${passos.passos} ${estilos.lista}`}>
        {itens.map((passo, i) => (
          <li key={passo.para} className={passo.feito ? passos['passo-feito'] : undefined}>
            <span className={passos['passo-num']} aria-hidden="true">
              {i + 1}
            </span>
            <LinkMais para={passo.para}>
              {passo.texto}
              {passo.feito ? <span className="visualmente-oculto"> (feito)</span> : null}
            </LinkMais>
          </li>
        ))}
      </ol>
    </section>
  );
}
