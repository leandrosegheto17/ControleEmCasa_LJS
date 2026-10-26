import type { TipoForma } from '../comum/enums';
import type { SaidaLinhaFormasPagamento as LinhaFormasPagamento } from '@controle/contrato';
import { ORDEM_TIPO_FORMA, ROTULO_TIPO_FORMA } from '../rotulos/tipoForma';
import { GrupoMenu } from './GrupoMenu';
import { ItemForma } from './ItemForma';

const ID_GRUPO: Record<TipoForma, string> = { pix: 'g-pix', debito: 'g-deb', credito: 'g-cred' };

/** Formas agrupadas por tipo, na ordem de exibição, sem grupo vazio. */
export function ListaFormas({ formas }: { formas: LinhaFormasPagamento[] }) {
  return (
    <>
      {ORDEM_TIPO_FORMA.map((tipo) => {
        const doTipo = formas.filter((f) => f.tipo === tipo);
        return doTipo.length === 0 ? null : (
          <GrupoMenu key={tipo} idTitulo={ID_GRUPO[tipo]} titulo={ROTULO_TIPO_FORMA[tipo].texto}>
            {doTipo.map((forma) => (
              <ItemForma key={forma.id} forma={forma} />
            ))}
          </GrupoMenu>
        );
      })}
    </>
  );
}
