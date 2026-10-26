import { useEffect, type PointerEvent } from 'react';
import { Botao } from '../base/Botao';
import { observarFolga } from '../base/folgaTeclado';
import { rotuloBotaoLancar } from './rotuloBotaoLancar';
import type { TipoLancamento } from '../../comum/envio';

interface Props {
  centavos: number;
  parcelas: number;
  tipo?: TipoLancamento;
  /** Envio em andamento: o botão fica `aria-disabled` e mostra "Lançando…". */
  ocupado: boolean;
  /** Enquanto a folha está aberta, o rodapé acompanha a altura do teclado virtual. */
  ativo: boolean;
}

/** Botão fixo do rodapé; sempre habilitado: o que falta preencher é dito no envio. */
export function BotaoLancar({ centavos, parcelas, tipo, ocupado, ativo }: Props) {
  useEffect(() => (ativo ? observarFolga(document.documentElement) : undefined), [ativo]);

  // Sem tirar o foco do campo, o teclado não fecha ao tocar no botão.
  const manterFoco = (evento: PointerEvent<HTMLButtonElement>) => evento.preventDefault();

  return (
    <Botao
      variante="principal"
      bloco
      tipo="submit"
      form="form-lancar"
      salvando={ocupado}
      rotuloOcupado="Lançando…"
      onPointerDown={manterFoco}
    >
      {rotuloBotaoLancar(centavos, parcelas, tipo)}
    </Botao>
  );
}
