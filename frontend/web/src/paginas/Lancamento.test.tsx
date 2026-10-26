import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAparelho, montarApp, preAquecerPaginas } from '../../test/apoio/apiCadastros';
import {
  chamadasA,
  criarServidorLancamentos,
  detalheDoPagador,
  ID_LANCAMENTO_DO_OUTRO,
  ID_LANCAMENTO_PAGADOR,
  ID_PARCELA_1,
  ID_PARCELA_AJUSTADA,
  instalarApiLancamentos,
  type ServidorLancamentos,
} from '../../test/apoio/apiLancamentos';

/**
 * Detalhe do lançamento (etapa 12, lote 2): editar com recálculo e `confirmar_descarte`, excluir, alterar a data da
 * parcela, e o outro membro sem as chaves privadas. Critérios: RN-04, RN-06, RN-07, RN-14, CA-06.1 a CA-06.7, G-11.
 */

let servidor: ServidorLancamentos;

beforeAll(preAquecerPaginas, 30_000);

beforeEach(async () => {
  servidor = criarServidorLancamentos();
  instalarApiLancamentos(servidor);
  await limparAparelho();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T15:00:00-03:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const DETALHE = `/app/lancamentos/${ID_LANCAMENTO_PAGADOR}`;
const DETALHE_DO_OUTRO = `/app/lancamentos/${ID_LANCAMENTO_DO_OUTRO}`;
const patchs = () => chamadasA(servidor, 'PATCH', '/api/lancamentos/');
const corpoDoPatch = () => patchs().at(-1)!.corpo;

/** O erro do formulário (`AvisoErroTopo`) é o `alert` dentro da página; a região de avisos tem o seu próprio. */
const erroNoTopo = () => document.querySelector('main [role="alert"]');

async function esperarDetalhe() {
  await screen.findByRole('region', { name: 'Resumo' });
}

describe('Lançamento: o pagador vê tudo (CA-04.1)', () => {
  it('resumo da parcela em foco, campos da compra, forma e parcelas com o ajuste manual marcado', async () => {
    montarApp(DETALHE);

    const resumo = await screen.findByRole('region', { name: 'Resumo' });
    expect(resumo).toHaveTextContent('Geladeira nova (2/3)');
    expect(resumo).toHaveTextContent('R$ 650,00');
    expect(resumo).toHaveTextContent('Pago por você');
    expect(screen.getByLabelText('Valor total da compra')).toHaveValue('R$ 1.950,00');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Geladeira nova');
    expect(screen.getByLabelText('Data da compra')).toHaveValue('2026-08-20');
    expect(screen.getByRole('combobox', { name: 'Parcelas' })).toHaveValue('3');
    expect(screen.getByRole('button', { name: /Forma de pagamento.*Cartão de crédito XP/ })).toBeInTheDocument();
    const parcelas = screen.getByRole('region', { name: 'Parcelas' });
    expect(within(parcelas).getAllByRole('button', { name: /Alterar data da parcela/ })).toHaveLength(3);
    expect(within(parcelas).getByText('data ajustada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
  });

  it('o título da página e o voltar levam à lista de lançamentos', async () => {
    montarApp(DETALHE);
    await esperarDetalhe();

    expect(screen.getByRole('link', { name: 'Voltar para Lançamentos' })).toHaveAttribute('href', '/app/lancamentos');
    expect(document.title).toBe('Lançamento · Controle em Casa');
  });

  it('abrir pela lista com filtros devolve a essa mesma lista (mês e filtros)', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp('/app/lancamentos?mes=2026-10&escopo=eu');
    await usuario.click(await screen.findByRole('link', { name: /Fone bluetooth/ }));
    await esperarDetalhe().catch(() => undefined);

    const voltar = (await screen.findAllByRole('link', { name: 'Voltar para Lançamentos' }))[0]!;

    expect(voltar).toHaveAttribute('href', '/app/lancamentos?mes=2026-10&escopo=eu');
    expect(local()).toMatch(/^\/app\/lancamentos\/[0-9a-f-]{36}$/);
  });
});

describe('Lançamento: o outro membro não recebe as chaves privadas (RN-04, G-11)', () => {
  it('a tela abre sem quebrar com `pagamento` e `data_ajustada` ausentes, sem data, forma nem parcelas', async () => {
    montarApp(DETALHE_DO_OUTRO);

    const resumo = await screen.findByRole('region', { name: 'Resumo' });
    expect(resumo).toHaveTextContent('Geladeira nova (2/3)');
    expect(resumo).toHaveTextContent('Pago por Leandro');
    expect(resumo).toHaveTextContent('Alterado por último por você');
    expect(screen.queryByLabelText('Data da compra')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Parcelas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Forma de pagamento/ })).not.toBeInTheDocument();
    expect(screen.getByText('Forma de pagamento e parcelas: só quem pagou pode alterar.')).toBeInTheDocument();
    const parcelas = screen.getByRole('region', { name: 'Parcelas' });
    expect(within(parcelas).queryByRole('button', { name: /Alterar data/ })).not.toBeInTheDocument();
    expect(within(parcelas).getAllByRole('listitem')).toHaveLength(3);
  });

  it('só a categoria conjunta é oferecida; a individual do outro nem aparece (RN-01)', async () => {
    montarApp(DETALHE_DO_OUTRO);
    await esperarDetalhe();

    const opcoes = within(screen.getByLabelText('Categoria')).getAllByRole('option');

    expect(opcoes.every((o) => /· Casa$/.test(o.textContent ?? ''))).toBe(true);
  });

  it('edita descrição e valor: o PATCH não leva data, forma nem parcelas', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE_DO_OUTRO);
    await esperarDetalhe();

    await usuario.clear(screen.getByLabelText('Descrição'));
    await usuario.type(screen.getByLabelText('Descrição'), 'Geladeira inox');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(patchs()).toHaveLength(1));
    expect(patchs()[0]!.url).toBe(`/api/lancamentos/${ID_LANCAMENTO_DO_OUTRO}`);
    expect(corpoDoPatch()).toEqual({ descricao: 'Geladeira inox', confirmar_descarte: false });
    expect(await screen.findByText('Alterações salvas')).toBeInTheDocument();
  });

  it('se o servidor recusar (sem_permissao), o erro aparece no topo e a tela continua', async () => {
    servidor.falhas.set('PATCH /api/lancamentos/:id', { status: 403, code: 'sem_permissao' });
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE_DO_OUTRO);
    await esperarDetalhe();

    await usuario.type(screen.getByLabelText('Descrição'), '!');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(erroNoTopo()).not.toBeNull());
    expect(erroNoTopo()).toHaveTextContent('Você não tem permissão para alterar este item');
    expect(local()).toBe(DETALHE_DO_OUTRO);
  });

  it('o outro membro também pode excluir a despesa conjunta', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE_DO_OUTRO);
    await esperarDetalhe();

    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(local()).toBe('/app/lancamentos'));
    expect(servidor.detalhes.has(ID_LANCAMENTO_DO_OUTRO)).toBe(false);
  });
});

