import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lerResposta } from '../../test/apoio/fetchSimulado';
import { alterarDataParcela, editarLancamento, excluirLancamento } from './comandos/lancamentos';
import { lancarDespesa } from './comandos/lancarDespesa';
import { lancarReceita } from './comandos/lancarReceita';
import { buscarDadosLancamento, lerDadosDoAparelho } from './consultas/dadosLancamento';
import { buscarLancamento } from './consultas/lancamento';
import { buscarLancamentosMes } from './consultas/lancamentosMes';
import { buscarResumoMes } from './consultas/resumoMes';
import { encerrarNoAparelho, obterSessao } from './sessao';

/**
 * Camada de dados dos lançamentos sobre `fetch('/api/…')` (SDD 6.1 #4, #20 a #26 e #33). A resposta é conferida
 * com o contrato Zod pelo transporte; aqui se confere a rota, o método, o corpo e o tratamento de erro.
 */

const ID = '00000000-0000-4000-8000-000000000520';
const PARCELA = '00000000-0000-4000-8000-000000000621';
const USUARIO = '00000000-0000-4000-8000-0000000000a1';
const CATEGORIA = '00000000-0000-4000-8000-000000000401';
const FORMA = '00000000-0000-4000-8000-000000000303';
const CONTA = '00000000-0000-4000-8000-000000000201';
const GRAVADO = lerResposta<Record<string, unknown>>('lancar-despesa-credito.json');

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

const SESSAO = {
  usuario: { id: USUARIO, nome: 'Ana', email: 'ana@exemplo.com' },
  membro: { id: USUARIO, nome: 'Ana', papel: 'titular' },
  lar: { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Casa' },
  plano: null,
  termos_pendentes: false,
};

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  fetchSimulado.mockReset();
  vi.stubGlobal('fetch', fetchSimulado);
  await encerrarNoAparelho();
});
afterEach(() => vi.unstubAllGlobals());

describe('lançar despesa e receita (POST, idempotente pelo id do cliente)', () => {
  it('despesa: POST /api/lancamentos/despesas com o corpo e o cabeçalho CSRF', async () => {
    fetchSimulado.mockImplementation(() => resposta(201, GRAVADO));
    const args = { id: ID, valor_centavos: 36000, categoria_id: CATEGORIA, forma_id: FORMA, parcelas: 3 };

    await expect(lancarDespesa(args)).resolves.toEqual(GRAVADO);

    expect(ultima()).toMatchObject({ url: '/api/lancamentos/despesas', metodo: 'POST', corpo: args });
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBe('1');
  });

  it('receita: POST /api/lancamentos/receitas; o reenvio devolve ja_existia sem erro', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, { ...GRAVADO, escopo: 'individual', ja_existia: true }));
    const corpo = { id: ID, valor_centavos: 750000, categoria_id: CATEGORIA, conta_id: CONTA, data: '2026-10-09' };

    const gravado = await lancarReceita(corpo);

    expect(gravado.ja_existia).toBe(true);
    expect(ultima()).toMatchObject({ url: '/api/lancamentos/receitas', metodo: 'POST', corpo });
  });

  it('código de regra da API vira ErroDados (categoria_arquivada)', async () => {
    fetchSimulado.mockImplementation(() => resposta(409, { code: 'categoria_arquivada', message: 'x' }));

    await expect(
      lancarDespesa({ id: ID, valor_centavos: 100, categoria_id: CATEGORIA, forma_id: FORMA }),
    ).rejects.toEqual({ tipo: 'regra', codigo: 'categoria_arquivada' });
  });
});

describe('lista do mês (GET /api/lancamentos)', () => {
  it('manda o mês no dia 1 e só os filtros dados; variavel como texto', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, lerResposta('lancamentos-mes.json')));

    await buscarLancamentosMes({ mes: '2026-10', escopo: 'conjunto', categoriaId: CATEGORIA, variavel: true });

    expect(ultima().url).toBe(
      `/api/lancamentos?mes=2026-10-01&escopo=conjunto&categoria_id=${CATEGORIA}&variavel=true`,
    );
    expect(ultima().metodo).toBe('GET');
    expect(ultima().cabecalhos['X-Controle-Em-Casa']).toBeUndefined();
  });

  it('mês sem lançamento: lista vazia com total 0', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, lerResposta('lancamentos-mes-vazio.json')));

    const lista = await buscarLancamentosMes({ mes: '2026-09' });

    expect(lista).toMatchObject({ quantidade: 0, total_filtrado_centavos: 0, itens: [] });
  });

  it('resposta fora do contrato é recusada (o contrato é o mesmo da API)', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, { mes: '2026-10-01', itens: 'x' }));

    await expect(buscarLancamentosMes({ mes: '2026-10' })).rejects.toBeDefined();
  });
});

