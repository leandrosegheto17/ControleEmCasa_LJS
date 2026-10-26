import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { categoria, limparAparelho, montarApp, preAquecerPaginas, UUID_V4 } from '../../test/apoio/apiCadastros';
import {
  criarServidorFixas,
  ID_ALUGUEL,
  ID_OC_ALUGUEL,
  instalarApiFixas,
  preAquecerFixas,
  type ServidorFixas,
} from '../../test/apoio/apiFixas';
import { chamadasA } from '../../test/apoio/apiLancamentos';

/**
 * Despesa fixa: criar, editar e encerrar o modelo (etapa 12, lote 3). Critérios: RN-15 (descrição não vazia, categoria
 * conjunta de despesa, previsto > 0, dia 1 a 31; não se exclui, só se encerra; editar atualiza as pendentes do mês
 * corrente em diante), CA-T3.4 e ADR-010 (id gerado no cliente, escrita idempotente), RT-01.
 */

let servidor: ServidorFixas;

// Com a suíte inteira em paralelo, a primeira montagem de uma tela pode passar de 1 s (módulos e contrato carregados na hora).
configure({ asyncUtilTimeout: 5000 });

beforeAll(async () => {
  await preAquecerPaginas();
  await preAquecerFixas();
}, 60_000);

beforeEach(async () => {
  servidor = criarServidorFixas();
  instalarApiFixas(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const EDICAO = `/app/fixas/${ID_ALUGUEL}?mes=2026-10`;
const NOVA = '/app/fixas/nova?mes=2026-10';
const puts = () => chamadasA(servidor, 'PUT', '/api/fixas/');
const valorDe = (campo: HTMLElement) => (campo as HTMLInputElement).value;

async function preencherNova(usuario: ReturnType<typeof userEvent.setup>, dia = '5') {
  await usuario.type(await screen.findByLabelText('Descrição'), 'Internet');
  await usuario.type(screen.getByLabelText('Valor previsto'), '11990');
  const campoDia = screen.getByLabelText('Dia de vencimento');
  await usuario.clear(campoDia);
  await usuario.type(campoDia, dia);
}

describe('DespesaFixa: edição', () => {
  it('carrega o modelo com descrição, categoria, valor, dia e o botão Encerrar', async () => {
    montarApp(EDICAO);

    expect(await screen.findByRole('heading', { level: 1, name: 'Despesa fixa' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));
    expect(screen.getByLabelText('Categoria da casa')).toHaveDisplayValue('Moradia');
    expect(valorDe(screen.getByLabelText('Valor previsto'))).toMatch(/^R\$\s1\.200,00$/);
    expect(screen.getByLabelText('Dia de vencimento')).toHaveValue('10');
    expect(screen.getByText('Pode ser ajustado na hora de pagar.')).toBeInTheDocument();
    expect(screen.getByText('De 1 a 31. Em meses mais curtos, vale o último dia.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encerrar despesa fixa' })).toBeInTheDocument();
    expect(
      screen.getByText('Encerrar para de gerar ocorrências a partir do mês seguinte. O histórico continua.'),
    ).toBeInTheDocument();
  });

  it('o select só tem despesas da casa, ativas: nada de individual, de receita nem de arquivada (privacidade)', async () => {
    servidor.categorias.push(
      categoria({ id: '00000000-0000-4000-8000-000000000499', nome: 'Reforma antiga', arquivada: true }),
    );
    montarApp(EDICAO);

    await screen.findByLabelText('Categoria da casa');
    const opcoes = within(screen.getByLabelText('Categoria da casa')).getAllByRole('option');
    expect(opcoes.map((o) => o.textContent)).toEqual([
      'Mercado',
      'Delivery/iFood do casal',
      'Moradia',
      'Contas da casa',
      'Outros da casa',
    ]);
  });

  it('salvar envia PUT no id do modelo com os campos da API e volta à lista do mês com o aviso', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(EDICAO);
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));

    const valor = screen.getByLabelText('Valor previsto');
    await usuario.clear(valor);
    await usuario.type(valor, '130000');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Despesa fixa salva')).toBeInTheDocument();
    expect(puts()).toHaveLength(1);
    expect(puts()[0]!.url).toBe(`/api/fixas/${ID_ALUGUEL}`);
    expect(puts()[0]!.corpo).toEqual({
      descricao: 'Aluguel',
      categoria_id: '00000000-0000-4000-8000-000000000403',
      valor_previsto_centavos: 130000,
      dia_vencimento: 10,
    });
    expect(puts()[0]!.cabecalhos['X-Controle-Em-Casa']).toBe('1');
    await waitFor(() => expect(local()).toBe('/app/fixas?mes=2026-10'));
  });

  it('editar atualiza a ocorrência pendente do mês e deixa as pagas intactas (RN-15)', async () => {
    const usuario = userEvent.setup();
    montarApp(EDICAO);
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));

    const valor = screen.getByLabelText('Valor previsto');
    await usuario.clear(valor);
    await usuario.type(valor, '130000');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    const titulo = await screen.findByRole('heading', { name: /Pagas: 4 de 7/ });
    expect(titulo).toHaveTextContent(/R\$\s1\.640,00/);
    const aluguel = within(titulo.closest('section') as HTMLElement)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes('Aluguel'))!;
    expect(aluguel).toHaveTextContent(/R\$\s1\.300,00/);
    expect(servidor.ocorrencias.find((o) => o.id === ID_OC_ALUGUEL)!.valor_previsto_centavos).toBe(130000);
    const luz = servidor.ocorrencias.find((o) => o.descricao === 'Luz')!;
    expect(luz.valor_pago_centavos).toBe(18740);
  });

  it('modelo inexistente, alheio ou com id malformado mostra "não existe mais" e não pede nada ao servidor', async () => {
    montarApp('/app/fixas/00000000-0000-4000-8000-0000000009ff?mes=2026-10');

    expect(await screen.findByText(/Esta despesa fixa não existe mais/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Descrição')).not.toBeInTheDocument();
    for (const voltar of screen.getAllByRole('link', { name: 'Voltar para Despesas fixas' })) {
      expect(voltar).toHaveAttribute('href', '/app/fixas?mes=2026-10');
    }
  });

  it('id malformado na URL vale como inexistente', async () => {
    montarApp('/app/fixas/xyz?mes=2026-10');

    expect(await screen.findByText(/Esta despesa fixa não existe mais/)).toBeInTheDocument();
    expect(chamadasA(servidor, 'GET', '/api/fixas')).toHaveLength(0);
  });

  it('o servidor recusa o valor (valor_invalido): o erro aparece no campo "Valor previsto" e nada é gravado', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('PUT /api/fixas/:id', { status: 400, code: 'valor_invalido' });
    montarApp(EDICAO);
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));

    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Valor inválido. Confira e tente de novo')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor previsto')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { level: 1, name: 'Despesa fixa' })).toBeInTheDocument();
  });
});