describe('Lançamento: editar (pagador)', () => {
  it('sem mudança, "Salvar alterações" volta à lista sem chamar a API', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE);
    await esperarDetalhe();

    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(local()).toBe('/app/lancamentos'));
    expect(patchs()).toHaveLength(0);
  });

  it('só a descrição: PATCH com só ela, aviso e volta à lista (sem pedir descarte)', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE);
    await esperarDetalhe();

    await usuario.clear(screen.getByLabelText('Descrição'));
    await usuario.type(screen.getByLabelText('Descrição'), 'Geladeira inox');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(local()).toBe('/app/lancamentos'));
    expect(corpoDoPatch()).toEqual({ descricao: 'Geladeira inox', confirmar_descarte: false });
    expect(await screen.findByText('Alterações salvas')).toBeInTheDocument();
  });

  it('limpar a descrição envia texto vazio (RN-06)', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();

    await usuario.clear(screen.getByLabelText('Descrição'));
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(patchs()).toHaveLength(1));
    expect(corpoDoPatch()).toEqual({ descricao: '', confirmar_descarte: false });
  });

  it('mudar o valor com parcela ajustada à mão: o servidor pede confirmação e o diálogo cita a parcela (CA-06.4)', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE);
    await esperarDetalhe();

    const valor = screen.getByLabelText('Valor total da compra');
    await usuario.clear(valor);
    await usuario.type(valor, '200000');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText('Descartar ajuste de data?')).toBeInTheDocument();
    expect(dialogo).toHaveTextContent('A parcela 3/3 teve a data ajustada à mão (17/11)');
    expect(corpoDoPatch()).toEqual({ valor_total_centavos: 200000, confirmar_descarte: false });
    expect(local()).toBe(DETALHE);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Recalcular e salvar' }));

    await waitFor(() => expect(local()).toBe('/app/lancamentos'));
    expect(patchs()).toHaveLength(2);
    expect(corpoDoPatch()).toEqual({ valor_total_centavos: 200000, confirmar_descarte: true });
  });

  it('cancelar o descarte não reenvia nem sai da tela', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE);
    await esperarDetalhe();
    const valor = screen.getByLabelText('Valor total da compra');
    await usuario.clear(valor);
    await usuario.type(valor, '200000');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(patchs()).toHaveLength(1);
    expect(local()).toBe(DETALHE);
  });

  it('sem ajuste manual, mudar o valor recalcula direto, sem pedir confirmação', async () => {
    const detalhe = detalheDoPagador();
    for (const p of detalhe.parcelas) p.data_ajustada = false;
    servidor.detalhes.set(ID_LANCAMENTO_PAGADOR, detalhe);
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE);
    await esperarDetalhe();
    const valor = screen.getByLabelText('Valor total da compra');
    await usuario.clear(valor);
    await usuario.type(valor, '300000');

    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(local()).toBe('/app/lancamentos'));
    expect(patchs()).toHaveLength(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('trocar o número de parcelas no crédito manda num_parcelas (e passa pelo descarte)', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Parcelas' }), '6');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(corpoDoPatch()).toEqual({ num_parcelas: 6, confirmar_descarte: false });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Recalcular e salvar' }));
    await waitFor(() => expect(corpoDoPatch()).toEqual({ num_parcelas: 6, confirmar_descarte: true }));
  });

  it('erro de rede ao salvar aparece no topo e os dados digitados ficam', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();
    await usuario.type(screen.getByLabelText('Descrição'), '!');
    servidor.semRede = true;

    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(erroNoTopo()).not.toBeNull());
    expect(erroNoTopo()).toHaveTextContent('Sem conexão. Tente de novo');
    expect(screen.getByLabelText('Descrição')).toHaveValue('Geladeira nova!');
  });
});

