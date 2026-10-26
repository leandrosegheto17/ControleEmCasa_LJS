import { expect, test } from '@playwright/test';
import { fixarRelogio, ID_CONTAS_CASA, simularApiFixas } from './apoio/apiFixas';

/**
 * e2e do orçamento (etapa 12, lote 3): total e situação por categoria, definir o valor, remover e copiar do mês anterior,
 * contra a API simulada por `page.route`. Critérios: RN-16 (situação pela razão exata, ordem por percentual, copiar sem
 * sobrescrever), CA-T3.5 (remover é idempotente).
 */

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('mês com orçamento: total do servidor e situação de cada categoria', async ({ page }) => {
  await simularApiFixas(page);
  await page.goto('/app/orcamento?mes=2026-10');

  await expect(page.getByRole('heading', { level: 1, name: 'Orçamento de Outubro de 2026' })).toBeVisible();
  const total = page.getByRole('heading', { name: /Orçamento da casa/ });
  await expect(total).toContainText('Dentro');
  const lista = page.getByRole('region', { name: 'Por categoria' });
  await expect(lista.getByRole('link', { name: /Contas da casa/ })).toContainText('Estourado');
  await expect(lista.getByRole('link', { name: /Delivery/ })).toContainText('Atenção');
  await expect(lista.getByRole('link', { name: /Mercado/ })).toContainText('Dentro');
});

test('definir o valor de uma categoria: a folha envia o PUT e a situação muda', async ({ page }) => {
  const { escritas } = await simularApiFixas(page);
  await page.goto('/app/orcamento?mes=2026-10');

  await page.getByRole('link', { name: /Editar orçamento de Contas da casa/ }).click();
  const folha = page.getByRole('dialog', { name: 'Orçamento de Contas da casa' });
  await expect(folha).toContainText('Outubro de 2026 · Casa');
  const valor = folha.getByLabel('Valor orçado');
  await valor.fill('');
  await valor.pressSequentially('40000');
  await folha.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByText('Orçamento salvo')).toBeVisible();
  await expect(page).not.toHaveURL(/editar=/);
  await expect(page.getByRole('link', { name: /Editar orçamento de Contas da casa/ })).toContainText('Atenção');
  const put = escritas.find((e) => e.metodo === 'PUT');
  expect(put?.url).toBe(`/api/orcamento/2026-10-01/${ID_CONTAS_CASA}`);
  expect(put?.corpo).toEqual({ valor_centavos: 40000 });
  expect(put?.cabecalhos['x-controle-em-casa']).toBe('1');
});

test('remover o orçamento de uma categoria a leva para "Sem orçamento"', async ({ page }) => {
  const { escritas } = await simularApiFixas(page);
  await page.goto(`/app/orcamento?mes=2026-10&editar=${ID_CONTAS_CASA}`);

  await page.getByRole('button', { name: 'Remover orçamento desta categoria' }).click();

  await expect(page.getByText('Orçamento removido')).toBeVisible();
  await expect(page.getByText(/Sem orçamento \(1\)/)).toBeVisible();
  expect(escritas.find((e) => e.metodo === 'PUT')?.corpo).toEqual({ valor_centavos: null });
});

test('mês vazio: copiar do mês anterior traz o orçamento; "Próximo mês" abre o estado vazio', async ({ page }) => {
  const { escritas } = await simularApiFixas(page);
  await page.goto('/app/orcamento?mes=2026-10');
  await expect(page.getByRole('heading', { name: /Orçamento da casa/ })).toBeVisible();

  await page.getByRole('button', { name: /Próximo mês/ }).click();

  await expect(page).toHaveURL(/mes=2026-11/);
  await expect(page.getByRole('heading', { name: 'Sem orçamento da casa em novembro' })).toBeVisible();
  await page.getByRole('button', { name: 'Copiar de outubro' }).click();

  await expect(page.getByText('Orçamento copiado de outubro')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Orçamento da casa/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Por categoria' }).getByRole('link')).toHaveCount(5);
  const copia = escritas.find((e) => e.url === '/api/orcamento/2026-11-01/copiar');
  expect(copia?.corpo).toEqual({ escopo: 'conjunto' });
});

test('o bloco Orçamento do Início leva à tela de orçamento com o mês e o escopo', async ({ page }) => {
  await simularApiFixas(page);
  await page.goto('/app?mes=2026-10');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Ver orçamento/ })
    .click();

  await expect(page).toHaveURL(/\/app\/orcamento\?mes=2026-10&escopo=casa/);
  await expect(page.getByRole('heading', { level: 1, name: /Orçamento de/ })).toBeVisible();
});
