import { useState } from 'react';
import { Botao } from '../componentes/base/Botao';
import { CabecalhoPagina } from '../componentes/base/CabecalhoPagina';
import { EsqueletoLista } from '../componentes/base/EsqueletoLista';
import { Interruptor } from '../componentes/base/Interruptor';
import { Nota } from '../componentes/base/Nota';
import { Selecao } from '../componentes/base/Selecao';
import { EstadosDeLeitura } from '../componentes/EstadosDeLeitura';
import type { ErroDados } from '../comum/erros';
import { ErroNavegador, type Preferencias } from '../comum/push';
import {
  useAtivarPush,
  useDesativarPush,
  useEstadoPush,
  usePreferencias,
  useSalvarPreferencias,
} from '../ganchos/usePush';
import { useLeituraComCache } from '../ganchos/useLeituraComCache';
import {
  PASSOS_IOS_PUSH,
  TEXTO_ATIVA,
  TEXTO_INATIVA,
  TEXTO_IOS,
  TEXTO_NEGADA,
  TEXTO_PERMISSAO_IGNORADA,
  TEXTO_PREFERENCIAS_SEM_REDE,
  TEXTO_SEM_SUPORTE,
  TIPOS_DE_AVISO,
  TITULO_IOS,
  textoErroNavegador,
  textoErroPush,
} from '../rotulos/push';
import estilo from './Notificacoes.module.css';

interface Props {
  /** iPhone ou iPad com o app fora da Tela de Início: o push não existe ali (ligado pela raiz, `mapaRotas`). */
  iosForaDoInstalado?: boolean;
}

const HORAS = Array.from({ length: 24 }, (_, hora) => ({
  valor: String(hora),
  rotulo: `${String(hora).padStart(2, '0')}:00`,
}));

function textoDoErro(erro: unknown): string {
  if (erro instanceof ErroNavegador) return textoErroNavegador(erro.motivo);
  return textoErroPush(erro as ErroDados);
}