describe('Lançamento: alterar a data da parcela (só o pagador, só no crédito; CA-06.7)', () => {
  async function alterarData(usuario: ReturnType<typeof userEvent.setup>, parcela: string, data: string) {
    await usuario.click(screen.getByRole('button', { name: `Alterar data da parcela ${parcela}` }));
    const campo = screen.getByLabelText(`Nova data da parcela ${parcela}`);
    fireEvent.change(campo, { target: { value: data } });
    await usuario.keyboard('{Enter}');
  }

  it('escolher a nova data manda PATCH /api/parcelas/:id só com a data, avisa e marca a parcela como ajustada', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();

    await alterarData(usuario, '1 de 3', '2026-09-15');

    await waitFor(() => expect(chamadasA(servidor, 'PATCH', '/api/parcelas/')).toHaveLength(1));
    const chamada = chamadasA(servidor, 'PATCH', '/api/parcelas/')[0]!;
    expect(chamada.url).toBe(`/api/parcelas/${ID_PARCELA_1}`);
    expect(chamada.corpo).toEqual({ data: '2026-09-15' });
    expect(await screen.findByText('Data da parcela alterada')).toBeInTheDocument();
    const parcelas = screen.getByRole('region', { name: 'Parcelas' });
    await waitFor(() => expect(within(parcelas).getAllByText('data ajustada')).toHaveLength(2));
    expect(within(parcelas).getByText('15/09/2026')).toBeInTheDocument();
  });

  it('a mesma data ou data vazia não chama a API', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();

    await alterarData(usuario, '1 de 3', '2026-09-10');

    expect(chamadasA(servidor, 'PATCH', '/api/parcelas/')).toHaveLength(0);
  });

  it('o servidor recusar (sem_permissao) mostra o erro e não marca ajuste', async () => {
    servidor.falhas.set('PATCH /api/parcelas/:id', { status: 403, code: 'sem_permissao' });
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();

    await alterarData(usuario, '2 de 3', '2026-10-20');

    await waitFor(() => expect(erroNoTopo()).not.toBeNull());
    expect(erroNoTopo()).toHaveTextContent('Você não tem permissão para alterar este item');
    expect(within(screen.getByRole('region', { name: 'Parcelas' })).getAllByText('data ajustada')).toHaveLength(1);
  });

  it('forma que não é crédito: as parcelas aparecem, mas sem "Alterar data"', async () => {
    const detalhe = detalheDoPagador();
    detalhe.pagamento = { ...detalhe.pagamento, forma: { id: detalhe.pagamento.forma!.id, nome: 'Pix', tipo: 'pix' } };
    servidor.detalhes.set(ID_LANCAMENTO_PAGADOR, detalhe);
    montarApp(DETALHE);
    await esperarDetalhe();

    const parcelas = screen.getByRole('region', { name: 'Parcelas' });

    expect(within(parcelas).queryByRole('button', { name: /Alterar data/ })).not.toBeInTheDocument();
    expect(within(parcelas).getAllByRole('listitem')).toHaveLength(3);
  });

  it('o servidor, não a tela, decide: a parcela 3/3 já ajustada aceita nova data no crédito', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();

    await alterarData(usuario, '3 de 3', '2026-11-20');

    await waitFor(() =>
      expect(chamadasA(servidor, 'PATCH', '/api/parcelas/')[0]!.url).toBe(`/api/parcelas/${ID_PARCELA_AJUSTADA}`),
    );
  });
});

