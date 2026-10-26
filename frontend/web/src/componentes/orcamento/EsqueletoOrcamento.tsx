import { CartaoResumo } from '../base/CartaoResumo';
import { GradeOrcamento } from './GradeOrcamento';

/** Dois cartões de esqueleto na grade do conteúdo. Decorativo (fica dentro de CarregandoComAtraso). */
export function EsqueletoOrcamento() {
  return (
    <GradeOrcamento>
      <CartaoResumo estado="carregando" titulo="" textoVazio="" formaEsqueleto={['titulo', 'linha', 'linha-curta']} />
      <CartaoResumo
        estado="carregando"
        titulo=""
        textoVazio=""
        formaEsqueleto={['titulo', 'linha', 'linha', 'linha', 'linha-curta']}
      />
    </GradeOrcamento>
  );
}
