import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { copiarOrcamento, definirOrcamento } from './comandos/orcamento';
import { desfazerPagamento, encerrarDespesaFixa, pagarOcorrencia, salvarDespesaFixa } from './comandos/despesasFixas';
import { buscarDespesaFixa, buscarDespesasFixas } from './consultas/despesasFixas';
import { buscarOcorrenciasMes } from './consultas/ocorrenciasMes';
import { buscarOrcamentoMes } from './consultas/orcamentoMes';

/**
 * Camada de dados das despesas fixas, das ocorrências e do orçamento sobre `fetch('/api/…')` (SDD 6.1 #27 a #31, #34 a
 * #36). A resposta é conferida com o contrato Zod pelo transporte (uma fixture fora do contrato faz o teste falhar);
 * aqui se confere a rota, o método, o corpo, o cabeçalho CSRF e o tratamento de erro.
 */

const ID_FIXA = '00000000-0000-4000-8000-000000000701';
const ID_OCORRENCIA = '00000000-0000-4000-8000-000000000801';
const ID_PAGAMENTO = '00000000-0000-4000-8000-000000000a01';
const ID_FORMA = '00000000-0000-4000-8000-000000000301';
const ID_CATEGORIA = '00000000-0000-4000-8000-000000000403';

const fetchSimulado = vi.fn<typeof fetch>();
const resposta = (status: number, corpo?: unknown) =>
  Promise.resolve(
    new Response(corpo === undefined ? null : JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
const ultima = () => {
  const [url, init] = fetchSimulado.mock.calls.at(-1)!;
  return {
    url: String(url),
    metodo: init?.method,
    cabecalhos: init?.headers as Record<string, string>,
    corpo: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
  };
};

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => vi.unstubAllGlobals());

describe('despesas fixas: leituras', () => {
  it('GET /api/fixas devolve a lista como veio, com as encerradas', async () => {
    const lista = lerResposta<Array<Record<string, unknown>>>('despesas-fixas.json');
    lista[6] = { ...lista[6]!, encerrada_em: '2026-09-30' };
    fetchSimulado.mockImplementation(() => resposta(200, lista));

    await expect(buscarDespesasFixas()).resolves.toEqual(lista);

    expect(ultima()).toMatchObject({ url: '/api/fixas', metodo: 'GET' });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBeUndefined();
  });

  it('a fixa de um id vem da lista; id ausente da lista e id malformado valem como inexistentes (RT-01)', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, lerResposta('despesas-fixas.json')));

    await expect(buscarDespesaFixa(ID_FIXA)).resolves.toMatchObject({ descricao: 'Aluguel' });
    await expect(buscarDespesaFixa('00000000-0000-4000-8000-0000000009ff')).rejects.toEqual({
      tipo: 'regra',
      codigo: 'registro_invalido',
    });
    fetchSimulado.mockClear();
    await expect(buscarDespesaFixa('xyz')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('GET /api/fixas/ocorrencias?mes=AAAA-MM-01 devolve contagens, previsto e ordem do servidor', async () => {
    const ocorrencias = lerResposta('ocorrencias-mes.json');
    fetchSimulado.mockImplementation(() => resposta(200, ocorrencias));

    await expect(buscarOcorrenciasMes('2026-10')).resolves.toEqual(ocorrencias);

    expect(ultima()).toMatchObject({ url: '/api/fixas/ocorrencias?mes=2026-10-01', metodo: 'GET' });
  });

  it('resposta fora do contrato (ocorrência com a forma do pagamento) é rejeitada: §2.1', async () => {
    const base = lerResposta<{ ocorrencias: Array<Record<string, unknown>> }>('ocorrencias-mes.json');
    const vazada = { ...base, ocorrencias: [{ ...base.ocorrencias[0]!, forma_id: ID_FORMA }] };
    fetchSimulado.mockImplementation(() => resposta(200, vazada));

    await expect(buscarOcorrenciasMes('2026-10')).rejects.toBeDefined();
  });

  it('erro de servidor vira "indisponivel" e falta de rede vira "rede"', async () => {
    fetchSimulado.mockImplementation(() => resposta(500, { code: 'erro_interno', message: 'x' }));
    await expect(buscarOcorrenciasMes('2026-10')).rejects.toEqual({ tipo: 'indisponivel' });
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(buscarOcorrenciasMes('2026-10')).rejects.toEqual({ tipo: 'rede' });
  });
});

describe('despesas fixas: escritas', () => {
  it('salvar: PUT /api/fixas/:id com o id do cliente e só os campos do contrato (sem lar, dono, escopo nem tipo)', async () => {
    fetchSimulado.mockImplementation(() => resposta(201, { id: ID_FIXA }));

    await expect(
      salvarDespesaFixa({
        id: ID_FIXA,
        descricao: 'Aluguel',
        categoriaId: ID_CATEGORIA,
        valorPrevistoCentavos: 120000,
        diaVencimento: 10,
      }),
    ).resolves.toEqual({ id: ID_FIXA });

    expect(ultima()).toMatchObject({
      url: `/api/fixas/${ID_FIXA}`,
      metodo: 'PUT',
      corpo: {
        descricao: 'Aluguel',
        categoria_id: ID_CATEGORIA,
        valor_previsto_centavos: 120000,
        dia_vencimento: 10,
      },
    });
    expect(Object.keys(ultima().corpo as object).sort()).toEqual([
      'categoria_id',
      'descricao',
      'dia_vencimento',
      'valor_previsto_centavos',
    ]);
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('salvar é idempotente: repetir com o mesmo id (200) devolve o mesmo id sem erro', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, { id: ID_FIXA }));
    const dados = {
      id: ID_FIXA,
      descricao: 'Aluguel',
      categoriaId: ID_CATEGORIA,
      valorPrevistoCentavos: 120000,
      diaVencimento: 10,
    };

    await salvarDespesaFixa(dados);
    await expect(salvarDespesaFixa(dados)).resolves.toEqual({ id: ID_FIXA });

    expect(fetchSimulado.mock.calls.map(([url]) => String(url))).toEqual([
      `/api/fixas/${ID_FIXA}`,
      `/api/fixas/${ID_FIXA}`,
    ]);
  });

  it('salvar com id malformado não chama o servidor', async () => {
    await expect(
      salvarDespesaFixa({
        id: 'xyz',
        descricao: 'a',
        categoriaId: ID_CATEGORIA,
        valorPrevistoCentavos: 1,
        diaVencimento: 1,
      }),
    ).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('valor_invalido do servidor sobe como regra (fixa encerrada, dia fora de 1 a 31)', async () => {
    fetchSimulado.mockImplementation(() => resposta(400, { code: 'valor_invalido', message: 'x' }));

    await expect(
      salvarDespesaFixa({
        id: ID_FIXA,
        descricao: 'a',
        categoriaId: ID_CATEGORIA,
        valorPrevistoCentavos: 1,
        diaVencimento: 1,
      }),
    ).rejects.toEqual({ tipo: 'regra', codigo: 'valor_invalido' });
  });

  it('encerrar: POST /api/fixas/:id/encerrar (204, sem corpo)', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));

    await expect(encerrarDespesaFixa(ID_FIXA)).resolves.toBeUndefined();

    expect(ultima()).toMatchObject({ url: `/api/fixas/${ID_FIXA}/encerrar`, metodo: 'POST', corpo: undefined });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('pagar: POST com o id do lançamento do cliente, a forma, o valor e a data; devolve a resposta mínima', async () => {
    const pago = {
      ocorrencia_id: ID_OCORRENCIA,
      lancamento_id: ID_PAGAMENTO,
      situacao: 'paga',
      valor_pago_centavos: 11990,
      vencimento: '2026-10-05',
      ja_existia: false,
    };
    fetchSimulado.mockImplementation(() => resposta(201, pago));

    await expect(
      pagarOcorrencia({
        ocorrenciaId: ID_OCORRENCIA,
        id: ID_PAGAMENTO,
        formaId: ID_FORMA,
        valorCentavos: 11990,
        data: '2026-10-09',
      }),
    ).resolves.toEqual(pago);

    expect(ultima()).toMatchObject({
      url: `/api/ocorrencias/${ID_OCORRENCIA}/pagamento`,
      metodo: 'POST',
      corpo: { id: ID_PAGAMENTO, forma_id: ID_FORMA, valor_centavos: 11990, data: '2026-10-09' },
    });
  });

  it('pagar sem valor e sem data deixa o servidor aplicar o previsto e hoje (as chaves nem vão no corpo)', async () => {
    fetchSimulado.mockImplementation(() =>
      resposta(200, {
        ocorrencia_id: ID_OCORRENCIA,
        lancamento_id: ID_PAGAMENTO,
        situacao: 'paga',
        valor_pago_centavos: 11990,
        vencimento: '2026-10-05',
        ja_existia: true,
      }),
    );

    await pagarOcorrencia({ ocorrenciaId: ID_OCORRENCIA, id: ID_PAGAMENTO, formaId: ID_FORMA });

    expect(ultima().corpo).toEqual({ id: ID_PAGAMENTO, forma_id: ID_FORMA });
  });

  it.each([
    ['ocorrencia_paga', 409],
    ['forma_arquivada', 409],
    ['registro_invalido', 404],
    ['valor_invalido', 400],
  ])('pagar: o código %s sobe como regra', async (codigo, status) => {
    fetchSimulado.mockImplementation(() => resposta(status, { code: codigo, message: 'x' }));

    await expect(pagarOcorrencia({ ocorrenciaId: ID_OCORRENCIA, id: ID_PAGAMENTO, formaId: ID_FORMA })).rejects.toEqual(
      { tipo: 'regra', codigo },
    );
  });

  it('desfazer: DELETE /api/ocorrencias/:id/pagamento (204); sem_permissao sobe para quem não pagou', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));
    await expect(desfazerPagamento(ID_OCORRENCIA)).resolves.toBeUndefined();
    expect(ultima()).toMatchObject({ url: `/api/ocorrencias/${ID_OCORRENCIA}/pagamento`, metodo: 'DELETE' });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');

    fetchSimulado.mockImplementation(() => resposta(403, { code: 'sem_permissao', message: 'x' }));
    await expect(desfazerPagamento(ID_OCORRENCIA)).rejects.toEqual({ tipo: 'regra', codigo: 'sem_permissao' });
  });

  it('ids malformados não chamam o servidor', async () => {
    await expect(encerrarDespesaFixa('xyz')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    await expect(desfazerPagamento('xyz')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    await expect(pagarOcorrencia({ ocorrenciaId: 'xyz', id: ID_PAGAMENTO, formaId: ID_FORMA })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'registro_invalido',
    });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

describe('orçamento', () => {
  it('GET /api/orcamento?mes=AAAA-MM-01&escopo= devolve a resposta como veio', async () => {
    const orcamento = lerResposta('orcamento-mes.json');
    fetchSimulado.mockImplementation(() => resposta(200, orcamento));

    await expect(buscarOrcamentoMes('2026-10', 'conjunto')).resolves.toEqual(orcamento);
    expect(ultima()).toMatchObject({ url: '/api/orcamento?mes=2026-10-01&escopo=conjunto', metodo: 'GET' });

    await buscarOrcamentoMes('2026-10', 'individual');
    expect(ultima().url).toBe('/api/orcamento?mes=2026-10-01&escopo=individual');
  });

  it('definir: PUT /api/orcamento/:mes/:categoria com valor_centavos (204)', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));

    await expect(
      definirOrcamento({ mes: '2026-10', categoriaId: ID_CATEGORIA, valorCentavos: 40000 }),
    ).resolves.toBeUndefined();

    expect(ultima()).toMatchObject({
      url: `/api/orcamento/2026-10-01/${ID_CATEGORIA}`,
      metodo: 'PUT',
      corpo: { valor_centavos: 40000 },
    });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('remover: valor nulo explícito no corpo (idempotente, CA-T3.5)', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));

    await definirOrcamento({ mes: '2026-10', categoriaId: ID_CATEGORIA, valorCentavos: null });

    expect(ultima().corpo).toEqual({ valor_centavos: null });
  });

  it('definir com categoria malformada não chama o servidor; valor_invalido e plano_necessario sobem como regra', async () => {
    await expect(definirOrcamento({ mes: '2026-10', categoriaId: 'xyz', valorCentavos: 1 })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'registro_invalido',
    });
    expect(fetchSimulado).not.toHaveBeenCalled();

    fetchSimulado.mockImplementation(() => resposta(400, { code: 'valor_invalido', message: 'x' }));
    await expect(definirOrcamento({ mes: '2026-10', categoriaId: ID_CATEGORIA, valorCentavos: 0 })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'valor_invalido',
    });
  });

  it('copiar: POST /api/orcamento/:mes/copiar com o escopo da API e devolve quantas categorias foram copiadas', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, { copiadas: 5 }));

    await expect(copiarOrcamento({ mes: '2026-11', escopo: 'conjunto' })).resolves.toBe(5);
    expect(ultima()).toMatchObject({
      url: '/api/orcamento/2026-11-01/copiar',
      metodo: 'POST',
      corpo: { escopo: 'conjunto' },
    });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');

    fetchSimulado.mockImplementation(() => resposta(200, { copiadas: 0 }));
    await expect(copiarOrcamento({ mes: '2026-11', escopo: 'individual' })).resolves.toBe(0);
    expect(ultima().corpo).toEqual({ escopo: 'individual' });
  });

  it('copiar sem rede sobe "rede"', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(copiarOrcamento({ mes: '2026-11', escopo: 'conjunto' })).rejects.toEqual({ tipo: 'rede' });
  });
});
