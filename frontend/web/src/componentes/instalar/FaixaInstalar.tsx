import { Botao } from '../base/Botao';
import { BotaoIcone } from '../base/BotaoIcone';
import { Faixa } from '../base/Faixa';

interface Props {
  aoInstalar: () => void;
  aoDispensar: () => void;
}

/** Convite no topo da T02, só no navegador do celular. Dispensar é lembrado; "Instalar" não dispensa. */
export function FaixaInstalar({ aoInstalar, aoDispensar }: Props) {
  return (
    <Faixa
      variante="instalar"
      acoes={
        <>
          <Botao variante="principal" onClick={aoInstalar}>
            Instalar
          </Botao>
          <BotaoIcone icone="fechar" rotulo="Dispensar instalação" onClick={aoDispensar} />
        </>
      }
    >
      Instale o Controle em Casa para lançar mais rápido.
    </Faixa>
  );
}
