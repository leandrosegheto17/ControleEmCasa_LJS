import { useId } from 'react';
import { formatarData, hojeEmSaoPaulo } from '../../formatacao/data';
import { Botao } from '../base/Botao';
import { Nota } from '../base/Nota';

interface Props {
  email: string;
  /** Instante ISO em que o convite deixa de valer. */
  expiraEm: string;
  cancelando: boolean;
  aoCancelar: () => void;
}

/** O convite enviado e ainda não respondido: quem recebeu, até quando vale e como cancelar. */
export function ConvitePendente({ email, expiraEm, cancelando, aoCancelar }: Props) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>Convite pendente</h2>
      <Nota>
        Convite enviado para <strong>{email}</strong>, válido até {formatarData(hojeEmSaoPaulo(new Date(expiraEm)))}.
      </Nota>
      <Botao variante="secundario" salvando={cancelando} rotuloOcupado="Cancelando…" onClick={aoCancelar}>
        Cancelar convite
      </Botao>
    </section>
  );
}
