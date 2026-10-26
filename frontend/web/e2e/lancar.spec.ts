import { expect, test } from '@playwright/test';
import { fixarRelogio, ID_CREDITO, ID_MERCADO, simularApi } from './apoio/apiLancamentos';

/**
 * e2e da folha Lançar (etapa 12, lote 2): o app real no navegador, com a API simulada por `page.route`.
 * Despesa à vista, parcelada no crédito e receita; a escrita leva o id do cliente e o cabeçalho CSRF (ADR-010, G-21).
 */

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('lança uma despesa à vista pelo "+ Lançar": POST idempotente, aviso e folha pronta para a próxima', async ({
  page,
}) => {
  const { escritas } = await simularApi(page);
  await page.goto('/app');
  await expect(page.getByRole('region', { name: 'Casa' })).toBeVisible();

  await page.getByRole('link', { name: 'Lançar' }).first().click();
  const folha = page.getByRole('dialog');
  await expect(folha).toBeVisible();
  await expect(folha.locator('#valor')).toBeFocused();

  await folha.locator('#valor').pressSequentially('4590');
  await folha.getByRole('radio', { name: /Mercado/ }).click({ force: true });
  await folha.getByRole('button', { name: 'Lançar R$ 45,90' }).click();

  await expect(page.getByText('Lançado: R$ 45,90 · Mercado · Casa')).toBeVisible();
  const post = escritas.find((e) => e.url === '/api/lancamentos/despesas');
  expect(post?.corpo).toMatchObject({
    valor_centavos: 4590,
    categoria_id: ID_MERCADO,
    parcelas: 1,
    data: '2026-10-12',
  });
  expect((post?.corpo as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
  expect(post?.cabecalhos['x-controle-em-casa']).toBe('1');
  await expect(folha.locator('#valor')).toHaveValue('R$ 0,00');
});

test('despesa parcelada no cartão de crédito: 3x vai no corpo e o aviso diz a 1ª parcela', async ({ page }) => {
  const { escritas } = await simularApi(page);
  await page.goto('/app/lancar');
  const folha = page.getByRole('dialog');
  await expect(folha).toBeVisible();

  await folha.locator('#valor').pressSequentially('36000');
  await folha.getByRole('radio', { name: /Mercado/ }).click({ force: true });
  await folha.getByRole('button', { name: /Forma de pagamento/ }).click();
  await folha.getByRole('radio', { name: /Cartão de crédito XP/ }).click({ force: true });
  await folha.getByRole('radio', { name: '3x' }).click({ force: true });
  await folha.getByRole('button', { name: 'Lançar R$ 360,00 em 3x' }).click();

  await expect(page.getByText('Lançado em 3x · Mercado · Casa · 1ª parcela em 12/10')).toBeVisible();
  const post = escritas.find((e) => e.url === '/api/lancamentos/despesas');
  expect(post?.corpo).toMatchObject({ valor_centavos: 36000, forma_id: ID_CREDITO, parcelas: 3 });
});

test('lança uma receita: vai para /receitas, sem forma nem parcelas', async ({ page }) => {
  const { escritas } = await simularApi(page);
  await page.goto('/app');
  await page.getByRole('link', { name: 'Lançar' }).first().click();
  const folha = page.getByRole('dialog');
  await expect(folha).toBeVisible();

  await folha.getByRole('radio', { name: 'Receita' }).click({ force: true });
  await folha.locator('#valor').pressSequentially('750000');
  await folha.getByRole('radio', { name: /Salário/ }).click({ force: true });
  await folha.getByRole('button', { name: 'Lançar receita R$ 7.500,00' }).click();

  await expect(page.getByText(/Lançado: R\$ 7\.500,00 · Salário · Eu/)).toBeVisible();
  const post = escritas.find((e) => e.url === '/api/lancamentos/receitas');
  expect(post?.corpo).toMatchObject({ valor_centavos: 750000, data: '2026-10-12' });
  expect(post?.corpo).not.toHaveProperty('forma_id');
  expect(post?.corpo).not.toHaveProperty('parcelas');
});

test('fechar a folha aberta por /app/lancar volta ao Início', async ({ page }) => {
  await simularApi(page);
  await page.goto('/app/lancar');
  const folha = page.getByRole('dialog');
  await expect(folha).toBeVisible();

  await folha.getByRole('button', { name: 'Fechar' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
