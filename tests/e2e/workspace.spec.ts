import { test, expect } from '@playwright/test';

test('disabled Workspace preserves the seed demo and denies imports', async ({ page, request }) => {
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Google Workspace' });
  await expect(panel).toContainText('Workspace import is disabled');
  await expect(panel.getByRole('button', { name: 'Connect Google Workspace' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Disconnect and delete imported copies' })).toBeVisible();
  const response = await request.post('/api/workspace/import', { data: { fileIds: ['unregistered-file'] } });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: 'Workspace integration is disabled.' });
  await expect(page.getByRole('heading', { name: 'Decision brief', exact: true })).toBeVisible();
});
