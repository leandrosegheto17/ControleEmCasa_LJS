import { useId, type ChangeEvent, type Ref, type SyntheticEvent } from 'react';
import { digitosParaCentavos } from '../../formatacao/centavos';
import { formatarMoeda } from '../../formatacao/moeda';
import { Campo, type PropsCampoBase } from './Campo';
import estiloCampo from './Campo.module.css';
import estilo from './CampoValor.module.css';

interface Props extends Omit<PropsCampoBase, 'rotulo'> {
  centavos: number;
  aoMudar: (centavos: number) => void;
  rotulo?: string;
  id?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Entrada de dinheiro em centavos inteiros: os dígitos entram pela direita (ADR-004). */
export function CampoValor({
  centavos,
  aoMudar,
  rotulo = 'Valor',
  ajuda,
  erro,
  anunciarErro,
  desabilitado,
  id,
  ref,
}: Props) {
  const idValor = `${useId()}-valor`;
  const formatado = formatarMoeda(centavos);

  function cursorNoFim(campo: HTMLInputElement) {
    const fim = campo.value.length;
    campo.setSelectionRange(fim, fim);
  }

  function aoSelecionar(evento: SyntheticEvent<HTMLInputElement>) {
    const campo = evento.currentTarget;
    // Seleção de trecho é mantida (substituir tudo); cursor solto no meio volta para o fim.
    if (campo.selectionStart === campo.selectionEnd && campo.selectionEnd !== campo.value.length) cursorNoFim(campo);
  }

  function aoDigitar(evento: ChangeEvent<HTMLInputElement>) {
    const campo = evento.currentTarget;
    let novo: number;
    try {
      novo = digitosParaCentavos(campo.value);
    } catch {
      // Acima do inteiro seguro: ignora a digitação (o limite de negócio é do servidor).
      return;
    }
    aoMudar(novo);
    // Editar no meio quebraria a regra da direita: o cursor volta para o fim depois do render.
    queueMicrotask(() => cursorNoFim(campo));
  }

  return (
    <div className={estilo.valor}>
      <Campo rotulo={rotulo} ajuda={ajuda} erro={erro} anunciarErro={anunciarErro} id={id}>
        {(ligacao) => (
          <>
            <input
              {...ligacao}
              aria-describedby={[ligacao['aria-describedby'], idValor].filter(Boolean).join(' ')}
              ref={ref}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              disabled={desabilitado}
              value={formatado}
              onChange={aoDigitar}
              onSelect={aoSelecionar}
              className={estiloCampo.entrada}
            />
            <span id={idValor} className="visualmente-oculto">
              {formatado}
            </span>
          </>
        )}
      </Campo>
    </div>
  );
}
