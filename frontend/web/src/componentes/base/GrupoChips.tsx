import { useId, type ReactNode } from 'react';
import { ChipOpcao } from './ChipOpcao';
import estilos from './Chips.module.css';

export interface OpcaoChip {
  valor: string;
  conteudo: ReactNode;
  complemento?: ReactNode;
  desabilitada?: boolean;
}

interface Props {
  nome: string;
  rotulo: string;
  opcoes: OpcaoChip[];
  valor: string;
  aoMudar: (valor: string) => void;
  variante: 'grade' | 'linha';
  /** Último item da grade que não é rádio (ex.: botão "Outras…"). */
  extra?: ReactNode;
  erro?: string;
  /** Mais espaço entre o rótulo e as opções, como no formulário de movimento de meta. */
  rotuloAfastado?: boolean;
}

export function GrupoChips({ nome, rotulo, opcoes, valor, aoMudar, variante, extra, erro, rotuloAfastado }: Props) {
  const idErro = useId();
  const alvo = opcoes.find((o) => o.valor === valor && !o.desabilitada) ?? opcoes.find((o) => !o.desabilitada);
  return (
    <fieldset role="radiogroup" className={estilos.campo} aria-describedby={erro ? idErro : undefined}>
      <legend className={rotuloAfastado ? `${estilos.rotulo} ${estilos['rotulo-afastado']}` : estilos.rotulo}>
        {rotulo}
      </legend>
      <div className={variante === 'grade' ? estilos.chips : estilos['chips-linha']}>
        {opcoes.map((o) => (
          <ChipOpcao
            key={o.valor}
            nome={nome}
            valor={o.valor}
            conteudo={o.conteudo}
            complemento={o.complemento}
            marcado={o.valor === valor}
            desabilitado={o.desabilitada}
            comIcone={variante === 'grade'}
            invalido={Boolean(erro) && o === alvo}
            aoMudar={aoMudar}
          />
        ))}
        {extra}
      </div>
      {erro ? (
        <p id={idErro} className={estilos['campo-erro']}>
          {erro}
        </p>
      ) : null}
    </fieldset>
  );
}
