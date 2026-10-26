import { expect, test } from '@playwright/test';
import { fixarRelogio, ID_LANCAMENTO, ID_PARCELA_1, simularApi } from './apoio/apiLancamentos';

/**
 * e2e de Lançamentos e Lançamento (etapa 12, lote 2): lista do mês com filtros pela URL, detalhe, edição, alteração da
 * data da parcela e exclusão, contra a API simulada por `page.route`.
 */

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('lista do mês: total do servidor, mês e filtro pela URL, e a linha abre o detalhe', async ({ page }) => {
  await simularApi(page);
  await page.goto('/app/lancamentos?mes=2026-10');

  await expect(page.getByRole('heading', { level: 1, name: 'Lançamentos de Outubro de 2026' })).toBeVisible();
  await expect(page.getByText('R$ 846,30')).toBeVisible();
  await expect(page.getByText('· 15 lançamentos')).toBeVisible();

  await page.getByRole('button', { name: 'Casa', exact: true }).click();
  await expect(page).toHaveURL(/escopo=casa/);
  await expect(page).toHaveURL(/mes=2026-10/);
  await expect(page.getByText('Nenhum lançamento em outubro com esses filtros.')).toBeVisible();

  await page.getByRole('button', { name: 'Limpar filtros' }).last().click();
  await expect(page).not.toHaveURL(/escopo=/);
  await page.getByRole('link', { name: /Fone bluetooth/ }).click();
  await expect(page).toHaveURL(/\/app\/lancamentos\/[0-9a-f-]{36}$/);
});

test('o mês pela URL: "Próximo mês" troca o mês e mostra o vazio', async ({ page }) => {
  await simularApi(page);
  await page.goto('/app/lancamentos?mes=2026-10');
  await expect(page.getByText('R$ 846,30')).toBeVisible();

  await page.getByRole('button', { name: /Próximo mês/ }).click();

  await expect(page).toHaveURL(/mes=2026-11/);
  await expect(page.getByText('Nenhum lançamento em novembro')).toBeVisible();
});

test('detalhe do pagador: edita a descrição e a edição manda só o campo alterado', async ({ page }) => {
  const { escritas } = await simularApi(page);
  await page.goto(`/app/lancamentos/${ID_LANCAMENTO}`);
  await expect(page.getByRole('region', { name: 'Resumo' })).toContainText('Geladeira nova (2/3)');

  await page.getByLabel('Descrição').fill('Geladeira inox');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page).toHaveURL(/\/app\/lancamentos$/);
  await expect(page.getByText('Alterações salvas')).toBeVisible();
  const patch = escritas.find((e) => e.metodo === 'PATCH');
  expect(patch?.url).toBe(`/api/lancamentos/${ID_LANCAMENTO}`);
  expect(patch?.corpo).toEqual({ descricao: 'Geladeira inox', confirmar_descarte: false });
});

test('altera a data de uma parcela do cartão: PATCH /api/parcelas/:id e a parcela fica marcada', async ({ page }) => {
  const { escritas } = await simularApi(page);
  await page.goto(`/app/lancamentos/${ID_LANCAMENTO}`);
  const parcelas = page.getByRole('region', { name: 'Parcelas' });
  await expect(parcelas.getByText('data ajustada')).toHaveCount(1);

  await parcelas.getByRole('button', { name: 'Alterar data da parcela 1 de 3' }).click();
  const campo = page.getByLabel('Nova data da parcela 1 de 3');
  await campo.fill('2026-09-15');
  await campo.press('Enter');

  await expect(page.getByText('Data da parcela alterada')).toBeVisible();
  await expect(parcelas.getByText('data ajustada')).toHaveCount(2);
  const patch = escritas.find((e) => e.url === `/api/parcelas/${ID_PARCELA_1}`);
  expect(patch?.corpo).toEqual({ data: '2026-09-15' });
});

test('excluir: o diálogo confirma, o DELETE sai uma vez e a lista volta', async ({ page }) => {
  const { escritas, detalhes } = await simularApi(page);
  await page.goto(`/app/lancamentos/${ID_LANCAMENTO}`);

  await page.getByRole('button', { name: 'Excluir' }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo.getByText('Excluir esta compra e as 3 parcelas?')).toBeVisible();
  await dialogo.getByRole('button', { name: 'Excluir' }).click();

  await expect(page).toHaveURL(/\/app\/lancamentos$/);
  await expect(page.getByText('Excluído')).toBeVisible();
  expect(escritas.filter((e) => e.metodo === 'DELETE')).toHaveLength(1);
  expect(detalhes.has(ID_LANCAMENTO)).toBe(false);
});

test('Início mostra o resumo do mês com o gasto do cartão', async ({ page }) => {
  await simularApi(page);
  await page.goto('/app');

  await expect(page.getByRole('region', { name: 'Casa' })).toContainText('R$ 2.418,70');
  const cartoes = page.locator('section', { hasText: 'Cartões' }).first();
  await expect(cartoes).toContainText('Cartão de crédito XP');
  await expect(cartoes).toContainText('Neste mês R$ 1.284,60');
});
