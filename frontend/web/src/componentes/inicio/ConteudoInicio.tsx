import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { Bloco } from '../Bloco';
import { CasaFixas } from './CasaFixas';
import { CasaMetas } from './CasaMetas';
import { CasaOrcamento } from './CasaOrcamento';
import { CasaPorCategoria } from './CasaPorCategoria';
import { CasaQuemPagou } from './CasaQuemPagou';
import { CasaResultado } from './CasaResultado';
import { CasaTotal } from './CasaTotal';
import { EuContas } from './EuContas';
import { EuCartoes } from './EuCartoes';
import { EuMetas } from './EuMetas';
import { EuOrcamento } from './EuOrcamento';
import { EuPorCategoria } from './EuPorCategoria';
import { EuReceitas } from './EuReceitas';
import { EuTotal } from './EuTotal';
import { MesVazio } from './MesVazio';
import { PrimeirosPassos } from './PrimeirosPassos';

interface Props {
  resumo: ResumoMes;
  /** 'AAAA-MM' */
  mes: string;
  nome?: string;
  temConta: boolean;
  temForma: boolean;
  instalado: boolean;
}

/** Mês sem lançamento: nenhuma categoria com total e nenhuma receita, segundo o que a API entregou. */
function semLancamentos({ conjunto, individual }: ResumoMes): boolean {
  return (
    conjunto.por_categoria.length === 0 &&
    individual.por_categoria.length === 0 &&
    individual.minha_parte_por_categoria.length === 0 &&
    individual.receitas_centavos === 0
  );
}

/** Os dois blocos da Início; cada seção recebe só a fatia da resposta que lhe cabe. */
export function ConteudoInicio({ resumo, mes, nome, temConta, temForma, instalado }: Props) {
  const { conjunto, individual } = resumo;
  const mesVazio = semLancamentos(resumo);
  return (
    <>
      <PrimeirosPassos temConta={temConta} temForma={temForma} instalado={instalado} />
      <Bloco bloco="casa" titulo="Casa">
        <CasaTotal conjunto={conjunto} mes={mes} mesVazio={mesVazio} rodapeVazio={<MesVazio mes={mes} />} />
        {mesVazio ? null : <CasaQuemPagou conjunto={conjunto} mes={mes} />}
        <CasaFixas conjunto={conjunto} mes={mes} />
        <CasaOrcamento conjunto={conjunto} mes={mes} />
        {mesVazio ? null : <CasaPorCategoria conjunto={conjunto} mes={mes} />}
        {mesVazio ? null : <CasaResultado conjunto={conjunto} mes={mes} />}
        <CasaMetas conjunto={conjunto} mes={mes} />
      </Bloco>
      <Bloco bloco="eu" titulo="Eu" nome={nome}>
        <EuTotal individual={individual} mes={mes} mesVazio={mesVazio} />
        {mesVazio ? null : <EuReceitas individual={individual} mes={mes} />}
        {mesVazio ? null : <EuOrcamento individual={individual} mes={mes} />}
        {mesVazio ? null : <EuPorCategoria individual={individual} mes={mes} />}
        <EuContas individual={individual} mes={mes} />
        {mesVazio ? null : <EuCartoes individual={individual} mes={mes} />}
        <EuMetas individual={individual} mes={mes} />
      </Bloco>
    </>
  );
}
