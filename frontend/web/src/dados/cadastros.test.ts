import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { arquivarCategoria, excluirCategoria, salvarCategoria } from './comandos/categorias';
import { ajustarSaldo, arquivarConta, excluirConta, salvarConta } from './comandos/contas';
import {
  arquivarForma,
  definirPreferida,
  excluirForma,
  registrarPagamentoCartao,
  salvarForma,
} from './comandos/formas';
import { buscarCategoria, buscarCategorias } from './consultas/categorias';
import { buscarConta, buscarContas } from './consultas/contas';
import { buscarForma, buscarFormas } from './consultas/formas';

beforeAll(() => import('@controle/contrato'), 30_000);

/**
 * Camada de dados dos cadastros: cada função chama a rota certa de `/api/*` (SDD 6.1 #5 a #19; ADR-010) com o
 * corpo do contrato, e preserva o código de erro da API. O `fetch` é simulado; o transporte é o de verdade.
 */

const ID = '00000000-0000-4000-8000-000000000201';
const OUTRO = '00000000-0000-4000-8000-000000000202';
const CONTA = {
  id: ID,
  nome: 'Nubank',
  saldo_inicial_centavos: 0,
  saldo_centavos: 100,
  arquivada: false,
  pode_excluir: true,
};
const FORMA = {
  id: ID,
  nome: 'Pix',
  tipo: 'pix',
  conta: null,
  dia_vencimento: null,
  preferida: false,
  arquivada: false,
  pode_excluir: true,
  gasto_mes_centavos: null,
  comprometido_futuro_centavos: null,
};
const CATEGORIA = {
  id: ID,
  nome: 'Mercado',
  tipo: 'despesa',
  escopo: 'conjunto',
  variavel: true,
  arquivada: false,
  pode_excluir: true,
};

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const semCorpo = async () => new Response(null, { status: 204 });

