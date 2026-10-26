import { useRef, useState, useId } from 'react';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import type { FiltrosUrl } from '../../formatacao/filtrosLancamentos';
import { Icone } from '../base/Icone';
import { ListaFormas } from '../base/ListaFormas';
import estilos from './FiltrosLancamentos.module.css';

interface Props {
  filtros: FiltrosUrl;
  aoMudar: (filtros: FiltrosUrl) => void;
  categorias: DadosLancamento['categorias_despesa'];
  formas: DadosLancamento['formas'];
}

type Lista = 'categoria' | 'forma';

const TODAS = { id: '', nome: 'Todas' };

function com(filtros: FiltrosUrl, mudanca: FiltrosUrl): FiltrosUrl {
  return { ...filtros, ...mudanca };
}

function sem(filtros: FiltrosUrl, chave: keyof FiltrosUrl): FiltrosUrl {
  const copia = { ...filtros };
  delete copia[chave];
  return copia;
}

/** Faixa de filtros da lista: escopo (exclusivos), variável e as listas de categoria e forma. */
export function FiltrosLancamentos({ filtros, aoMudar, categorias, formas }: Props) {
  const nomeRadios = useId();
  const [aberta, setAberta] = useState<Lista | null>(null);
  const botoes = useRef<Record<Lista, HTMLButtonElement | null>>({ categoria: null, forma: null });

  const categoriaAtual = categorias.find((c) => c.id === filtros.categoria);
  const formaAtual = formas.find((f) => f.id === filtros.forma);

  const alternarEscopo = (escopo: 'eu' | 'casa') =>
    aoMudar(filtros.escopo === escopo ? sem(filtros, 'escopo') : com(filtros, { escopo }));

  function escolher(lista: Lista, id: string) {
    aoMudar(id === '' ? sem(filtros, lista) : com(filtros, { [lista]: id }));
  }

  function fechar(devolverFoco: boolean) {
    const lista = aberta;
    setAberta(null);
    if (devolverFoco && lista !== null) botoes.current[lista]?.focus();
  }

  function botaoEscopo(escopo: 'eu' | 'casa', rotulo: string) {
    const marcado = filtros.escopo === escopo;
    return (
      <button type="button" className={estilos.filtro} aria-pressed={marcado} onClick={() => alternarEscopo(escopo)}>
        {marcado ? <Icone nome="marcado" /> : null}
        {rotulo}
      </button>
    );
  }

  function botaoLista(lista: Lista, rotulo: string, atual: string | undefined) {
    return (
      <button
        type="button"
        ref={(el) => {
          botoes.current[lista] = el;
        }}
        className={estilos.filtro}
        aria-haspopup="listbox"
        aria-expanded={aberta === lista}
        aria-controls={aberta === lista ? `filtro-${lista}` : undefined}
        aria-pressed={atual === undefined ? undefined : true}
        onClick={() => setAberta(aberta === lista ? null : lista)}
      >
        {rotulo}: {atual ?? 'todas'} <Icone nome="baixo" />
      </button>
    );
  }

  const opcoes = {
    categoria: [TODAS, ...categorias.map((c) => ({ id: c.id, nome: c.nome }))],
    forma: [TODAS, ...formas.map((f) => ({ id: f.id, nome: f.nome }))],
  };

  return (
    <div>
      <div className={estilos.filtros} role="group" aria-label="Filtros">
        {botaoEscopo('eu', 'Eu')}
        {botaoEscopo('casa', 'Casa')}
        <button
          type="button"
          className={estilos.filtro}
          aria-pressed={filtros.variavel === true}
          onClick={() => aoMudar(filtros.variavel ? sem(filtros, 'variavel') : com(filtros, { variavel: true }))}
        >
          {filtros.variavel ? <Icone nome="marcado" /> : null}
          Variável
        </button>
        {botaoLista('categoria', 'Categoria', categoriaAtual?.nome)}
        {botaoLista('forma', 'Forma', formaAtual?.nome)}
        <button type="button" className={estilos.filtro} onClick={() => aoMudar({})}>
          Limpar filtros
        </button>
      </div>
      {aberta === null ? null : (
        <div className={estilos.lista}>
          <ListaFormas
            id={`filtro-${aberta}`}
            nome={`${nomeRadios}-${aberta}`}
            rotulo={aberta === 'categoria' ? 'Categoria' : 'Forma'}
            opcoes={opcoes[aberta]}
            valor={filtros[aberta] ?? ''}
            aoEscolher={(id) => escolher(aberta, id)}
            aoFechar={fechar}
          />
        </div>
      )}
    </div>
  );
}
