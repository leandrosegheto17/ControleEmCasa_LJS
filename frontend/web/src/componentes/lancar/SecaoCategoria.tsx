import { useRef, useState } from 'react';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { Icone } from '../base/Icone';
import { GrupoChips } from '../base/GrupoChips';
import { SeloEscopo } from '../base/SeloEscopo';
import estilosChip from '../base/Chips.module.css';
import { ListaCategorias } from './ListaCategorias';

type Categoria = Pick<DadosLancamento['categorias_despesa'][number], 'id' | 'nome' | 'escopo'>;

interface Props {
  categorias: Categoria[];
  valor: string | null;
  aoMudar: (id: string) => void;
  erro?: string;
  /** Legenda do grupo (padrão "Categoria"). */
  rotulo?: string;
  /** Receita: a grade mostra todas (até 9) e não tem "Outras…"; passando de 9, volta a 8 + "Outras…". */
  semOutras?: boolean;
}

const NA_GRADE = 8;
const NA_GRADE_SEM_OUTRAS = 9;

const selo = (c: Categoria) => (
  <span className={estilosChip['chip-escopo']}>
    <SeloEscopo escopo={c.escopo} />
  </span>
);

/** As 8 primeiras na ordem recebida (a API ordena por uso) e "Outras…" para o resto. */
export function SecaoCategoria({ categorias, valor, aoMudar, erro, rotulo = 'Categoria', semOutras = false }: Props) {
  const [listaAberta, setListaAberta] = useState(false);
  const botaoOutras = useRef<HTMLButtonElement>(null);
  const cabeTodas = semOutras && categorias.length <= NA_GRADE_SEM_OUTRAS;
  const limite = cabeTodas ? categorias.length : NA_GRADE;
  const naGrade = categorias.slice(0, limite);
  const escolhidaFora = categorias.slice(limite).find((c) => c.id === valor);

  const fechar = () => {
    setListaAberta(false);
    botaoOutras.current?.focus();
  };
  const escolher = (id: string) => {
    aoMudar(id);
    fechar();
  };

  const classeBotao = `${estilosChip.chip} ${escolhidaFora ? estilosChip['chip-escolhida'] : estilosChip['chip-outras']}`;
  const botao = (
    <button
      ref={botaoOutras}
      type="button"
      className={classeBotao}
      aria-expanded={listaAberta}
      onClick={() => setListaAberta((aberta) => !aberta)}
    >
      {escolhidaFora ? (
        <>
          <span className={estilosChip['chip-nome']}>{escolhidaFora.nome}</span>
          {selo(escolhidaFora)}
          <Icone nome="marcado" className={estilosChip['chip-marcado']} />
        </>
      ) : (
        'Outras…'
      )}
    </button>
  );

  return (
    <>
      <GrupoChips
        nome="categoria"
        rotulo={rotulo}
        rotuloAfastado
        variante="grade"
        opcoes={naGrade.map((c) => ({ valor: c.id, conteudo: c.nome, complemento: selo(c) }))}
        valor={valor ?? ''}
        aoMudar={aoMudar}
        erro={erro}
        extra={cabeTodas ? undefined : botao}
      />
      {listaAberta && !cabeTodas ? (
        <ListaCategorias categorias={categorias} aoEscolher={escolher} aoFechar={fechar} />
      ) : null}
    </>
  );
}
