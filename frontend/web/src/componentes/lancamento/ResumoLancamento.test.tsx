import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResumoLancamento } from './ResumoLancamento';

const RESPOSTAS = new URL('../../../test/fixtures/respostas/', import.meta.url);
const ler = (nome: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(nome, RESPOSTAS), 'utf8')) as Record<string, unknown>;

const PAGADOR = ler('lancamento-pagador.json');
const OUTRO = ler('lancamento-outro-membro.json');
const LEANDRO = (ler('contexto.json') as { membro: { id: string; nome: string } }).membro;
const ANA = (ler('contexto-ana.json') as { membro: { id: string; nome: string } }).membro;

function renderizar(lancamento: Record<string, unknown>, membroAtual = LEANDRO) {
  render(<ResumoLancamento lancamento={lancamento as never} membroAtual={membroAtual} />);
  return screen.getByRole('region', { name: 'Resumo' });
}

describe('ResumoLancamento', () => {
  it('título com a parcela em foco, valor da parcela e "parcela 2 de 3"', () => {
    const resumo = renderizar(PAGADOR);
    expect(resumo).toHaveTextContent('Geladeira nova (2/3)');
    expect(resumo).toHaveTextContent('R$ 650,00');
    expect(resumo).toHaveTextContent('parcela 2 de 3');
  });

  it('selo Casa, categoria e "Pago por você" para o pagador', () => {
    const resumo = renderizar(PAGADOR);
    expect(resumo).toHaveTextContent('Casa');
    expect(resumo).toHaveTextContent('Moradia');
    expect(resumo).toHaveTextContent('Pago por você');
  });

  it('"Pago por Leandro" para o outro membro', () => {
    const resumo = renderizar(OUTRO, ANA);
    expect(resumo).toHaveTextContent('Pago por Leandro');
  });

  it('"Alterado por último por Ana em 02/10" quando quem vê é o Leandro', () => {
    const resumo = renderizar(PAGADOR, LEANDRO);
    expect(resumo).toHaveTextContent('Alterado por último por Ana em 02/10');
  });

  it('"Alterado por último por você em 02/10" quando quem alterou é quem vê', () => {
    const resumo = renderizar(OUTRO, ANA);
    expect(resumo).toHaveTextContent('Alterado por último por você em 02/10');
  });

  it('sem alterado_por não mostra a linha "Alterado por último"', () => {
    const { alterado_por: _a, alterado_em: _b, ...semAlteracao } = PAGADOR;
    const resumo = renderizar(semAlteracao);
    expect(resumo).not.toHaveTextContent('Alterado por último');
  });

  it('à vista (N = 1): sem "(1/1)" e sem rótulo de parcela', () => {
    const avista = {
      ...PAGADOR,
      num_parcelas: 1,
      parcela_em_foco: 1,
      valor_total_centavos: 65000,
      parcelas: [
        {
          id: '00000000-0000-4000-8000-000000000620',
          numero: 1,
          valor_centavos: 65000,
          data: '2026-09-10',
          data_ajustada: false,
        },
      ],
    };
    const resumo = renderizar(avista);
    expect(resumo).toHaveTextContent('Geladeira nova');
    expect(resumo).not.toHaveTextContent('(1/1)');
    expect(resumo).not.toHaveTextContent(/parcela \d de/);
  });

  it('individual: sem "Pago por"', () => {
    const individual = {
      ...PAGADOR,
      escopo: 'individual',
      categoria: { id: '00000000-0000-4000-8000-000000000414', nome: 'Lazer pessoal', escopo: 'individual' },
    };
    const resumo = renderizar(individual);
    expect(resumo).toHaveTextContent('Eu');
    expect(resumo).not.toHaveTextContent('Pago por');
  });
});
