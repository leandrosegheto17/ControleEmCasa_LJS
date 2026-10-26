import { expect, test } from '@playwright/test';
import { fixarRelogio, ID_CONVITE, simularApiMetas } from './apoio/apiMetas';

/**
 * e2e do convite de membro e do "sair de todos" (etapa 12, lote 4), contra a API simulada por `page.route`. Critérios:
 * RN-23 (CA-23.1: o titular convida por e-mail e o token nunca chega à tela; o convite vale 7 dias e o titular o revoga),
 * CA-20.5 (sair de todos encerra todas as sessões, inclusive a atual).
 */

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('de Ajustes a Casa e membros: o titular convida, vê o convite pendente e o cancela', async ({ page }) => {
  const { escritas, lar } = await simularApiMetas(page);
  await page.goto('/app/ajustes');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Casa e membros/ })
    .click();

  await expect(page).toHaveURL(/\/app\/ajustes\/lar$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Casa e membros' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Membros' })).toContainText('Titular · você');

  await page.getByLabel('E-mail de quem vai participar').fill('Beatriz@Exemplo.com');
  await page.getByRole('button', { name: 'Enviar convite' }).click();

  await expect(page.getByText('Convite enviado para beatriz@exemplo.com', { exact: true })).toBeVisible();
  const pendente = page.getByRole('region', { name: 'Convite pendente' });
  await expect(pendente).toContainText('válido até 16/10/2026');
  const envio = escritas.find((e) => e.url === '/api/lar/convites');
  expect(envio?.metodo).toBe('POST');
  expect(envio?.corpo).toEqual({ email: 'Beatriz@Exemplo.com' });
  expect(envio?.cabecalhos['x-controle-em-casa']).toBe('1');
  await expect(page.locator('body')).not.toContainText(/token/i);

  await pendente.getByRole('button', { name: 'Cancelar convite' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar convite' }).click();

  await expect(page.getByText('Convite cancelado')).toBeVisible();
  await expect(page.getByLabel('E-mail de quem vai participar')).toBeVisible();
  expect(escritas.some((e) => e.metodo === 'DELETE' && e.url === `/api/lar/convites/${ID_CONVITE}`)).toBe(true);
  expect(lar.convite_pendente).toBeUndefined();
});

test('com os dois membros, não há formulário de convite', async ({ page }) => {
  await simularApiMetas(page, 'lar-dois-membros.json');
  await page.goto('/app/ajustes/lar');

  await expect(page.getByRole('region', { name: 'Membros' }).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText(/A casa já tem os dois membros/)).toBeVisible();
  await expect(page.getByLabel('E-mail de quem vai participar')).toHaveCount(0);
});

test('sair de todos os aparelhos: pede confirmação, chama a rota global e leva a Entrar', async ({ page }) => {
  const { escritas, estado } = await simularApiMetas(page);
  await page.goto('/app/ajustes');

  await page.getByRole('button', { name: /Sair de todos os aparelhos/ }).click();
  const dialogo = page.getByRole('alertdialog');
  await expect(dialogo).toContainText('Sair de todos os aparelhos?');
  await dialogo.getByRole('button', { name: 'Cancelar' }).click();
  expect(escritas.some((e) => e.url === '/api/sessao/sair-de-todos')).toBe(false);

  await page.getByRole('button', { name: /Sair de todos os aparelhos/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sair de todos' }).click();

  await expect(page).toHaveURL(/\/entrar/);
  const saida = escritas.find((e) => e.url === '/api/sessao/sair-de-todos');
  expect(saida?.metodo).toBe('POST');
  expect(saida?.cabecalhos['x-controle-em-casa']).toBe('1');
  expect(estado.sessaoAtiva).toBe(false);
});