describe('Lançamento: excluir', () => {
  it('o botão só abre o diálogo; cancelar não chama a API', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();

    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));
    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByText('Excluir esta compra e as 3 parcelas?')).toBeInTheDocument();
    expect(dialogo).toHaveTextContent(
      'Geladeira nova, R$ 1.950,00 em 3x. A exclusão vale para os dois e não pode ser desfeita.',
    );
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));

    expect(chamadasA(servidor, 'DELETE', '/api/')).toHaveLength(0);
  });

  it('confirmar manda DELETE uma vez, avisa "Excluído" e volta à lista', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE);
    await esperarDetalhe();

    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));
    await usuario.dblClick(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(local()).toBe('/app/lancamentos'));
    expect(chamadasA(servidor, 'DELETE', `/api/lancamentos/${ID_LANCAMENTO_PAGADOR}`)).toHaveLength(1);
    expect(await screen.findByText('Excluído')).toBeInTheDocument();
  });

  it('já excluído pelo outro: a tela troca para "Este lançamento não existe mais"', async () => {
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();
    servidor.detalhes.delete(ID_LANCAMENTO_PAGADOR);

    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findByText('Este lançamento não existe mais')).toBeInTheDocument();
  });

  it('sem rede: o erro aparece, o diálogo fecha e a tela continua', async () => {
    const usuario = userEvent.setup();
    const { local } = montarApp(DETALHE);
    await esperarDetalhe();
    servidor.semRede = true;

    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));
    await usuario.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(erroNoTopo()).not.toBeNull());
    expect(erroNoTopo()).toHaveTextContent('Sem conexão. Tente de novo');
    expect(local()).toBe(DETALHE);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('Lançamento: carregando, inexistente e erro', () => {
  it('id que não existe (ou é de outro lar) mostra "não existe mais" com o caminho de volta', async () => {
    montarApp('/app/lancamentos/00000000-0000-4000-8000-0000000009ff');

    expect(await screen.findByText('Este lançamento não existe mais')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Voltar para Lançamentos' }).length).toBeGreaterThan(0);
  });

  it('id malformado na URL também vale "não existe mais", sem chamar a API do detalhe', async () => {
    montarApp('/app/lancamentos/abc');

    expect(await screen.findByText('Este lançamento não existe mais')).toBeInTheDocument();
    expect(chamadasA(servidor, 'GET', '/api/lancamentos/abc')).toHaveLength(0);
  });

  it('erro do servidor: "Tentar de novo" lê outra vez', async () => {
    servidor.falhas.set('GET /api/lancamentos/:id', { status: 503, code: 'indisponivel' });
    const usuario = userEvent.setup();
    montarApp(DETALHE);

    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' });
    servidor.falhas.clear();
    await usuario.click(tentar);

    expect(await screen.findByRole('region', { name: 'Resumo' })).toBeInTheDocument();
  });

  it('receita: o diálogo de exclusão fala de receita e a forma não aparece', async () => {
    const detalhe = detalheDoPagador();
    servidor.detalhes.set(ID_LANCAMENTO_PAGADOR, {
      ...detalhe,
      tipo: 'receita',
      escopo: 'individual',
      num_parcelas: 1,
      parcelas: [{ ...detalhe.parcelas[0]!, data_ajustada: false }],
      pagamento: {
        forma: null,
        conta: { id: '00000000-0000-4000-8000-000000000201', nome: 'Nubank' },
        data_operacao: '2026-10-05',
        dia_vencimento_aplicado: null,
      },
    });
    const usuario = userEvent.setup();
    montarApp(DETALHE);
    await esperarDetalhe();

    expect(screen.queryByRole('button', { name: /Forma de pagamento/ })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(within(await screen.findByRole('alertdialog')).getByText('Excluir esta receita?')).toBeInTheDocument();
  });
});