function InstrucaoIos() {
  return (
    <section className={estilo.secao} aria-labelledby="titulo-ios">
      <h2 id="titulo-ios" className={estilo.titulo}>
        {TITULO_IOS}
      </h2>
      <Nota icone>{TEXTO_IOS}</Nota>
      <ol className={estilo.passos}>
        {PASSOS_IOS_PUSH.map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
    </section>
  );
}

function ParteDoAparelho() {
  const estado = useEstadoPush();
  const ativar = useAtivarPush();
  const desativar = useDesativarPush();
  const [aviso, setAviso] = useState<string | null>(null);

  if (estado.isPending) return <EsqueletoLista linhas={1} />;
  const situacao = estado.data ?? 'sem_suporte';

  function aoAtivar() {
    setAviso(null);
    ativar.mutate(undefined, {
      onSuccess: (resultado) => {
        if (resultado === 'permissao_ignorada') setAviso(TEXTO_PERMISSAO_IGNORADA);
      },
      onError: (erro) => setAviso(textoDoErro(erro)),
    });
  }

  function aoDesativar() {
    setAviso(null);
    desativar.mutate(undefined, { onError: (erro) => setAviso(textoDoErro(erro)) });
  }

  return (
    <section className={estilo.secao} aria-labelledby="titulo-aparelho">
      <h2 id="titulo-aparelho" className={estilo.titulo}>
        Neste aparelho
      </h2>
      {situacao === 'sem_suporte' ? <Nota icone>{TEXTO_SEM_SUPORTE}</Nota> : null}
      {situacao === 'negada' ? <Nota icone>{TEXTO_NEGADA}</Nota> : null}
      {situacao === 'inativa' || ativar.isPending ? (
        <>
          <p className="texto-2 pequeno">{TEXTO_INATIVA}</p>
          <Botao
            variante="principal"
            icone="alerta"
            salvando={ativar.isPending}
            rotuloOcupado="Ativando…"
            onClick={aoAtivar}
          >
            Ativar neste aparelho
          </Botao>
        </>
      ) : null}
      {situacao === 'ativa' && !ativar.isPending ? (
        <>
          <p className="texto-2 pequeno" role="status">
            {TEXTO_ATIVA}
          </p>
          <Botao
            variante="secundario"
            salvando={desativar.isPending}
            rotuloOcupado="Desativando…"
            onClick={aoDesativar}
          >
            Desativar neste aparelho
          </Botao>
        </>
      ) : null}
      {aviso ? (
        <p className="texto-2 pequeno" role="alert">
          {aviso}
        </p>
      ) : null}
    </section>
  );
}

function FormularioPreferencias({ preferencias }: { preferencias: Preferencias }) {
  const salvar = useSalvarPreferencias();
  const [erro, setErro] = useState<string | null>(null);

  function alterar(parcial: Partial<Preferencias>) {
    setErro(null);
    // O PUT recebe sempre o objeto completo (RN-27).
    salvar.mutate({ ...preferencias, ...parcial }, { onError: (e) => setErro(textoErroPush(e)) });
  }

  const ocupado = salvar.isPending;
  return (
    <section className={estilo.secao} aria-labelledby="titulo-preferencias">
      <h2 id="titulo-preferencias" className={estilo.titulo}>
        O que avisar
      </h2>
      <div className={estilo.preferencias}>
        <Interruptor
          rotulo={TIPOS_DE_AVISO.fixas.rotulo}
          ajuda={TIPOS_DE_AVISO.fixas.ajuda}
          checked={preferencias.fixas}
          desabilitado={ocupado}
          onChange={(e) => alterar({ fixas: e.target.checked })}
        />
        <Interruptor
          rotulo={TIPOS_DE_AVISO.lembrete_diario.rotulo}
          ajuda={TIPOS_DE_AVISO.lembrete_diario.ajuda}
          checked={preferencias.lembrete_diario}
          desabilitado={ocupado}
          onChange={(e) => alterar({ lembrete_diario: e.target.checked })}
        />
        <Selecao
          rotulo="Horário do lembrete"
          ajuda="Horário de Brasília."
          value={String(preferencias.lembrete_hora)}
          opcoes={HORAS}
          desabilitado={ocupado || !preferencias.lembrete_diario}
          onChange={(e) => alterar({ lembrete_hora: Number(e.target.value) })}
        />
        <Interruptor
          rotulo={TIPOS_DE_AVISO.metas.rotulo}
          ajuda={TIPOS_DE_AVISO.metas.ajuda}
          checked={preferencias.metas}
          desabilitado={ocupado}
          onChange={(e) => alterar({ metas: e.target.checked })}
        />
      </div>
      {erro ? (
        <p className="texto-2 pequeno" role="alert">
          {erro}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Ajustes, Notificações (SDD 9.3, `/app/ajustes/notificacoes`; RN-27; CA-27.5, CA-27.8): ativar e desativar o aviso
 * neste aparelho e escolher o que avisar. A permissão só é pedida no clique de "Ativar neste aparelho". Tudo exige rede e
 * não entra na fila offline. No iPhone/iPad fora da Tela de Início só aparece a instrução de instalação.
 */
export function Notificacoes({ iosForaDoInstalado = false }: Props) {
  const consulta = usePreferencias();
  const leitura = useLeituraComCache(consulta);
  return (
    <>
      <CabecalhoPagina titulo="Notificações" voltarPara="/app/ajustes" rotuloVoltar="Voltar para Ajustes" />
      <main>
        {iosForaDoInstalado ? <InstrucaoIos /> : <ParteDoAparelho />}
        <EstadosDeLeitura
          leitura={leitura}
          esqueleto={<EsqueletoLista linhas={3} />}
          anuncioCarregando="Carregando as preferências…"
          textoErro={consulta.error?.tipo === 'rede' ? TEXTO_PREFERENCIAS_SEM_REDE : undefined}
          aoTentarDeNovo={() => void consulta.refetch()}
        >
          {(preferencias) => <FormularioPreferencias preferencias={preferencias} />}
        </EstadosDeLeitura>
      </main>
    </>
  );
}
