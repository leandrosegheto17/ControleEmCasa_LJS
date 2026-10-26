import { readFileSync } from 'node:fs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { SaidaDadosLancamento as DadosLancamento } from '@controle/contrato';
import { FolhaLancar } from './FolhaLancar';

const lerResposta = <T,>(nome: string): T =>
  JSON.parse(readFileSync(new URL(`../../../test/fixtures/respostas/${nome}`, import.meta.url), 'utf8'));

const DADOS = lerResposta<DadosLancamento>('dados-lancamento.json');
const NUBANK = '00000000-0000-4000-8000-000000000201';
const SALARIO = '00000000-0000-4000-8000-000000000421';

const TEXTO_SEM_CONEXAO = 'Sem conexão. A receita não foi salva';
const TEXTO_NOTA = 'Sem conexão, a receita não é guardada no aparelho: o app avisa e mantém os dados preenchidos.';

type Resultado = { tipo: 'sucesso' | 'sem_conexao' | 'regra' | 'guardado'; [k: string]: unknown };

function renderizar(
  dados: DadosLancamento = DADOS,
  aoLancar = vi.fn<(campos: unknown) => Promise<Resultado>>().mockResolvedValue({ tipo: 'sucesso' }),
) {
  const usuario = userEvent.setup();
  render(
    <MemoryRouter>
      <FolhaLancar aberta dados={dados} aoFechar={vi.fn()} aoLancar={aoLancar} />
    </MemoryRouter>,
  );
  return { usuario, aoLancar };
}

async function marcarReceita(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole('radio', { name: 'Receita' }));
}

async function preencherReceita(usuario: ReturnType<typeof userEvent.setup>) {
  await marcarReceita(usuario);
  await usuario.click(screen.getByLabelText('Valor'));
  await usuario.keyboard('750000');
  await usuario.click(screen.getByRole('radio', { name: /Salário/ }));
}

const botaoConta = (conta: string) =>
  screen.getByRole('button', { name: new RegExp(`^Conta de destino\\s+${conta}$`) });

