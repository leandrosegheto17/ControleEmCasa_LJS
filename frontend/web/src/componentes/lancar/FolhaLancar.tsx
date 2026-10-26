import { useEffect, useRef, type Ref } from 'react';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { TEXTO_NOTA_RECEITA } from '../../rotulos/textosConexao';
import { AvisoErroTopo } from '../base/AvisoErroTopo';
import { BotaoForma } from '../base/BotaoForma';
import { CampoTexto } from '../base/CampoTexto';
import { CampoValor } from '../base/CampoValor';
import { Faixa } from '../base/Faixa';
import { Folha } from '../base/Folha';
import { Nota } from '../base/Nota';
import { Segmentado } from '../base/Segmentado';
import { BotaoLancar } from './BotaoLancar';
import { LancarVazio } from './LancarVazio';
import { MaisDetalhes } from './MaisDetalhes';
import { SecaoCategoria } from './SecaoCategoria';
import { SecaoForma } from './SecaoForma';
import { SecaoParcelas } from './SecaoParcelas';
import type { EntradaFolha, ResultadoFolha, TipoLancamento } from '../../comum/envio';
import { useEnvioLancar } from './useEnvioLancar';
import { useFormularioLancar, type EstadoLancar } from './useFormularioLancar';
import estilo from './FolhaLancar.module.css';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  refValor: Ref<HTMLInputElement>;
  dados?: DadosLancamento;
  /** Envia a despesa ou a receita; sem ela a folha só valida. */
  aoLancar?: (entrada: EntradaFolha) => Promise<ResultadoFolha>;
  /** Sem rede: a faixa avisa que o lançamento fica guardado no aparelho. */
  offline?: boolean;
  /** Valores para abrir a folha já preenchida; cada `chave` nova substitui o que estava digitado. */
  correcao?: { chave: number; valores: EstadoLancar };
}

const TIPOS = [
  { valor: 'despesa', rotulo: 'Despesa' },
  { valor: 'receita', rotulo: 'Receita' },
];

/** Folha de lançamento: fica montada e oculta para o "+" poder focar o valor no mesmo clique. */
export function FolhaLancar({ aberta, aoFechar, refValor, dados, aoLancar, offline, correcao }: Props) {
  const { estado, erros, mudar, validar, limpar, preencher } = useFormularioLancar(dados);
  const chaveAplicada = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!correcao || chaveAplicada.current === correcao.chave) return;
    chaveAplicada.current = correcao.chave;
    preencher(correcao.valores);
  });
  const { formulario, ocupado, erroTopo, aoEnviar, aoTeclar } = useEnvioLancar({
    dados,
    estado,
    validar,
    limpar,
    aoLancar,
  });
  const tipoForma = dados?.formas.find((forma) => forma.id === estado.formaId)?.tipo ?? null;
  const receita = estado.tipo === 'receita';
  const semContas = dados !== undefined && dados.contas.length === 0;
  const vazio =
    dados !== undefined && (receita ? semContas : dados.formas.length === 0 || dados.categorias_despesa.length === 0);

  const detalhes = (
    <>
      <CampoTexto
        id="descricao"
        rotulo="Descrição (opcional)"
        autoComplete="off"
        value={estado.descricao}
        onChange={(e) => mudar('descricao', e.target.value)}
      />
      <MaisDetalhes data={estado.data} aoMudarData={(d) => mudar('data', d)} />
    </>
  );

  return (
    <Folha
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={receita ? 'Lançar receita' : 'Lançar'}
      tituloOculto={!vazio}
      montadaOculta
      focoInicial="#valor"
      ocupada={ocupado}
      topo={
        vazio && !receita ? undefined : (
          <Segmentado
            legenda="Tipo de lançamento"
            nome="tipo-lancamento"
            opcoes={TIPOS}
            valor={estado.tipo}
            aoMudar={(tipo) => mudar('tipo', tipo as TipoLancamento)}
          />
        )
      }
      rodape={
        vazio ? undefined : (
          <BotaoLancar
            centavos={estado.valorCentavos}
            parcelas={estado.parcelas}
            tipo={estado.tipo}
            ocupado={ocupado}
            ativo={aberta}
          />
        )
      }
    >
      {vazio && dados ? (
        <LancarVazio dados={dados} aoFechar={aoFechar} tipo={estado.tipo} />
      ) : (
        <>
          {offline ? <Faixa variante="offline" /> : null}
          {erroTopo ? <AvisoErroTopo>{erroTopo}</AvisoErroTopo> : null}
          <form
            ref={formulario}
            id="form-lancar"
            className={estilo.formulario}
            noValidate
            onSubmit={aoEnviar}
            onKeyDown={aoTeclar}
          >
            <CampoValor
              id="valor"
              ref={refValor}
              centavos={estado.valorCentavos}
              erro={erros.valor}
              anunciarErro
              aoMudar={(v) => mudar('valorCentavos', v)}
            />
            {dados && receita ? (
              <>
                <SecaoCategoria
                  categorias={dados.categorias_receita}
                  rotulo="Categoria de receita"
                  semOutras
                  valor={estado.categoriaId}
                  erro={erros.categoria}
                  aoMudar={(id) => mudar('categoriaId', id)}
                />
                {estado.contaId ? (
                  <BotaoForma
                    id="conta"
                    rotulo="Conta de destino"
                    opcoes={dados.contas.map((c) => ({ id: c.id, nome: c.nome }))}
                    valor={estado.contaId}
                    aoEscolher={(id) => mudar('contaId', id)}
                  />
                ) : null}
                {detalhes}
                <Nota>{TEXTO_NOTA_RECEITA}</Nota>
              </>
            ) : null}
            {dados && !receita ? (
              <>
                <SecaoCategoria
                  categorias={dados.categorias_despesa}
                  valor={estado.categoriaId}
                  erro={erros.categoria}
                  aoMudar={(id) => mudar('categoriaId', id)}
                />
                <SecaoForma formas={dados.formas} valor={estado.formaId} aoMudar={(id) => mudar('formaId', id)} />
                <SecaoParcelas tipoForma={tipoForma} valor={estado.parcelas} aoMudar={(n) => mudar('parcelas', n)} />
                {detalhes}
              </>
            ) : null}
          </form>
        </>
      )}
    </Folha>
  );
}
