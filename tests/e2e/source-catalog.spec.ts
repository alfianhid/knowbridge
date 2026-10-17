import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [320, 375, 768, 1440]) {
  test(`catalog is usable and has no axe violations at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const response = await page.goto('/');
    expect(response?.headers()['content-security-policy']).toContain("'nonce-");
    await expect(page.locator('.pill')).toContainText('fictional records');
    await expect(page.locator('.pill')).toBeVisible();
    await expect(page.getByRole('complementary').getByRole('region', { name: / evidence$/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations).toEqual([]);
    await page.getByRole('button', { name: /Customer Commitments/ }).click();
    await expect(page.getByRole('region', { name: /Customer Commitments.*evidence/ })).toContainText('2026-11-01');
    await page.getByText('Original source text', { exact: true }).click();
    await expect(page.getByRole('region', { name: 'Original source text' })).toContainText('SYNTHETIC DEMO DATA');
    await page.screenshot({ path: `test-results/catalog-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('keyboard focus, evidence scrolling and forced colors', async ({ page }) => {
  await page.goto('/');
  const selected = page.locator('button[aria-current="true"]');
  await selected.focus();
  expect(await selected.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Source catalog' }).getByRole('status')).toContainText('Loaded Project Harbour');
  await expect(page.getByRole('region', { name: /Customer Commitments.*evidence/ })).toBeVisible();
  const evidence = page.getByRole('complementary').getByRole('region', { name: / evidence$/ });
  await evidence.focus();
  await page.keyboard.press('End');
  await expect.poll(() => evidence.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.emulateMedia({ forcedColors: 'active' });
  await evidence.focus();
  expect(await evidence.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
});

test('source detail failure can be retried', async ({ page }) => {
  let failed = false;
  await page.route('**/api/sources/HBR-DOC-01', async route => {
    if (!failed) { failed = true; await route.fulfill({ status: 503, json: { error: 'Unavailable' } }); }
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('complementary').getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('complementary').getByRole('region', { name: / evidence$/ })).toBeVisible();
  await expect(page.getByRole('complementary').getByRole('alert')).toHaveCount(0);
});

test('local Ask renders Harbour evidence and abstains for absent information', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Question', exact: true }).fill('Can Project Harbour launch on 1 Nov?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  const answer = page.getByRole('region', { name: 'Grounded answer' });
  await expect(answer).toContainText('Local deterministic evidence lookup; no AI synthesis.');
  await expect(answer).toContainText('2026-11-01');
  await expect(answer).toContainText('2026-11-11');
  await expect(answer).toContainText('PENDING');
  for (const id of ['HBR-DOC-02', 'HBR-DOC-04', 'HBR-DOC-06', 'HBR-DOC-09']) {
    await expect(answer.locator(`a[href="/api/sources/${id}"]`).first()).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
  await page.getByRole('textbox', { name: 'Question', exact: true }).fill('What is the personal mobile number of the CEO?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(answer.getByRole('heading', { name: 'Insufficient evidence' })).toBeVisible();
  await expect(answer.getByRole('link')).toHaveCount(0);
});
