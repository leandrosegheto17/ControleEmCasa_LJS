import { RotuloParcial } from '../base/RotuloParcial';
import receita from '../LinhaLancamento.module.css';
import estilos from './LinhasValores.module.css';

interface Props {
  /** `texto`: o valor não é número (ex.: um mês) e usa a fonte do texto; `receita`: valor na cor de receita. */
  linhas: readonly { rotulo: string; valor: string; texto?: boolean; receita?: boolean; parcial?: boolean }[];
}

/** Pares rótulo/valor de um cartão; o valor já vem formatado. */
export function LinhasValores({ linhas }: Props) {
  return (
    <dl className={estilos.linhas}>
      {linhas.map((l) => (
        <div key={l.rotulo}>
          <dt>
            {l.rotulo}
            {l.parcial ? (
              <>
                {' '}
                <RotuloParcial />
              </>
            ) : null}
          </dt>
          <dd className={l.texto ? undefined : l.receita ? `valor ${receita['valor-receita']}` : 'valor'}>{l.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
