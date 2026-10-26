import { expect, test } from '@playwright/test';
import { fixarRelogio, ID_VIAGEM, simularApiMetas } from './apoio/apiMetas';

/**
 * e2e das metas (etapa 12, lote 4): criar, ver na lista, aportar e retirar, contra a API simulada por `page.route`.
 * Critérios: RN-08 (guardado, percentual, atingida), RN-09 e CA-09.1 (retirada limitada ao guardado do local),
 * CA-08.1 (nasce com guardado 0), ADR-010 (id do cliente).
 */

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('lista de metas: da casa e minhas, as atingidas por último; Ajustes leva à tela', async ({ page }) => {
  await simularApiMetas(page);
  await page.goto('/app/ajustes');

  await page
    .getByRole('main')
    .getByRole('link', { name: /^Metas/ })
    .click();

  await expect(page).toHaveURL(/\/app\/metas$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Metas' })).toBeVisible();
  const casa = page.getByRole('region', { name: 'Da casa' });
  await expect(casa.getByRole('link')).toHaveCount(2);
  await expect(casa.getByRole('link').first()).toContainText('Reserva de emergência');
  const minhas = page.getByRole('region', { name: 'Minhas' });
  await expect(minhas.getByRole('link').first()).toContainText('Notebook novo');
  await expect(minhas.getByRole('link').last()).toContainText('Curso de inglês');
  await expect(minhas.getByRole('link').last()).toContainText('Atingida');
});

test('criar uma meta: PUT com id do cliente e prazo no dia 1; abre o detalhe com guardado 0', async ({ page }) => {
  const { escritas } = await simularApiMetas(page);
  await page.goto('/app/metas/nova?escopo=casa');

  await page.getByLabel('Nome').fill('Carro novo');
  await page.getByLabel('Valor-alvo').pressSequentially('2000000');
  await page.getByLabel('Prazo (opcional)').fill('2028-12');
  await page.getByRole('button', { name: 'Criar meta' }).click();

  await expect(page.getByText('Meta salva')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Carro novo' })).toBeVisible();
  await expect(page.getByText('Meta da casa')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nenhum aporte ainda' })).toBeVisible();
  const put = escritas.find((e) => e.metodo === 'PUT');
  expect(put?.url).toMatch(/^\/api\/metas\/[0-9a-f-]{36}$/);
  expect(put?.corpo).toEqual({ nome: 'Carro novo', alvo_centavos: 2000000, prazo: '2028-12-01', escopo: 'conjunto' });
  expect(put?.cabecalhos['x-controle-em-casa']).toBe('1');
});

test('aportar: a folha envia o movimento e o guardado sobe', async ({ page }) => {
  const { escritas } = await simularApiMetas(page);
  await page.goto(`/app/metas/${ID_VIAGEM}`);

  await expect(page.getByText('Guardado', { exact: true }).locator('xpath=following-sibling::*[1]')).toHaveText(
    'R$ 6.200,00',
  );
  await page.getByRole('link', { name: 'Aportar' }).click();
  const folha = page.getByRole('dialog', { name: 'Viagem Nordeste' });
  await folha.getByLabel('Valor').pressSequentially('50000');
  await folha.getByLabel('Onde está guardado').fill('Cofre');
  await folha.getByRole('button', { name: 'Confirmar aporte' }).click();

  await expect(page.getByText('Aporte registrado')).toBeVisible();
  await expect(page).not.toHaveURL(/movimentar=/);
  await expect(page.getByText('Guardado', { exact: true }).locator('xpath=following-sibling::*[1]')).toHaveText(
    'R$ 6.700,00',
  );
  const post = escritas.find((e) => e.metodo === 'POST' && e.url.endsWith('/movimentos'));
  expect(post?.url).toBe(`/api/metas/${ID_VIAGEM}/movimentos`);
  expect(post?.corpo).toMatchObject({ tipo: 'aporte', valor_centavos: 50000, local: 'Cofre', data: '2026-10-09' });
  expect(post?.cabecalhos['x-controle-em-casa']).toBe('1');
});

test('retirar mais do que há no local é recusado com a mensagem no campo; retirar o que cabe funciona', async ({
  page,
}) => {
  await simularApiMetas(page);
  await page.goto(`/app/metas/${ID_VIAGEM}?movimentar=retirada`);

  const folha = page.getByRole('dialog', { name: 'Viagem Nordeste' });
  await folha.getByText(/CDB Banco Inter/).click();
  await folha.getByLabel('Valor').pressSequentially('250000');
  await folha.getByRole('button', { name: 'Confirmar retirada' }).click();

  await expect(folha.getByText('Em CDB Banco Inter há R$ 2.000,00. A retirada não pode passar disso.')).toBeVisible();

  await folha.getByLabel('Valor').fill('');
  await folha.getByLabel('Valor').pressSequentially('30000');
  await folha.getByRole('button', { name: 'Confirmar retirada' }).click();

  await expect(page.getByText('Retirada registrada')).toBeVisible();
  await expect(page.getByText('Guardado', { exact: true }).locator('xpath=following-sibling::*[1]')).toHaveText(
    'R$ 5.900,00',
  );
});