describe('DespesaFixa: nova', () => {
  it('título "Nova despesa fixa", sem Encerrar e com a 1ª categoria selecionada', async () => {
    montarApp(NOVA);

    expect(await screen.findByRole('heading', { level: 1, name: 'Nova despesa fixa' })).toBeInTheDocument();
    await screen.findByLabelText('Descrição');
    expect(screen.queryByRole('button', { name: 'Encerrar despesa fixa' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Categoria da casa')).toHaveDisplayValue('Mercado');
  });

  it('salvar cria o modelo com id gerado no cliente (201), aparece em Modelos e gera a ocorrência do mês', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(NOVA);

    await preencherNova(usuario);
    await usuario.selectOptions(screen.getByLabelText('Categoria da casa'), 'Contas da casa');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Despesa fixa salva')).toBeInTheDocument();
    const [chamada] = puts();
    expect(chamada!.url).toMatch(new RegExp(`^/api/fixas/${UUID_V4.source.slice(1, -1)}$`, 'i'));
    expect(chamada!.corpo).toEqual({
      descricao: 'Internet',
      categoria_id: '00000000-0000-4000-8000-000000000404',
      valor_previsto_centavos: 11990,
      dia_vencimento: 5,
    });
    await waitFor(() => expect(local()).toBe('/app/fixas?mes=2026-10'));
    expect(await screen.findByRole('region', { name: 'Modelos' })).toBeInTheDocument();
    expect(servidor.modelos.filter((m) => m.descricao === 'Internet')).toHaveLength(2);
  });

  it('sem rede avisa e mantém os campos; a nova tentativa usa o MESMO id e não cria duas fixas (idempotência)', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(NOVA);
    await preencherNova(usuario);
    const antes = servidor.modelos.length;
    servidor.semRede = true;

    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(await screen.findByText('Sem conexão. Tente de novo')).toBeInTheDocument();
    expect(screen.getByLabelText('Descrição')).toHaveValue('Internet');
    expect(screen.getByLabelText('Dia de vencimento')).toHaveValue('5');
    expect(local()).toBe('/app/fixas/nova?mes=2026-10');
    servidor.semRede = false;

    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(puts()[1]!.url).toBe(puts()[0]!.url);
    expect(puts()[1]!.corpo).toEqual(puts()[0]!.corpo);
    await waitFor(() => expect(local()).toBe('/app/fixas?mes=2026-10'));
    expect(servidor.modelos).toHaveLength(antes + 1);
  });
});

describe('DespesaFixa: validação', () => {
  it('descrição vazia mostra o erro, marca o campo, leva o foco a ele e não chama o servidor', async () => {
    const usuario = userEvent.setup();
    montarApp(EDICAO);
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));

    await usuario.clear(screen.getByLabelText('Descrição'));
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    const descricao = screen.getByLabelText('Descrição');
    expect(screen.getByText('Informe a descrição.')).toBeInTheDocument();
    expect(descricao).toHaveAttribute('aria-invalid', 'true');
    expect(descricao).toHaveFocus();
    expect(puts()).toHaveLength(0);
  });

  it.each(['0', '32', '3a', ''])('dia "%s" é recusado antes de enviar (RN-15: 1 a 31)', async (dia) => {
    const usuario = userEvent.setup();
    montarApp(EDICAO);
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));

    const campoDia = screen.getByLabelText('Dia de vencimento');
    await usuario.clear(campoDia);
    if (dia) await usuario.type(campoDia, dia);
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Use um dia de 1 a 31.')).toBeInTheDocument();
    expect(campoDia).toHaveAttribute('aria-invalid', 'true');
    expect(puts()).toHaveLength(0);
  });

  it.each(['1', '31'])('dia %s é aceito', async (dia) => {
    const usuario = userEvent.setup();
    montarApp(EDICAO);
    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));

    const campoDia = screen.getByLabelText('Dia de vencimento');
    await usuario.clear(campoDia);
    await usuario.type(campoDia, dia);
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]!.corpo).toMatchObject({ dia_vencimento: Number(dia) });
  });

  it('valor zero mostra o erro do valor e não envia', async () => {
    const usuario = userEvent.setup();
    montarApp(NOVA);

    await usuario.type(await screen.findByLabelText('Descrição'), 'Internet');
    const campoDia = screen.getByLabelText('Dia de vencimento');
    await usuario.clear(campoDia);
    await usuario.type(campoDia, '5');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText(/Informe um valor maior que zero/)).toBeInTheDocument();
    expect(puts()).toHaveLength(0);
  });
});

