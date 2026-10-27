import { expect, test } from '@playwright/test';
import { ENDPOINT, simularApiPush, simularNavegadorPush } from './apoio/apiPush';

/**
 * e2e de Ajustes, Notificações (etapa 15, lote 2), contra a API e o navegador simulados. Critérios: RN-27 (CA-27.5: ativar
 * neste aparelho só no clique, com a inscrição enviada ao servidor; CA-27.8: desativar remove; preferências por tipo, com o
 * objeto completo). Não prova a entrega real de push: isso exige navegador e serviço de push reais.
 */

test('ativar neste aparelho, ajustar a preferência e desativar', async ({ page }) => {
  await simularNavegadorPush(page);
  const { estado, escritas, chamadas } = await simularApiPush(page);
  await page.goto('/app/ajustes');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Notificações/ })
    .click();
  await expect(page).toHaveURL(/\/app\/ajustes\/notificacoes$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Notificações' })).toBeVisible();

  // Abrir a tela não pede permissão nem busca a chave.
  await expect(page.getByRole('button', { name: 'Ativar neste aparelho' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __push: { pedidos: number } }).__push.pedidos)).toBe(0);
  expect(chamadas).toEqual([]);

  await page.getByRole('button', { name: 'Ativar neste aparelho' }).click();
  await expect(page.getByText('Os avisos estão ativos neste aparelho.')).toBeVisible();
  const envio = escritas.find((e) => e.metodo === 'POST' && e.url === '/api/push/assinaturas');
  expect(envio?.corpo).toEqual({ endpoint: ENDPOINT, keys: { p256dh: 'p256dh-e2e', auth: 'auth-e2e' } });
  expect(envio?.cabecalhos['x-controle-em-casa']).toBe('1');
  expect(estado.assinaturas).toEqual([ENDPOINT]);

  await page.getByRole('switch', { name: /Lembrete diário/ }).click();
  await expect.poll(() => estado.preferencias.lembrete_diario).toBe(true);
  await page.getByLabel('Horário do lembrete').selectOption('7');
  await expect.poll(() => estado.preferencias.lembrete_hora).toBe(7);
  expect(estado.preferencias).toEqual({ fixas: true, lembrete_diario: true, lembrete_hora: 7, metas: true });

  await page.getByRole('button', { name: 'Desativar neste aparelho' }).click();
  await expect(page.getByRole('button', { name: 'Ativar neste aparelho' })).toBeVisible();
  expect(estado.assinaturas).toEqual([]);
  expect(escritas.find((e) => e.metodo === 'DELETE')?.corpo).toEqual({ endpoint: ENDPOINT });
});

test('permissão negada no navegador: explica e não oferece ativar', async ({ page }) => {
  await simularNavegadorPush(page, { permissao: 'denied' });
  await simularApiPush(page);
  await page.goto('/app/ajustes/notificacoes');

  await expect(page.getByText(/Os avisos estão bloqueados para este site/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ativar neste aparelho' })).toHaveCount(0);
});

test('o diálogo de permissão recusado leva ao estado bloqueado, sem assinar', async ({ page }) => {
  await simularNavegadorPush(page, { respostaDoPedido: 'denied' });
  const { estado } = await simularApiPush(page);
  await page.goto('/app/ajustes/notificacoes');

  await page.getByRole('button', { name: 'Ativar neste aparelho' }).click();
  await expect(page.getByText(/Os avisos estão bloqueados para este site/)).toBeVisible();
  expect(estado.assinaturas).toEqual([]);
});
