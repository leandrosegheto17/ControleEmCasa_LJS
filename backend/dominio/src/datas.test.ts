import { describe, expect, it } from 'vitest';
import {
  diaNoMes,
  ehDataCalendario,
  hojeEmSaoPaulo,
  inicioMes,
  mesFechado,
  mesNaJanela,
  mesesEntre,
  somarDias,
  somarMeses,
  ultimoDiaDoMes,
} from './datas';

// Casos portados de MyMoney/backend/supabase/tests/datas/hoje.sql (RT-04, CA-T4.1).
describe('hojeEmSaoPaulo (RT-04)', () => {
  it.each([
    ['2026-12-31T23:30:00-03:00', '2026-12-31', '23h30 de 31/12 em São Paulo ainda é 31/12'],
    ['2027-01-01T02:59:00Z', '2026-12-31', '02h59 UTC de 01/01 ainda é 31/12 em São Paulo'],
    ['2027-01-01T03:00:00Z', '2027-01-01', '03h00 UTC de 01/01 já é 01/01 em São Paulo'],
    ['2026-11-01T02:30:00Z', '2026-10-31', 'CA-T4.1: 23h30 de 31/10 em SP (02h30 UTC de 01/11) é 31/10'],
    ['2026-10-24T12:00:00Z', '2026-10-24', 'meio do dia'],
  ])('%s → %s (%s)', (instante, esperado) => {
    expect(hojeEmSaoPaulo(new Date(instante))).toBe(esperado);
  });

  it('respeita o horário de verão histórico (o fuso não é um -03:00 fixo)', () => {
    // 2018-11-04 00:00 BRT pulou para 01:00 BRST (-02:00). 02h30 UTC = 23h30 de 03/11 (-03:00).
    expect(hojeEmSaoPaulo(new Date('2018-11-04T02:30:00Z'))).toBe('2018-11-03');
    // 03h00 UTC = 01h00 de 04/11 (-02:00).
    expect(hojeEmSaoPaulo(new Date('2018-11-04T03:00:00Z'))).toBe('2018-11-04');
    // Em janeiro de 2019 (verão), 02h00 UTC já é 00h00 de SP (-02:00).
    expect(hojeEmSaoPaulo(new Date('2019-01-15T02:00:00Z'))).toBe('2019-01-15');
  });

  it('não depende do fuso do processo: só do instante', () => {
    const instante = new Date('2026-10-31T23:59:59-03:00');
    expect(hojeEmSaoPaulo(instante)).toBe('2026-10-31');
    expect(hojeEmSaoPaulo(new Date(instante.getTime() + 1000))).toBe('2026-11-01');
  });

  it('recusa instante inválido', () => {
    expect(() => hojeEmSaoPaulo(new Date('não é data'))).toThrow();
  });
});

// Casos portados de tests/datas/inicio_mes.sql e CA-T4.2.
describe('inicioMes (CA-T4.2)', () => {
  it.each([
    ['2026-12-31', '2026-12-01', 'último dia do ano volta para 01/12'],
    ['2028-02-29', '2028-02-01', '29/02 de ano bissexto volta para 01/02'],
    ['2027-01-01', '2027-01-01', 'primeiro dia do mês continua igual'],
    ['2026-10-17', '2026-10-01', 'CA-T4.2: 2026-10-17 → 2026-10-01'],
  ])('%s → %s (%s)', (data, esperado) => {
    expect(inicioMes(data)).toBe(esperado);
  });
});

