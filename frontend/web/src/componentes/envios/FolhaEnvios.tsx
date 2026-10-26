import { useEffect, useRef, useState } from 'react';
import type { ItemFila } from '../../comum/fila';
import { formatarMoeda } from '../../formatacao/moeda';
import { Botao } from '../base/Botao';
import { DialogoConfirmacao } from '../base/DialogoConfirmacao';
import { Folha } from '../base/Folha';
import { useAviso } from '../base/useAviso';
import lista from '../base/Lista.module.css';
import { ItemEnvio } from './ItemEnvio';
import { tituloEnvio } from './textoEnvio';

interface Props {
  aberta: boolean;
  itens: ItemFila[];
  /** Rodada de envio disparada por "Tentar agora" em andamento. */
  enviando: boolean;
  aoFechar: () => void;
  aoTentarAgora: () => void;
  aoCorrigir: (item: ItemFila) => void;
  /** Só é chamado depois da confirmação no diálogo. */
  aoDescartar: (id: string) => void;
}

/** Folha "Envios pendentes": o que está guardado no aparelho, com Corrigir, Descartar e Tentar agora. */
export function FolhaEnvios({ aberta, itens, enviando, aoFechar, aoTentarAgora, aoCorrigir, aoDescartar }: Props) {
  const { mostrar } = useAviso();
  const [paraDescartar, setParaDescartar] = useState<ItemFila | null>(null);
  const quantidadeAnterior = useRef(itens.length);

  useEffect(() => {
    if (aberta && quantidadeAnterior.current > 0 && itens.length === 0) {
      aoFechar();
      mostrar('sucesso', 'Tudo enviado');
    }
    quantidadeAnterior.current = itens.length;
  }, [aberta, itens.length, aoFechar, mostrar]);

  const haFalha = itens.some((i) => i.situacao === 'falhou');

  function confirmarDescarte() {
    if (paraDescartar) aoDescartar(paraDescartar.id);
    setParaDescartar(null);
  }

  return (
    <>
      <Folha
        aberta={aberta}
        aoFechar={aoFechar}
        titulo="Envios pendentes"
        rodape={
          <Botao
            variante="principal"
            bloco
            icone="recarregar"
            salvando={enviando}
            rotuloOcupado="Enviando…"
            onClick={aoTentarAgora}
          >
            Tentar agora
          </Botao>
        }
      >
        <p className="texto-2 pequeno">
          {haFalha
            ? 'Guardados neste aparelho. Nada some sem você confirmar.'
            : 'Guardados neste aparelho. São enviados sozinhos quando houver conexão.'}
        </p>
        <ul className={lista.lista}>
          {itens.map((item) => (
            <ItemEnvio
              key={item.id}
              item={item}
              enviando={enviando}
              aoCorrigir={aoCorrigir}
              aoDescartar={setParaDescartar}
            />
          ))}
        </ul>
      </Folha>
      <DialogoConfirmacao
        aberto={paraDescartar !== null}
        variante="destrutiva"
        titulo="Descartar este lançamento?"
        texto={
          paraDescartar
            ? `${tituloEnvio(paraDescartar)}, ${formatarMoeda(paraDescartar.args.valor_centavos)}, não será enviado e sai deste aparelho. Não dá para desfazer.`
            : ''
        }
        rotuloConfirmar="Descartar"
        aoConfirmar={confirmarDescarte}
        aoCancelar={() => setParaDescartar(null)}
      />
    </>
  );
}
