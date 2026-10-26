import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { CasaTotal } from './CasaTotal';
import { CasaQuemPagou } from './CasaQuemPagou';
import { CasaFixas } from './CasaFixas';
import { CasaOrcamento } from './CasaOrcamento';
import { CasaPorCategoria } from './CasaPorCategoria';
import { CasaResultado } from './CasaResultado';
import { CasaMetas } from './CasaMetas';
import { EuTotal } from './EuTotal';
import { EuReceitas } from './EuReceitas';
import { EuOrcamento } from './EuOrcamento';
import { EuPorCategoria } from './EuPorCategoria';
import { EuContas } from './EuContas';
import { EuCartoes } from './EuCartoes';
import { EuMetas } from './EuMetas';
import { MesVazio } from './MesVazio';
import { ConteudoInicio } from './ConteudoInicio';

vi.mock('./CasaTotal', () => ({ CasaTotal: vi.fn(() => null) }));
vi.mock('./CasaQuemPagou', () => ({ CasaQuemPagou: vi.fn(() => null) }));
vi.mock('./CasaFixas', () => ({ CasaFixas: vi.fn(() => null) }));
vi.mock('./CasaOrcamento', () => ({ CasaOrcamento: vi.fn(() => null) }));
vi.mock('./CasaPorCategoria', () => ({ CasaPorCategoria: vi.fn(() => null) }));
vi.mock('./CasaResultado', () => ({ CasaResultado: vi.fn(() => null) }));
vi.mock('./CasaMetas', () => ({ CasaMetas: vi.fn(() => null) }));
vi.mock('./EuTotal', () => ({ EuTotal: vi.fn(() => null) }));
vi.mock('./EuReceitas', () => ({ EuReceitas: vi.fn(() => null) }));
vi.mock('./EuOrcamento', () => ({ EuOrcamento: vi.fn(() => null) }));
vi.mock('./EuPorCategoria', () => ({ EuPorCategoria: vi.fn(() => null) }));
vi.mock('./EuContas', () => ({ EuContas: vi.fn(() => null) }));
vi.mock('./EuCartoes', () => ({ EuCartoes: vi.fn(() => null) }));
vi.mock('./EuMetas', () => ({ EuMetas: vi.fn(() => null) }));

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const vazio = lerResposta<ResumoMes>('resumo-mes-vazio.json');

const TODOS = [
  CasaTotal,
  CasaQuemPagou,
  CasaFixas,
  CasaOrcamento,
  CasaPorCategoria,
  CasaResultado,
  CasaMetas,
  EuTotal,
  EuReceitas,
  EuOrcamento,
  EuPorCategoria,
  EuContas,
  EuCartoes,
  EuMetas,
];
const NO_MES_VAZIO = [CasaTotal, CasaFixas, CasaOrcamento, CasaMetas, EuTotal, EuContas, EuMetas];
const ESCONDIDOS_NO_MES_VAZIO = [
  CasaQuemPagou,
  CasaPorCategoria,
  CasaResultado,
  EuReceitas,
  EuOrcamento,
  EuPorCategoria,
  EuCartoes,
];

function montar(r: ResumoMes) {
  return render(
    <MemoryRouter>
      <ConteudoInicio resumo={r} mes="2026-10" nome="Leandro" temConta temForma instalado={false} />
    </MemoryRouter>,
  );
}

function ultimasProps(componente: unknown) {
  const chamadas = vi.mocked(componente as (p: unknown) => null).mock.calls;
  return chamadas[chamadas.length - 1]?.[0] as Record<string, unknown>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ConteudoInicio', () => {
  it('mês com lançamentos: as 14 seções e mesVazio falso', () => {
    montar(resumo);

    TODOS.forEach((c) => expect(c).toHaveBeenCalled());
    expect(ultimasProps(CasaTotal)).toMatchObject({ mesVazio: false });
    expect(ultimasProps(EuTotal)).toMatchObject({ mesVazio: false });
  });

  it('mês vazio: só as seções do mockup', () => {
    montar(vazio);

    NO_MES_VAZIO.forEach((c) => expect(c).toHaveBeenCalled());
    ESCONDIDOS_NO_MES_VAZIO.forEach((c) => expect(c).not.toHaveBeenCalled());
  });

  it('mês vazio: mesVazio repassado e o MesVazio entregue ao total do casal', () => {
    montar(vazio);

    expect(ultimasProps(CasaTotal)).toMatchObject({ mesVazio: true, conjunto: vazio.conjunto, mes: '2026-10' });
    expect(ultimasProps(EuTotal)).toMatchObject({ mesVazio: true, individual: vazio.individual });
    const rodape = ultimasProps(CasaTotal).rodapeVazio as { type?: unknown };
    expect(rodape?.type).toBe(MesVazio);
  });

  it('a casa recebe só conjunto e o eu só individual', () => {
    montar(resumo);

    [CasaTotal, CasaQuemPagou, CasaFixas, CasaOrcamento, CasaPorCategoria, CasaResultado, CasaMetas].forEach((c) =>
      expect(ultimasProps(c)).not.toHaveProperty('individual'),
    );
    [EuTotal, EuReceitas, EuOrcamento, EuPorCategoria, EuContas, EuCartoes, EuMetas].forEach((c) =>
      expect(ultimasProps(c)).not.toHaveProperty('conjunto'),
    );
  });
});
