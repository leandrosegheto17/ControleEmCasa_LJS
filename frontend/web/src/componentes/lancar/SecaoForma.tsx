import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { ROTULO_TIPO_FORMA } from '../../rotulos/tipoForma';
import { BotaoForma } from '../base/BotaoForma';

interface Props {
  formas: DadosLancamento['formas'];
  valor: string | null;
  aoMudar: (id: string) => void;
}

export function SecaoForma({ formas, valor, aoMudar }: Props) {
  if (formas.length === 0 || valor === null) return null;
  return (
    <BotaoForma
      id="forma"
      rotulo="Forma de pagamento"
      opcoes={formas.map((f) => ({ id: f.id, nome: f.nome, detalhe: ROTULO_TIPO_FORMA[f.tipo].texto }))}
      valor={valor}
      aoEscolher={aoMudar}
    />
  );
}
