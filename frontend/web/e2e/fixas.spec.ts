import { expect, test } from '@playwright/test';
import { fixarRelogio, ID_ALUGUEL, ID_OC_AGUA, simularApiFixas } from './apoio/apiFixas';

/**
 * e2e das despesas fixas (etapa 12, lote 3): ocorrências do mês, pagar e desfazer, criar e encerrar o modelo, contra a API
 * simulada por `page.route`. Critérios: RN-15 (ordem, atrasada, pagar com vencimento, só o pagador desfaz, encerrar).
 */

test.beforeEach(async ({ page }) => {
  await fixarRelogio(page);
});

test('ocorrências do mês: ordem do servidor, atrasada marcada e totais; Ajustes leva à tela', async ({ page }) => {
  await simularApiFixas(page);
  await page.goto('/app/ajustes');

  await page.getByRole('link', { name: /Despesas fixas/ }).click();

  await expect(page).toHaveURL(/\/app\/fixas/);
  const titulo = page.getByRole('heading', { name: /Pagas: 4 de 7/ });
  await expect(titulo).toContainText('Previsto a pagar');
  const itens = page.getByRole('region', { name: /Pagas: 4 de 7/ }).getByRole('listitem');
  await expect(itens).toHaveCount(7);
  await expect(itens.first()).toContainText('Internet');
  await expect(itens.first()).toContainText('venceu 05/10');
  await expect(itens.first()).toContainText('Atrasada');
  await expect(itens.nth(1)).toContainText('Aluguel');
  await expect(itens.nth(1)).toContainText('Pendente');
});

test('pagar uma ocorrência: a folha envia id, forma, valor e data; a lista mostra paga por você com o vencimento', async ({
  page,
}) => {
  const { escritas } = await simularApiFixas(page);
  await page.goto('/app/fixas?mes=2026-10');

  await page.getByRole('link', { name: 'Marcar como paga: Internet' }).click();
  const folha = page.getByRole('dialog', { name: 'Marcar como paga' });
  await expect(folha).toContainText('Contas da casa · venceu 05/10');
  await folha.getByRole('button', { name: 'Confirmar pagamento' }).click();

  await expect(page.getByText('Marcada como paga')).toBeVisible();
  await expect(page).not.toHaveURL(/pagar=/);
  await expect(page.getByRole('heading', { name: /Pagas: 5 de 7/ })).toBeVisible();
  const internet = page.getByRole('listitem').filter({ hasText: 'Internet' }).first();
  await expect(internet).toContainText('Paga por você');
  await expect(internet).toContainText('vence 05/10');
  const pagamento = escritas.find((e) => e.metodo === 'POST' && e.url.endsWith('/pagamento'));
  expect(pagamento?.cabecalhos['x-controle-em-casa']).toBe('1');
  expect(pagamento?.corpo).toMatchObject({
    forma_id: '00000000-0000-4000-8000-000000000301',
    valor_centavos: 11990,
    data: '2026-10-09',
  });
  expect((pagamento?.corpo as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
});

test('desfazer o pagamento de uma ocorrência paga por mim; a do outro membro não tem o botão', async ({ page }) => {
  const { escritas } = await simularApiFixas(page);
  await page.goto('/app/fixas?mes=2026-10');

  await expect(page.getByRole('button', { name: 'Desfazer pagamento: Luz' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer pagamento: Água' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /desfazer/i })
    .click();

  await expect(page.getByText('Pagamento desfeito')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Pagas: 3 de 7/ })).toBeVisible();
  expect(escritas.some((e) => e.metodo === 'DELETE' && e.url === `/api/ocorrencias/${ID_OC_AGUA}/pagamento`)).toBe(
    true,
  );
});

test('nova despesa fixa: valida, cria com id do cliente e volta à lista do mês', async ({ page }) => {
  const { escritas } = await simularApiFixas(page);
  await page.goto('/app/fixas?mes=2026-10');

  await page
    .getByRole('link', { name: /Nova despesa fixa/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nova despesa fixa' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Informe a descrição.')).toBeVisible();

  await page.getByLabel('Descrição').fill('Seguro do carro');
  await page.getByLabel('Valor previsto').pressSequentially('45000');
  await page.getByLabel('Dia de vencimento').fill('20');
  await page.getByRole('button', { name: 'Salvar' }).click();

  await expect(page.getByText('Despesa fixa salva')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/fixas\?mes=2026-10$/);
  await expect(page.getByRole('region', { name: 'Modelos' }).getByText('Seguro do carro')).toBeVisible();
  const put = escritas.find((e) => e.metodo === 'PUT');
  expect(put?.url).toMatch(/^\/api\/fixas\/[0-9a-f-]{36}$/);
  expect(put?.corpo).toMatchObject({
    descricao: 'Seguro do carro',
    valor_previsto_centavos: 45000,
    dia_vencimento: 20,
  });
});

test('editar e encerrar um modelo: o encerrado sai de Modelos', async ({ page }) => {
  const { escritas } = await simularApiFixas(page);
  await page.goto(`/app/fixas/${ID_ALUGUEL}?mes=2026-10`);
  await expect(page.getByLabel('Descrição')).toHaveValue('Aluguel');

  await page.getByRole('button', { name: 'Encerrar despesa fixa' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /Encerrar/ })
    .click();

  await expect(page.getByText('Despesa fixa encerrada')).toBeVisible();
  await expect(page).toHaveURL(/\/app\/fixas\?mes=2026-10$/);
  await expect(page.getByRole('region', { name: 'Modelos' }).getByText('Aluguel')).toHaveCount(0);
  expect(escritas.some((e) => e.metodo === 'POST' && e.url === `/api/fixas/${ID_ALUGUEL}/encerrar`)).toBe(true);
});