describe('detalhe (GET /api/lancamentos/:id)', () => {
  it('pagador: devolve pagamento e data_ajustada', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, lerResposta('lancamento-pagador.json')));

    const detalhe = await buscarLancamento(ID);

    expect(ultima().url).toBe(`/api/lancamentos/${ID}`);
    expect('pagamento' in detalhe).toBe(true);
  });

  it('outro membro: as chaves privadas continuam ausentes (RN-04), sem inventar null', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, lerResposta('lancamento-outro-membro.json')));

    const detalhe = await buscarLancamento(ID);

    expect('pagamento' in detalhe).toBe(false);
    expect(detalhe.parcelas.every((p) => !('data_ajustada' in p))).toBe(true);
  });

  it('resposta com chave privada para o outro membro (vazamento) não passa pelo contrato', async () => {
    const vazou = { ...lerResposta<Record<string, unknown>>('lancamento-outro-membro.json'), pagamento: null };
    fetchSimulado.mockImplementation(() => resposta(200, vazou));

    await expect(buscarLancamento(ID)).rejects.toBeDefined();
  });

  it('id malformado vale registro_invalido, sem chamar a rede', async () => {
    await expect(buscarLancamento('x')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('inexistente ou de outro lar: registro_invalido', async () => {
    fetchSimulado.mockImplementation(() => resposta(404, { code: 'registro_invalido', message: 'x' }));

    await expect(buscarLancamento(ID)).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
  });
});

describe('editar, excluir e alterar a data da parcela', () => {
  const EDITADO = { id: ID, escopo: 'conjunto', num_parcelas: 3, alterado_em: '2026-10-12T15:00:00Z' };

  it('editar manda só os campos recebidos, em snake_case, e confirmar_descarte', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, EDITADO));

    await editarLancamento({ id: ID, campos: { valorTotalCentavos: 200000, formaId: FORMA, numParcelas: 4 } });

    expect(ultima()).toMatchObject({
      url: `/api/lancamentos/${ID}`,
      metodo: 'PATCH',
      corpo: { valor_total_centavos: 200000, forma_id: FORMA, num_parcelas: 4, confirmar_descarte: false },
    });
  });

  it('descrição vazia é enviada (limpa a descrição, RN-06); campo não tocado fica de fora', async () => {
    fetchSimulado.mockImplementation(() => resposta(200, EDITADO));

    await editarLancamento({ id: ID, campos: { descricao: '' }, confirmarDescarte: true });

    expect(ultima().corpo).toEqual({ descricao: '', confirmar_descarte: true });
  });

  it('editar: 409 confirmar_descarte_ajustes é reconhecido pela tela', async () => {
    const { ehConfirmarDescarte } = await import('./comandos/lancamentos');
    fetchSimulado.mockImplementation(() => resposta(409, { code: 'confirmar_descarte_ajustes', message: 'x' }));

    const erro = await editarLancamento({ id: ID, campos: { valorTotalCentavos: 1 } }).catch((e: unknown) => e);

    expect(ehConfirmarDescarte(erro as never)).toBe(true);
  });

  it('editar: 403 sem_permissao (outro membro mexendo em forma, data ou parcelas)', async () => {
    fetchSimulado.mockImplementation(() => resposta(403, { code: 'sem_permissao', message: 'x' }));

    await expect(editarLancamento({ id: ID, campos: { numParcelas: 2 } })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'sem_permissao',
    });
  });

  it('excluir: DELETE /api/lancamentos/:id (204)', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));

    await expect(excluirLancamento(ID)).resolves.toBeUndefined();

    expect(ultima()).toMatchObject({ url: `/api/lancamentos/${ID}`, metodo: 'DELETE' });
  });

  it('excluir e alterar a data com id malformado: registro_invalido, sem rede', async () => {
    await expect(excluirLancamento('x')).rejects.toEqual({ tipo: 'regra', codigo: 'registro_invalido' });
    await expect(alterarDataParcela({ parcelaId: 'x', data: '2026-11-05' })).rejects.toEqual({
      tipo: 'regra',
      codigo: 'registro_invalido',
    });
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('alterar a data da parcela: PATCH /api/parcelas/:id com só a data', async () => {
    fetchSimulado.mockImplementation(() => resposta(204));

    await alterarDataParcela({ parcelaId: PARCELA, data: '2026-11-05' });

    expect(ultima()).toMatchObject({ url: `/api/parcelas/${PARCELA}`, metodo: 'PATCH', corpo: { data: '2026-11-05' } });
  });
});