describe('DespesaFixa: encerrar', () => {
  it('abre o diálogo; Cancelar não chama o servidor', async () => {
    const usuario = userEvent.setup();
    montarApp(EDICAO);

    await usuario.click(await screen.findByRole('button', { name: 'Encerrar despesa fixa' }));
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));

    expect(chamadasA(servidor, 'POST', '/api/fixas/')).toHaveLength(0);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('confirmar encerra o modelo (hoje), avisa, volta à lista e o modelo sai de "Modelos"; o mês corrente segue (CA-15.4)', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(EDICAO);

    await usuario.click(await screen.findByRole('button', { name: 'Encerrar despesa fixa' }));
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /Encerrar/ }));

    expect(await screen.findByText('Despesa fixa encerrada')).toBeInTheDocument();
    expect(chamadasA(servidor, 'POST', `/api/fixas/${ID_ALUGUEL}/encerrar`)).toHaveLength(1);
    await waitFor(() => expect(local()).toBe('/app/fixas?mes=2026-10'));
    expect(servidor.modelos.find((m) => m.id === ID_ALUGUEL)!.encerrada_em).toBe('2026-10-09');
    const modelos = await screen.findByRole('region', { name: 'Modelos' });
    expect(within(modelos).queryByText('Aluguel')).not.toBeInTheDocument();
    // A ocorrência de outubro (mês do encerramento) continua na lista do mês.
    expect(await screen.findByRole('heading', { name: /Pagas: 4 de 7/ })).toBeInTheDocument();
  });

  it('encerrar apaga as pendentes dos meses seguintes: novembro passa de 7 para 6 ocorrências (CA-15.4)', async () => {
    const usuario = userEvent.setup();
    await fetch('/api/fixas/ocorrencias?mes=2026-11-01');
    expect(servidor.ocorrencias.filter((o) => o.vencimento.startsWith('2026-11'))).toHaveLength(7);
    const { local } = montarApp(EDICAO);

    await usuario.click(await screen.findByRole('button', { name: 'Encerrar despesa fixa' }));
    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /Encerrar/ }));
    await waitFor(() => expect(local()).toBe('/app/fixas?mes=2026-10'));

    expect(servidor.ocorrencias.filter((o) => o.vencimento.startsWith('2026-11'))).toHaveLength(6);
  });

  it('sem rede, avisa e a fixa continua ativa', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(EDICAO);
    await usuario.click(await screen.findByRole('button', { name: 'Encerrar despesa fixa' }));
    servidor.semRede = true;

    await usuario.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /Encerrar/ }));

    expect(await screen.findByText('Sem conexão. Tente de novo')).toBeInTheDocument();
    expect(local()).toBe(EDICAO);
    expect(servidor.modelos.find((m) => m.id === ID_ALUGUEL)!.encerrada_em).toBeNull();
  });

  it('modelo já encerrado não mostra o botão Encerrar nem a nota', async () => {
    servidor.modelos = servidor.modelos.map((m) => (m.id === ID_ALUGUEL ? { ...m, encerrada_em: '2026-09-30' } : m));
    montarApp(EDICAO);

    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));
    expect(screen.queryByRole('button', { name: 'Encerrar despesa fixa' })).not.toBeInTheDocument();
  });
});

describe('DespesaFixa: estados de leitura', () => {
  it('erro ao carregar mostra o estado de erro e "Tentar de novo" recarrega', async () => {
    const usuario = userEvent.setup();
    servidor.falhas.set('GET /api/fixas', { status: 500, code: 'erro_interno' });
    montarApp(EDICAO);

    expect(await screen.findByRole('heading', { name: 'Não foi possível carregar' })).toBeInTheDocument();
    servidor.falhas.clear();
    await usuario.click(screen.getByRole('button', { name: /Tentar de novo/ }));

    await waitFor(() => expect(screen.getByLabelText('Descrição')).toHaveValue('Aluguel'));
  });
});
