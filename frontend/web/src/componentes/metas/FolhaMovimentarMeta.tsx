import type { TipoMovimentoMeta } from '../../comum/enums';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatarMoeda } from '../../formatacao/moeda';
import { AvisoErroTopo } from '../base/AvisoErroTopo';
import { Botao } from '../base/Botao';
import { CampoData } from '../base/CampoData';
import { CampoTexto } from '../base/CampoTexto';
import { CampoValor } from '../base/CampoValor';
import { EstadoVazio } from '../base/EstadoVazio';
import { focarPrimeiroErro } from '../base/focarPrimeiroErro';
import { Folha } from '../base/Folha';
import { GrupoChips } from '../base/GrupoChips';
import { Segmentado } from '../base/Segmentado';
import { Selecao } from '../base/Selecao';
import estilo from './FolhaMovimentarMeta.module.css';

const FORMULARIO = 'form-mov';

export interface DadosMovimento {
  valorCentavos: number;
  local: string;
  data: string;
  /** Ausente quando a escolha é "Nenhuma". */
  contaId?: string;
}

interface Props {
  nomeMeta: string;
  tipo: TipoMovimentoMeta;
  /** Locais com valor guardado, na ordem da API; escolha da retirada. */
  porLocal: { local: string; guardado_centavos: number }[];
  /** Locais já usados em aportes, sugeridos no campo de local. */
  sugestoes: string[];
  contas: { id: string; nome: string }[];
  dataInicial: string;
  /** Erro do campo de valor vindo do servidor. */
  erroValor?: string;
  /** Erro do envio inteiro, no topo do formulário. */
  erro?: { texto: string; semConexao: boolean };
  salvando: boolean;
  aoMudarTipo: (tipo: TipoMovimentoMeta) => void;
  /** Valor ou local mudou: o erro do servidor deixa de valer. */
  aoEditar: () => void;
  aoConfirmar: (dados: DadosMovimento) => void;
  aoFechar: () => void;
}

const OPCOES_TIPO = [
  { valor: 'aporte', rotulo: 'Aporte' },
  { valor: 'retirada', rotulo: 'Retirada' },
];

/** Folha de aporte ou retirada de uma meta: valor, local, conta opcional e data. */
export function FolhaMovimentarMeta({
  nomeMeta,
  tipo,
  porLocal,
  sugestoes,
  contas,
  dataInicial,
  erroValor,
  erro,
  salvando,
  aoMudarTipo,
  aoEditar,
  aoConfirmar,
  aoFechar,
}: Props) {
  const retirada = tipo === 'retirada';
  const [valor, definirValor] = useState(0);
  const [localLivre, definirLocalLivre] = useState('');
  const [localEscolhido, definirLocalEscolhido] = useState<string | null>(null);
  const [contaId, definirContaId] = useState('');
  const [data, definirData] = useState(dataInicial);
  const [erros, definirErros] = useState<{ valor?: string; local?: string }>({});
  const [tentativasInvalidas, definirTentativasInvalidas] = useState(0);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (tentativasInvalidas > 0 && formulario.current) focarPrimeiroErro(formulario.current);
  }, [tentativasInvalidas]);

  const semSaldo = retirada && porLocal.length === 0;
  const local = retirada ? (localEscolhido ?? porLocal[0]?.local ?? '') : localLivre.trim();

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const novos = {
      valor: valor > 0 ? undefined : 'Informe um valor maior que zero.',
      local: local ? undefined : 'Informe onde está guardado.',
    };
    definirErros(novos);
    if (novos.valor || novos.local) {
      definirTentativasInvalidas((n) => n + 1);
      return;
    }
    aoConfirmar({ valorCentavos: valor, local, data, ...(contaId && { contaId }) });
  }

  const rodape = semSaldo ? undefined : (
    <Botao variante="principal" tipo="submit" form={FORMULARIO} bloco salvando={salvando} rotuloOcupado="Confirmando…">
      {erro?.semConexao ? 'Tentar de novo' : retirada ? 'Confirmar retirada' : 'Confirmar aporte'}
    </Botao>
  );

  return (
    <Folha aberta aoFechar={aoFechar} titulo={nomeMeta} rodape={rodape}>
      <form id={FORMULARIO} ref={formulario} onSubmit={enviar} noValidate className={estilo.formulario}>
        <Segmentado
          legenda="Tipo de movimento"
          nome="tipo"
          opcoes={OPCOES_TIPO}
          valor={tipo}
          aoMudar={(novo) => aoMudarTipo(novo as TipoMovimentoMeta)}
        />
        {semSaldo ? (
          <EstadoVazio
            icone="alvo"
            nivel={3}
            semMargem
            titulo="Não há valor guardado para retirar"
            texto="Esta meta ainda não tem aportes."
          />
        ) : (
          <>
            {erro ? <AvisoErroTopo icone={erro.semConexao ? 'offline' : 'alerta'}>{erro.texto}</AvisoErroTopo> : null}
            <CampoValor
              centavos={valor}
              aoMudar={(centavos) => {
                definirValor(centavos);
                definirErros((atuais) => ({ ...atuais, valor: undefined }));
                aoEditar();
              }}
              erro={erros.valor ?? erroValor}
            />
            {retirada ? (
              <GrupoChips
                nome="local"
                rotulo="De onde sai"
                variante="linha"
                rotuloAfastado
                valor={local}
                opcoes={porLocal.map((p) => ({
                  valor: p.local,
                  conteudo: (
                    <span className={estilo.opcao}>
                      {p.local} · <span className={estilo.valor}>{formatarMoeda(p.guardado_centavos)}</span>
                    </span>
                  ),
                }))}
                aoMudar={(escolhido) => {
                  definirLocalEscolhido(escolhido);
                  aoEditar();
                }}
              />
            ) : (
              <CampoTexto
                rotulo="Onde está guardado"
                placeholder="Ex.: Caixinha Nubank"
                autoComplete="off"
                value={localLivre}
                sugestoes={sugestoes}
                ajuda={sugestoes.length > 0 ? `Já usados: ${sugestoes.join(', ')}.` : undefined}
                onChange={(e) => {
                  definirLocalLivre(e.target.value);
                  definirErros((atuais) => ({ ...atuais, local: undefined }));
                }}
                erro={erros.local}
              />
            )}
            <Selecao
              rotulo={retirada ? 'Conta de destino (opcional)' : 'Conta de origem (opcional)'}
              value={contaId}
              onChange={(e) => definirContaId(e.target.value)}
              opcoes={[{ valor: '', rotulo: 'Nenhuma' }, ...contas.map((c) => ({ valor: c.id, rotulo: c.nome }))]}
              ajuda={`${retirada ? 'Credita' : 'Debita'} o saldo da conta. Só você vê a conta.`}
            />
            <CampoData rotulo="Data" value={data} onChange={(e) => definirData(e.target.value)} />
          </>
        )}
      </form>
    </Folha>
  );
}