const fetchSimulado = vi.fn<(entrada: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const ultima = () => {
  const [url, init] = fetchSimulado.mock.calls.at(-1)!;
  return {
    url: String(url),
    metodo: init?.method,
    corpo: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
    cabecalhos: init?.headers as Record<string, string>,
  };
};

beforeEach(() => {
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
});
afterEach(() => vi.unstubAllGlobals());

describe('comandos de conta', () => {
  it('salvarConta: PUT /api/contas/:id com nome e saldo inicial (criar e editar são o mesmo PUT)', async () => {
    fetchSimulado.mockResolvedValue(json({ id: ID }, 201));

    const r = await salvarConta({ id: ID, nome: 'Nubank', saldoInicialCentavos: -500 });

    expect(r).toEqual({ id: ID });
    expect(ultima()).toMatchObject({
      url: `/api/contas/${ID}`,
      metodo: 'PUT',
      corpo: { nome: 'Nubank', saldo_inicial_centavos: -500 },
    });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('arquivarConta: POST /arquivar e excluirConta: DELETE, ambos sem corpo', async () => {
    fetchSimulado.mockImplementation(semCorpo);

    await arquivarConta(ID);
    expect(ultima()).toMatchObject({ url: `/api/contas/${ID}/arquivar`, metodo: 'POST', corpo: undefined });
    await excluirConta(ID);
    expect(ultima()).toMatchObject({ url: `/api/contas/${ID}`, metodo: 'DELETE', corpo: undefined });
  });

  it('excluirConta preserva o código em_uso como erro de regra', async () => {
    fetchSimulado.mockResolvedValue(json({ code: 'em_uso', message: 'x' }, 409));

    await expect(excluirConta(ID)).rejects.toEqual({ tipo: 'regra', codigo: 'em_uso' });
  });

  it('ajustarSaldo: POST /ajuste devolve só a diferença com sinal; simular vai no corpo', async () => {
    fetchSimulado.mockResolvedValue(json({ diferenca_centavos: -1230 }));

    const diferenca = await ajustarSaldo({ contaId: ID, saldoRealCentavos: 320255, simular: true });

    expect(diferenca).toBe(-1230);
    expect(ultima()).toMatchObject({
      url: `/api/contas/${ID}/ajuste`,
      metodo: 'POST',
      corpo: { saldo_real_centavos: 320255, simular: true },
    });
  });

  it('valor_invalido da API chega como erro de regra', async () => {
    fetchSimulado.mockResolvedValue(json({ code: 'valor_invalido', message: 'x' }, 400));

    await expect(salvarConta({ id: ID, nome: 'x', saldoInicialCentavos: 0 })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'valor_invalido',
    });
  });
});

describe('comandos de forma', () => {
  it('salvarForma: PUT com tipo, conta e dia; ausentes viram null', async () => {
    fetchSimulado.mockImplementation(async () => json({ id: ID }));

    await salvarForma({ id: ID, nome: 'Pix', tipo: 'pix', contaId: OUTRO });
    expect(ultima()).toMatchObject({
      url: `/api/formas/${ID}`,
      metodo: 'PUT',
      corpo: { nome: 'Pix', tipo: 'pix', conta_id: OUTRO, dia_vencimento: null },
    });

    await salvarForma({ id: ID, nome: 'Cartão', tipo: 'credito', diaVencimento: 10, contaId: null });
    expect(ultima().corpo).toEqual({ nome: 'Cartão', tipo: 'credito', conta_id: null, dia_vencimento: 10 });
  });

  it('definirPreferida: PUT /preferida; arquivar: POST; excluir: DELETE', async () => {
    fetchSimulado.mockImplementation(semCorpo);

    await definirPreferida(ID, true);
    expect(ultima()).toMatchObject({ url: `/api/formas/${ID}/preferida`, metodo: 'PUT', corpo: { preferida: true } });
    await arquivarForma(ID);
    expect(ultima()).toMatchObject({ url: `/api/formas/${ID}/arquivar`, metodo: 'POST' });
    await excluirForma(ID);
    expect(ultima()).toMatchObject({ url: `/api/formas/${ID}`, metodo: 'DELETE' });
  });

  it('registrarPagamentoCartao: POST /api/formas/:id/pagamentos com id do cliente, conta, valor e data', async () => {
    fetchSimulado.mockResolvedValue(json({ id: OUTRO, ja_existia: false }, 201));

    const r = await registrarPagamentoCartao({
      id: OUTRO,
      formaId: ID,
      contaId: ID,
      valorCentavos: 150000,
      data: '2026-10-25',
    });

    expect(r).toEqual({ id: OUTRO, ja_existia: false });
    expect(ultima()).toMatchObject({
      url: `/api/formas/${ID}/pagamentos`,
      metodo: 'POST',
      corpo: { id: OUTRO, conta_id: ID, valor_centavos: 150000, data: '2026-10-25' },
    });
  });

  it('registro_invalido (forma que não é crédito, conta alheia) chega como erro de regra', async () => {
    fetchSimulado.mockResolvedValue(json({ code: 'registro_invalido', message: 'x' }, 404));

    await expect(
      registrarPagamentoCartao({ id: OUTRO, formaId: ID, contaId: ID, valorCentavos: 1, data: '2026-10-25' }),
    ).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
  });
});

describe('comandos de categoria', () => {
  it('salvarCategoria: PUT com nome, tipo, escopo e variável só quando informada', async () => {
    fetchSimulado.mockImplementation(async () => json({ id: ID }));

    await salvarCategoria({ id: ID, nome: 'Mercado', tipo: 'despesa', escopo: 'conjunto', variavel: true });
    expect(ultima()).toMatchObject({
      url: `/api/categorias/${ID}`,
      metodo: 'PUT',
      corpo: { nome: 'Mercado', tipo: 'despesa', escopo: 'conjunto', variavel: true },
    });

    await salvarCategoria({ id: ID, nome: 'Salário', tipo: 'receita', escopo: 'individual' });
    expect(ultima().corpo).toEqual({ nome: 'Salário', tipo: 'receita', escopo: 'individual' });
  });

  it('arquivar: POST; excluir: DELETE com categoria_em_uso preservado', async () => {
    fetchSimulado.mockImplementationOnce(semCorpo);
    await arquivarCategoria(ID);
    expect(ultima()).toMatchObject({ url: `/api/categorias/${ID}/arquivar`, metodo: 'POST' });

    fetchSimulado.mockResolvedValueOnce(json({ code: 'categoria_em_uso', message: 'x' }, 409));
    await expect(excluirCategoria(ID)).rejects.toEqual({ tipo: 'regra', codigo: 'categoria_em_uso' });
    expect(ultima()).toMatchObject({ url: `/api/categorias/${ID}`, metodo: 'DELETE' });
  });

  it('nome_repetido chega como erro de regra', async () => {
    fetchSimulado.mockResolvedValue(json({ code: 'nome_repetido', message: 'x' }, 409));

    await expect(salvarCategoria({ id: ID, nome: 'Mercado', tipo: 'despesa', escopo: 'conjunto' })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'nome_repetido',
    });
  });
});

describe('consultas dos cadastros', () => {
  it.each([
    ['contas', buscarContas, buscarConta, CONTA, '/api/contas'],
    ['formas', buscarFormas, buscarForma, FORMA, '/api/formas'],
    ['categorias', buscarCategorias, buscarCategoria, CATEGORIA, '/api/categorias'],
  ] as const)('%s: GET na lista; a linha por id vem da lista', async (_nome, lista, uma, linha, rota) => {
    fetchSimulado.mockImplementation(async () => json([linha]));

    expect(await lista()).toEqual([linha]);
    expect(ultima()).toMatchObject({ url: rota, metodo: 'GET' });
    expect(await uma(ID)).toEqual(linha);
  });

  it.each([
    ['contas', buscarConta, CONTA],
    ['formas', buscarForma, FORMA],
    ['categorias', buscarCategoria, CATEGORIA],
  ] as const)('%s: id ausente da lista ou malformado vale como registro_invalido (CA-T1.2)', async (_n, uma, linha) => {
    fetchSimulado.mockImplementation(async () => json([linha]));

    await expect(uma(OUTRO)).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    fetchSimulado.mockClear();
    await expect(uma('abc')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('a lista confere cada item com o contrato (fora do contrato falha em desenvolvimento e teste)', async () => {
    fetchSimulado.mockResolvedValue(json([{ ...CONTA, lar_id: 'vazou' }]));

    await expect(buscarContas()).rejects.toThrow();
  });

  it('resposta que não é lista também falha', async () => {
    fetchSimulado.mockResolvedValue(json({ id: ID }));

    await expect(buscarContas()).rejects.toThrow('resposta_fora_do_contrato');
  });

  it('401 vira erro de autenticação', async () => {
    fetchSimulado.mockResolvedValue(json({ code: 'sessao_expirada', message: 'x' }, 401));

    await expect(buscarContas()).rejects.toEqual({ tipo: 'autenticacao' });
  });

  it('sem rede vira erro de rede', async () => {
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(buscarFormas()).rejects.toEqual({ tipo: 'rede' });
  });
});
