import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { SaidaResumoMes as ResumoMes } from '@controle/contrato';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { MetaCompacta } from './MetaCompacta';

const resumo = lerResposta<ResumoMes>('resumo-mes.json');
const [reserva, viagem] = resumo.conjunto.metas;
const [notebook, curso] = resumo.individual.metas;
const classe = (nome: string) => new RegExp(`(^|\\s|_)${nome}(_|\\s|$)`);

type Meta = typeof reserva;

function montar(meta: Meta, bloco: 'casa' | 'eu', href = `/metas/${meta.meta_id}`) {
  return render(
    <MemoryRouter>
      <MetaCompacta meta={meta} bloco={bloco} href={href} />
    </MemoryRouter>,
  );
}

describe('MetaCompacta', () => {
  it('Reserva: 62%, guardado de alvo, "faltam" e sem linha de prazo', () => {
    montar(reserva, 'casa');

    const link = screen.getByRole('link');
    expect(within(link).getByText('62%')).toBeInTheDocument();
    expect(within(link).getByText('R$ 18.500,00 de R$ 30.000,00')).toBeInTheDocument();
    expect(within(link).getByText('faltam R$ 11.500,00')).toBeInTheDocument();
    expect(within(link).queryByText(/^até /)).not.toBeInTheDocument();
  });

  it('ordem: nome e %, barra, depois valores e "faltam"', () => {
    montar(reserva, 'casa');

    const nome = screen.getByText(reserva.nome);
    const barra = screen.getByRole('progressbar');
    const valores = screen.getByText('R$ 18.500,00 de R$ 30.000,00');
    const faltam = screen.getByText('faltam R$ 11.500,00');
    expect(nome.compareDocumentPosition(barra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(barra.compareDocumentPosition(valores) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(valores.compareDocumentPosition(faltam) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Viagem: linha de prazo e valor mensal', () => {
    montar(viagem, 'casa');

    expect(screen.getByText('até jul/2027 · R$ 644,45 por mês')).toBeInTheDocument();
  });

  it('barra com o nome como rótulo e a cor do bloco', () => {
    montar(reserva, 'casa');

    const barra = screen.getByRole('progressbar', { name: 'Reserva de emergência' });
    expect(barra).toHaveAttribute('aria-valuenow', '62');
    expect(barra.className).toMatch(classe('barra-casa'));
  });

  it('meta do bloco eu usa barra-eu', () => {
    montar(notebook, 'eu');

    expect(screen.getByRole('progressbar', { name: 'Notebook novo' }).className).toMatch(classe('barra-eu'));
  });

  it('Curso de inglês atingida: selo "Atingida", barra-dentro e sem "%" no topo', () => {
    montar(curso, 'eu');

    expect(screen.getByText('Atingida')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Curso de inglês' }).className).toMatch(classe('barra-dentro'));
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.getByText('faltam R$ 0,00')).toBeInTheDocument();
  });

  it('a barra (span) é bloco dentro do link, senão fica com altura 0', () => {
    const css = readFileSync(resolve(__dirname, 'MetaCompacta.module.css'), 'utf8');
    const regra = /\.meta-link\s+\[role=['"]?progressbar['"]?\]\s*\{([^}]*)\}/.exec(css);

    expect(regra).not.toBeNull();
    expect(regra![1]).toMatch(/display:\s*block/);
    montar(reserva, 'casa');
    expect(screen.getByRole('progressbar').tagName).toBe('SPAN');
    expect(screen.getByRole('link').className).toMatch(classe('meta-link'));
  });

  it('o link usa o href recebido', () => {
    montar(reserva, 'casa', '/metas/abc');

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/metas/abc');
    expect(link.className).toMatch(classe('meta-link'));
  });
});