describe('resumo do mês (GET /api/resumo)', () => {
  it('pede o mês no dia 1 e devolve o resumo como veio (total, cartão, pendentes)', async () => {
    const resumo = lerResposta<{ individual: { credito: unknown[] } }>('resumo-mes.json');
    fetchSimulado.mockImplementation(() => resposta(200, resumo));

    const lido = await buscarResumoMes('2026-10');

    expect(ultima().url).toBe('/api/resumo?mes=2026-10-01');
    expect(lido).toEqual(resumo);
  });
});

describe('dados do lançamento (GET /api/lancamentos/dados) e o cache do aparelho', () => {
  const DADOS = lerResposta('dados-lancamento.json');

  async function sessaoLembrada() {
    fetchSimulado.mockImplementationOnce(() => resposta(200, SESSAO));
    await obterSessao();
  }

  it('com rede devolve a resposta do servidor e a guarda no aparelho para o usuário da sessão', async () => {
    await sessaoLembrada();
    fetchSimulado.mockImplementation(() => resposta(200, DADOS));

    const lidos = await buscarDadosLancamento();

    expect(ultima().url).toBe('/api/lancamentos/dados');
    expect(lidos).toMatchObject({ dados: DADOS, doAparelho: false });
    await expect(lerDadosDoAparelho()).resolves.toMatchObject({ dados: DADOS, doAparelho: true });
  });

  it('sem rede cai no cache do aparelho', async () => {
    await sessaoLembrada();
    fetchSimulado.mockImplementationOnce(() => resposta(200, DADOS));
    await buscarDadosLancamento();
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));

    const lidos = await buscarDadosLancamento();

    expect(lidos).toMatchObject({ dados: DADOS, doAparelho: true });
  });

  it('sem rede e sem cache o erro de rede sobe', async () => {
    await sessaoLembrada();
    fetchSimulado.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(buscarDadosLancamento()).rejects.toEqual({ tipo: 'rede' });
  });

  it('erro de regra sobe sem tocar no cache', async () => {
    await sessaoLembrada();
    fetchSimulado.mockImplementationOnce(() => resposta(200, DADOS));
    await buscarDadosLancamento();
    fetchSimulado.mockImplementation(() => resposta(409, { code: 'sem_lar', message: 'x' }));

    await expect(buscarDadosLancamento()).rejects.toEqual({ tipo: 'regra', codigo: 'sem_lar' });
    await expect(lerDadosDoAparelho()).resolves.toMatchObject({ dados: DADOS });
  });

  it('o cache é de um usuário só: com outro usuário lembrado nada é entregue (e o registro some)', async () => {
    await sessaoLembrada();
    fetchSimulado.mockImplementationOnce(() => resposta(200, DADOS));
    await buscarDadosLancamento();
    fetchSimulado.mockImplementationOnce(() =>
      resposta(200, { ...SESSAO, usuario: { ...SESSAO.usuario, id: '00000000-0000-4000-8000-0000000000b2' } }),
    );
    await obterSessao();

    await expect(lerDadosDoAparelho()).resolves.toBeUndefined();
  });

  it('sair do aparelho apaga o cache (G-39)', async () => {
    await sessaoLembrada();
    fetchSimulado.mockImplementationOnce(() => resposta(200, DADOS));
    await buscarDadosLancamento();
    fetchSimulado.mockImplementationOnce(() => resposta(200, SESSAO));
    await obterSessao();

    await encerrarNoAparelho();
    fetchSimulado.mockImplementationOnce(() => resposta(200, SESSAO));
    await obterSessao();

    await expect(lerDadosDoAparelho()).resolves.toBeUndefined();
  });
});
