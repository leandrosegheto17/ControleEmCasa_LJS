import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../../test/apoio/fetchSimulado';
import { CasaTotal } from './CasaTotal';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const vazio = lerResposta<ResumoMes>('resumo-mes-vazio.json');

type Conjunto = ResumoMes['conjunto'];

function montar(conjunto: Conjunto, mesVazio = false, rodapeVazio?: React.ReactNode) {
  return render(
    <MemoryRouter>
      <CasaTotal conjunto={conjunto} mes="2026-10" mesVazio={mesVazio} rodapeVazio={rodapeVazio} />
    </MemoryRouter>,
  );
}

function valorDaLinha(rotulo: string) {
  return screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('CasaTotal', () => {
  it('cartão "Total do casal" com o total em destaque', () => {
    montar(resumo.conjunto);

    expect(screen.getByRole('article', { name: 'Total do casal' })).toBeInTheDocument();
    expect(screen.getByText('R$ 2.418,70')).toBeInTheDocument();
  });

  it('"parcial" vem do resultado.parcial', () => {
    montar(resumo.conjunto);
    expect(screen.getByText('parcial')).toBeInTheDocument();
  });

  it('sem "parcial" quando o mês está fechado', () => {
    montar({ ...resumo.conjunto, resultado: { ...resumo.conjunto.resultado, parcial: false } });
    expect(screen.queryByText('parcial')).not.toBeInTheDocument();
  });

  it('variáveis da casa e previsto a pagar', () => {
    montar(resumo.conjunto);

    expect(valorDaLinha('Variáveis da casa')).toBe('R$ 1.136,20');
    expect(valorDaLinha('Previsto a pagar (fixas pendentes)')).toBe('R$ 1.540,00');
  });

  it('mês vazio: sem as linhas, com o rodapé recebido', () => {
    const { container } = montar(vazio.conjunto, true, <p>Rodapé do mês vazio</p>);

    expect(container.querySelector('dl')).toBeNull();
    expect(screen.getByText('R$ 0,00')).toBeInTheDocument();
    expect(screen.getByText('Rodapé do mês vazio')).toBeInTheDocument();
  });
});
