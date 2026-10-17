import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('controlled member brief can save, reopen, inspect evidence and record review', async ({ page }) => {
  // Browser contract test: generation/persistence are controlled responses, not live AI evidence.
  const id = '00000000-0000-4000-8000-000000000001';
  const evidence = { sourceId: 'HBR-DOC-04', excerpt: 'The latest forecast for final regression completion is 2026-11-11.',
    sourceTitle: 'Project Harbour QA Forecast', sourceUrl: '/api/sources/HBR-DOC-04', recordedAt: '2026-10-10', effectiveAt: null };
  const saved = { id, question: 'Can Project Harbour launch on 1 Nov?', createdAt: '2026-10-16T01:00:00.000Z',
    model: 'test-model', status: 'at_risk', reviewedByHuman: false, reviewedAt: null, synthetic: true,
    brief: { recommendation: 'Seek QA and security confirmation before making a commitment.',
      supportingClaims: [{ claim: 'QA completion is forecast for 2026-11-11.', evidence: [evidence] }],
      conflicts: [], alternatives: [{ option: 'Replan delivery', tradeoff: 'Requires customer agreement.' }],
      unknowns: ['Production approval remains unverified.'], suggestedNextStep: 'Ask owners to review evidence.' } };
  await page.route('**/api/decision-briefs**', async route => {
    expect(route.request().headers().authorization).toBe('Bearer browser-test-token');
    if (route.request().url().endsWith('/review')) {
      await route.fulfill({ json: { ...saved, reviewedByHuman: true, reviewedAt: '2026-10-16T02:00:00.000Z' } });
    } else if (route.request().method() === 'POST') {
      expect(route.request().headers()['idempotency-key']).toBeTruthy();
      await route.fulfill({ status: 201, json: saved });
    } else await route.fulfill({ json: route.request().url().endsWith(id) ? saved : { items: [saved] } });
  });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  const panel = page.getByRole('region', { name: 'Decision brief', exact: true });
  await panel.getByLabel('Member Firebase ID token').fill('browser-test-token');
  await panel.getByLabel('Decision question').fill(saved.question);
  await panel.getByRole('button', { name: 'Create brief', exact: true }).click();
  await expect(panel.getByRole('article')).toContainText('At risk, needs human decision');
  await panel.getByRole('button', { name: 'Refresh saved briefs' }).click();
  await expect(panel.getByRole('button', { name: saved.question, exact: true })).toBeEnabled();
  await panel.getByRole('button', { name: saved.question, exact: true }).click();
  await panel.getByRole('button', { name: /Project Harbour QA Forecast/ }).click();
  await expect(panel.getByRole('region', { name: 'Original source text' })).toContainText(evidence.excerpt);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(audit.violations).toEqual([]);
  await panel.getByRole('button', { name: 'Mark evidence reviewed' }).click();
  await expect(panel).toContainText('This is not production approval.');
  await page.reload();
  await expect(panel.getByLabel('Member Firebase ID token')).toHaveValue('');
});
