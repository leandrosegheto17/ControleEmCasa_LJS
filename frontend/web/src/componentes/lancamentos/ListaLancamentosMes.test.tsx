import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ListaLancamentosMes } from './ListaLancamentosMes';

const RESPOSTAS = new URL('../../../test/fixtures/respostas/', import.meta.url);
const resposta = <T,>(nome: string): T => JSON.parse(readFileSync(new URL(nome, RESPOSTAS), 'utf8')) as T;

type Item = { lancamento_id: string; data: string; descricao: string | null };
const LISTA = resposta<{ itens: Item[] }>('lancamentos-mes.json');
const CONTEXTO = resposta<{ membro: { id: string } }>('contexto.json');
const CONTEXTO_ANA = resposta<{ membro: { id: string } }>('contexto-ana.json');

function renderizar(membroAtualId = CONTEXTO.membro.id) {
  return render(
    <MemoryRouter>
      <ListaLancamentosMes itens={LISTA.itens as never} membroAtualId={membroAtualId} />
    </MemoryRouter>,
  );
}

describe('ListaLancamentosMes', () => {
  // A fixture tem 9 dias distintos (não há lançamento em 04/10).
  it('agrupa por dia na ordem recebida, do mais recente para o mais antigo', () => {
    renderizar();
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual([
      'Sábado, 10 de outubro',
      'Sexta, 9 de outubro',
      'Quinta, 8 de outubro',
      'Quarta, 7 de outubro',
      'Terça, 6 de outubro',
      'Segunda, 5 de outubro',
      'Sábado, 3 de outubro',
      'Sexta, 2 de outubro',
      'Quinta, 1 de outubro',
    ]);
  });

  it('cada grupo é uma região nomeada pelo seu título', () => {
    renderizar();
    expect(screen.getByRole('region', { name: 'Quinta, 8 de outubro' })).toBeInTheDocument();
  });

  it('2 linhas em 08/10, na ordem recebida', () => {
    renderizar();
    const grupo = screen.getByRole('region', { name: 'Quinta, 8 de outubro' });
    const links = within(grupo).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Restaurante Sabor');
    expect(links[1]).toHaveTextContent('Uber');
  });

  it('não reordena itens recebidos fora de ordem', () => {
    const invertidos = [...LISTA.itens].reverse();
    render(
      <MemoryRouter>
        <ListaLancamentosMes itens={invertidos as never} membroAtualId={CONTEXTO.membro.id} />
      </MemoryRouter>,
    );
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos[0]).toBe('Quinta, 1 de outubro');
    expect(titulos.at(-1)).toBe('Sábado, 10 de outubro');
  });

  it('cada grupo tem uma lista acessível; juntas somam os 15 itens', () => {
    renderizar();
    const listas = screen.getAllByRole('list');
    expect(listas).toHaveLength(9);
    expect(listas.flatMap((l) => within(l).getAllByRole('listitem'))).toHaveLength(15);
    const grupo = screen.getByRole('region', { name: 'Quinta, 8 de outubro' });
    expect(within(within(grupo).getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('cada linha leva ao detalhe do lançamento', () => {
    renderizar();
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/app/lancamentos/00000000-0000-4000-8000-000000000515');
    expect(links).toHaveLength(15);
  });

  it('título com "(k/N)" na parcelada', () => {
    renderizar();
    expect(screen.getAllByRole('link')[0]).toHaveTextContent('Fone bluetooth (2/3)');
  });

  it('pagador igual ao membro atual aparece como "Você"', () => {
    renderizar();
    const primeira = screen.getAllByRole('link')[0];
    expect(primeira).toHaveTextContent('Você');
    expect(primeira).not.toHaveTextContent('Leandro');
  });

  it('para outro membro, o pagador aparece pelo nome', () => {
    renderizar(CONTEXTO_ANA.membro.id);
    expect(screen.getAllByRole('link')[0]).toHaveTextContent('Leandro');
  });
});
