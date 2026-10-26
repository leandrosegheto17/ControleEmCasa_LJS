import type { ReactNode } from 'react';
import { Icone } from './Icone';
import estilos from './Chips.module.css';

interface Props {
  nome: string;
  valor: string;
  conteudo: ReactNode;
  /** Fica abaixo do nome, fora do limite de 2 linhas (ex.: selo de escopo). */
  complemento?: ReactNode;
  marcado: boolean;
  desabilitado?: boolean;
  /** Só a grade mostra o ícone de marcado; na linha vale a borda de 2 px + fundo. */
  comIcone: boolean;
  /** Rádio que recebe o aria-invalid do grupo com erro (alvo do foco). */
  invalido?: boolean;
  aoMudar: (valor: string) => void;
}

export function ChipOpcao({
  nome,
  valor,
  conteudo,
  complemento,
  marcado,
  desabilitado,
  comIcone,
  invalido,
  aoMudar,
}: Props) {
  return (
    <label className={estilos.chip}>
      <input
        type="radio"
        name={nome}
        value={valor}
        checked={marcado}
        disabled={desabilitado}
        aria-invalid={invalido ? true : undefined}
        onChange={() => aoMudar(valor)}
      />
      <span className={estilos['chip-nome']}>{conteudo}</span>
      {complemento}
      {comIcone && marcado ? <Icone nome="marcado" className={estilos['chip-marcado']} /> : null}
    </label>
  );
}