describe('FolhaLancar no modo receita', () => {
  it('Receita está habilitada no segmentado', () => {
    renderizar();
    expect(screen.getByRole('radio', { name: 'Receita' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'Despesa' })).toBeChecked();
  });

  it('ao marcar Receita, o título oculto passa a "Lançar receita"', async () => {
    const { usuario } = renderizar();
    await marcarReceita(usuario);
    expect(screen.getByRole('dialog', { name: 'Lançar receita' })).toBeInTheDocument();
  });

  it('mostra "Categoria de receita" com Salário, Extra e Outros e sem "Outras…"', async () => {
    const { usuario } = renderizar();
    await marcarReceita(usuario);

    const grupo = screen.getByRole('radiogroup', { name: 'Categoria de receita' });
    const nomes = Array.from(grupo.querySelectorAll('[class*="chip-nome"]')).map((n) => n.textContent);
    expect(nomes).toEqual(['Salário', 'Extra', 'Outros']);
    expect(screen.queryByRole('button', { name: 'Outras…' })).toBeNull();
    expect(screen.queryByRole('radio', { name: /Mercado/ })).toBeNull();
  });

  it('"Conta de destino" mostra a conta de conta_receita_padrao_id', async () => {
    const { usuario } = renderizar();
    await marcarReceita(usuario);

    expect(botaoConta('Nubank')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Forma de pagamento/ })).toBeNull();
  });

  it('não mostra parcelas e mostra "Mais detalhes" e a nota do mockup', async () => {
    const { usuario } = renderizar();
    await marcarReceita(usuario);

    expect(screen.queryByText('Parcelas')).toBeNull();
    expect(screen.getByText(/Mais detalhes/)).toBeInTheDocument();
    expect(screen.getByText(TEXTO_NOTA)).toBeInTheDocument();
  });

  it('botão "Lançar receita R$ 7.500,00" com o valor preenchido', async () => {
    const { usuario } = renderizar();
    await preencherReceita(usuario);

    expect(screen.getByRole('button', { name: /^Lançar receita R\$\s7\.500,00$/ })).toBeInTheDocument();
  });

  it('envia o tipo receita com valor, categoria e conta', async () => {
    const { usuario, aoLancar } = renderizar();
    await preencherReceita(usuario);

    await usuario.click(screen.getByRole('button', { name: /^Lançar receita/ }));

    await waitFor(() => expect(aoLancar).toHaveBeenCalledTimes(1));
    expect(aoLancar.mock.calls[0][0]).toMatchObject({
      tipo: 'receita',
      valorCentavos: 750000,
      categoriaId: SALARIO,
      contaId: NUBANK,
    });
  });

  it('sem categoria: "Escolha uma categoria." e nada é enviado', async () => {
    const { usuario, aoLancar } = renderizar();
    await marcarReceita(usuario);
    await usuario.click(screen.getByLabelText('Valor'));
    await usuario.keyboard('750000');

    await usuario.click(screen.getByRole('button', { name: /^Lançar receita/ }));

    expect(await screen.findByText('Escolha uma categoria.')).toBeInTheDocument();
    expect(aoLancar).not.toHaveBeenCalled();
  });

  it('sem conexão: AvisoErroTopo com o texto exato e valor, categoria e conta mantidos', async () => {
    const aoLancar = vi.fn<(campos: unknown) => Promise<Resultado>>().mockResolvedValue({ tipo: 'sem_conexao' });
    const { usuario } = renderizar(DADOS, aoLancar);
    await preencherReceita(usuario);

    await usuario.click(screen.getByRole('button', { name: /^Lançar receita/ }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(TEXTO_SEM_CONEXAO);
    expect(screen.getByLabelText('Valor')).toHaveDisplayValue(/7\.500,00/);
    expect(screen.getByRole('radio', { name: /Salário/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Receita' })).toBeChecked();
    expect(botaoConta('Nubank')).toBeInTheDocument();
  });

  it('sucesso: limpa valor e categoria, mantém receita e conta, foco no valor', async () => {
    const { usuario } = renderizar();
    await preencherReceita(usuario);

    await usuario.click(screen.getByRole('button', { name: /^Lançar receita/ }));

    await waitFor(() => expect(screen.getByRole('radio', { name: /Salário/ })).not.toBeChecked());
    expect(screen.getByLabelText('Valor')).toHaveDisplayValue(/0,00/);
    expect(screen.getByRole('radio', { name: 'Receita' })).toBeChecked();
    expect(botaoConta('Nubank')).toBeInTheDocument();
    expect(document.activeElement).toBe(document.getElementById('valor'));
  });

  it('voltar a Despesa mostra a grade de despesa e tira a conta de destino', async () => {
    const { usuario } = renderizar();
    await marcarReceita(usuario);

    await usuario.click(screen.getByRole('radio', { name: 'Despesa' }));

    expect(screen.getByRole('radiogroup', { name: 'Categoria' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Mercado/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outras…' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Conta de destino/ })).toBeNull();
    expect(screen.queryByText(TEXTO_NOTA)).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Lançar' })).toBeInTheDocument();
  });

  it('conta_receita_padrao_id nulo: mostra a 1ª conta da lista do servidor', async () => {
    const contas = [...DADOS.contas].reverse();
    const { usuario } = renderizar({ ...DADOS, contas, conta_receita_padrao_id: null } as DadosLancamento);
    await marcarReceita(usuario);

    expect(botaoConta('Itaú')).toBeInTheDocument();
  });

  it('sem contas: na receita mostra o vazio "Cadastre uma conta para lançar receita" com "Cadastrar conta"', async () => {
    const { usuario } = renderizar({ ...DADOS, contas: [], conta_receita_padrao_id: null } as DadosLancamento);
    await marcarReceita(usuario);

    expect(screen.getByText('Cadastre uma conta para lançar receita')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cadastrar conta' })).toHaveAttribute('href', '/app/ajustes/contas/nova');
    expect(screen.queryByRole('button', { name: /^Lançar receita/ })).toBeNull();
  });

  it('sem contas: a despesa continua normal', () => {
    renderizar({ ...DADOS, contas: [], conta_receita_padrao_id: null } as DadosLancamento);

    expect(screen.queryByText('Cadastre uma conta para lançar receita')).toBeNull();
    expect(screen.getByRole('radiogroup', { name: 'Categoria' })).toBeInTheDocument();
  });
});