// Casos portados de tests/datas/dia_no_mes.sql (RN-14).
describe('diaNoMes (RN-14)', () => {
  it.each([
    ['2026-02-01', 31, '2026-02-28', '31 em fevereiro de 2026 vira 28'],
    ['2028-02-01', 31, '2028-02-29', '31 em fevereiro de 2028 (bissexto) vira 29'],
    ['2100-02-01', 29, '2100-02-28', '29 em fevereiro de 2100 (não bissexto) vira 28'],
    ['2026-04-01', 31, '2026-04-30', '31 em abril vira 30'],
    ['2026-12-15', 10, '2026-12-10', 'qualquer data do mês serve como referência'],
    ['2027-01-01', 31, '2027-01-31', '31 em janeiro depois da virada de ano'],
    ['2026-03-20', 1, '2026-03-01', 'dia 1 devolve o primeiro dia do mês'],
    ['2026-12-31', 31, '2026-12-31', 'referência no último dia do ano não pula para o mês seguinte'],
    ['2000-02-10', 30, '2000-02-29', '2000 é bissexto (divisível por 400)'],
  ] as const)('%s, dia %i → %s (%s)', (...[mes, dia, esperado]) => {
    expect(diaNoMes(mes, dia)).toEqual({ ok: true, valor: esperado });
  });

  it.each([
    [0, 'dia 0 é recusado'],
    [32, 'dia 32 é recusado'],
    [null, 'dia nulo é recusado'],
    [10.5, 'dia fracionário é recusado'],
    [Number.NaN, 'NaN é recusado'],
  ])('dia %s → valor_invalido (%s)', (...[dia]) => {
    expect(diaNoMes('2026-02-01', dia as number)).toEqual({ ok: false, erro: 'valor_invalido' });
  });

  it('referência que não é data de calendário é recusada', () => {
    expect(diaNoMes('2026-02-30', 10)).toEqual({ ok: false, erro: 'valor_invalido' });
  });

  it('propriedade: para todo mês de 1900 a 2100 e dia 1..31, o resultado é min(dia, último dia) no mesmo mês', () => {
    for (let ano = 1900; ano <= 2100; ano++) {
      for (let mes = 1; mes <= 12; mes++) {
        // Oráculo independente: o dia 0 do mês seguinte, em UTC, é o último dia do mês.
        const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const ref = `${ano}-${String(mes).padStart(2, '0')}-15`;
        for (let dia = 1; dia <= 31; dia++) {
          const r = diaNoMes(ref, dia);
          const esperado = `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
          if (!r.ok || r.valor !== esperado) {
            throw new Error(`diaNoMes(${ref}, ${dia}) = ${JSON.stringify(r)}, esperado ${esperado}`);
          }
        }
      }
    }
  });
});

describe('ultimoDiaDoMes', () => {
  it.each([
    [2026, 2, 28],
    [2028, 2, 29],
    [1900, 2, 28],
    [2000, 2, 29],
    [2026, 4, 30],
    [2026, 12, 31],
  ])('%i-%i → %i', (ano, mes, esperado) => {
    expect(ultimoDiaDoMes(ano, mes)).toBe(esperado);
  });
});

describe('ehDataCalendario', () => {
  it.each(['2026-10-24', '2028-02-29', '0001-01-01', '9999-12-31'])('%s é data de calendário', (d) => {
    expect(ehDataCalendario(d)).toBe(true);
  });
  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-10-32',
    '2026-1-01',
    '26-10-01',
    '2026-10-24T00:00:00Z',
    '2026/10/24',
    '',
    ' 2026-10-24',
  ])('%j não é', (d) => {
    expect(ehDataCalendario(d)).toBe(false);
  });
});

describe('somarMeses e somarDias', () => {
  it('somarMeses mantém o dia quando existe e vira o ano', () => {
    expect(somarMeses('2026-12-01', 1)).toBe('2027-01-01');
    expect(somarMeses('2026-10-01', -12)).toBe('2025-10-01');
    expect(somarMeses('2026-10-01', 12)).toBe('2027-10-01');
  });
  it('somarMeses cai no último dia quando o dia não existe', () => {
    expect(somarMeses('2027-01-31', 1)).toBe('2027-02-28');
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29');
  });
  it('somarDias atravessa mês, ano e fevereiro bissexto', () => {
    expect(somarDias('2026-10-24', 30)).toBe('2026-11-23');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('mesesEntre conta meses de calendário (ano × 12 + mês)', () => {
    expect(mesesEntre('2026-10-09', '2027-07-01')).toBe(9);
    expect(mesesEntre('2026-12-15', '2027-01-01')).toBe(1);
    expect(mesesEntre('2026-10-31', '2026-10-01')).toBe(0);
    expect(mesesEntre('2026-10-01', '2026-06-01')).toBe(-4);
  });
});

// Casos de tests/orcamento/orcamento_mes.sql, tests/resumo/resumo_mes.sql e CA-T4.3.
describe('mesFechado (CA-T4.3, RN-16d)', () => {
  const hoje = '2026-10-24';
  it('mês passado está fechado', () => expect(mesFechado('2020-01-01', hoje)).toBe(true));
  it('mês anterior ao corrente está fechado', () => expect(mesFechado('2026-09-30', hoje)).toBe(true));
  it('mês corrente não está fechado', () => expect(mesFechado('2026-10-01', hoje)).toBe(false));
  it('mês futuro não está fechado', () => expect(mesFechado('2030-01-01', hoje)).toBe(false));
  it('o mês fecha no próprio dia 1 do mês seguinte (hoje = dia 1 conta como passado)', () => {
    expect(mesFechado('2026-09-01', '2026-10-01')).toBe(true);
    expect(mesFechado('2026-09-15', '2026-09-30')).toBe(false);
  });
  it('o mês é normalizado: qualquer dia do mês dá o mesmo resultado', () => {
    expect(mesFechado('2026-09-17', '2026-10-01')).toBe(true);
  });
});

// Janela de ±12 meses (RN-15, G-24): F garantir_ocorrencias.sql; tests/resumo/resumo_mes_janela.sql.
describe('mesNaJanela (RN-15, CA-15.2, G-24)', () => {
  const hoje = '2026-10-24';
  it.each([
    ['2027-10-01', true, 'CA-15.2: outubro/2027 (+12) gera'],
    ['2025-10-01', true, 'CA-15.2: outubro/2025 (−12) gera'],
    ['2027-11-01', false, 'CA-15.2: novembro/2027 (+13) não gera'],
    ['2025-09-30', false, 'setembro/2025 (−13) não gera'],
    ['2027-10-31', true, 'qualquer dia do mês +12 é normalizado para o mês'],
    ['2026-10-01', true, 'mês corrente'],
    ['9999-01-01', false, 'mês muito distante'],
  ])('%s → %s (%s)', (mes, esperado) => {
    expect(mesNaJanela(mes, hoje)).toBe(esperado);
  });
  it('a janela anda com o hoje (hoje fixado em 2027-03-01: abril/2026 a março/2028)', () => {
    expect(mesNaJanela('2026-03-01', '2027-03-01')).toBe(true);
    expect(mesNaJanela('2026-02-01', '2027-03-01')).toBe(false);
    expect(mesNaJanela('2028-02-01', '2027-03-01')).toBe(true);
    expect(mesNaJanela('2028-03-01', '2027-03-01')).toBe(true);
    expect(mesNaJanela('2028-04-01', '2027-03-01')).toBe(false);
  });
});
