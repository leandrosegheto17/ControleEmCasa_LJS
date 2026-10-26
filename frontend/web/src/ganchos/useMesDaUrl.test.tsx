import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMesDaUrl } from './useMesDaUrl';

let definir: (mes: string) => void = () => {};

function Sonda() {
  const [mes, definirMes] = useMesDaUrl();
  const local = useLocation();
  definir = definirMes;
  return (
    <>
      <p data-testid="mes">{mes}</p>
      <p data-testid="busca">{local.search}</p>
    </>
  );
}

function montar(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Sonda />
    </MemoryRouter>,
  );
}

const mesExibido = () => screen.getByTestId('mes').textContent;
const busca = () => new URLSearchParams(screen.getByTestId('busca').textContent ?? '');

describe('useMesDaUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 31/12/2026 às 23h30 em São Paulo (UTC-3): já é 2027 em UTC.
    vi.setSystemTime(new Date('2027-01-01T02:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sem mes na URL, usa o mês corrente de São Paulo', () => {
    montar('/lancamentos');
    expect(mesExibido()).toBe('2026-12');
  });

  it('com mes inválido na URL, cai no mês corrente', () => {
    montar('/lancamentos?mes=2026-13');
    expect(mesExibido()).toBe('2026-12');
  });

  it('com mes válido na URL, devolve esse mês', () => {
    montar('/lancamentos?mes=2026-08');
    expect(mesExibido()).toBe('2026-08');
  });

  it('definirMes grava o mês na URL e mantém escopo=eu', () => {
    montar('/lancamentos?mes=2026-10&escopo=eu');

    act(() => definir('2026-09'));

    expect(mesExibido()).toBe('2026-09');
    expect(busca().get('mes')).toBe('2026-09');
    expect(busca().get('escopo')).toBe('eu');
  });
});
