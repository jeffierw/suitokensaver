import { test, expect } from '@playwright/test';

test('validates input and keeps mobile layout within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Unclaimed on Sui' })).toBeVisible();
  await expect(page.getByText('An old wallet may still have something waiting.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Missed the announcement, not necessarily the airdrop.' })).toBeVisible();
  await page.getByLabel('Addresses or SuiNS names').fill('not-an-address');
  await page.getByRole('button', { name: 'Scan addresses' }).click();
  await expect(page.getByRole('alert')).toContainText('Use a full');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('groups real API results and exposes evidence', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  expect(await page.locator('.brand img').evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByLabel('Addresses or SuiNS names').fill('0x6195c3465b81d074822dadcd610e0dc7e33acdf4377f9f5d65a966cfa0f88cf9');
  await page.getByRole('button', { name: 'Scan addresses' }).click();
  await expect(page.getByText('198.165393 DEEP', { exact: true })).toBeVisible({ timeout: 90000 });
  await expect(page.getByRole('heading', { name: 'DeepBook Season 1' })).toBeVisible();
  const season = page.locator('.campaign').filter({ has: page.getByRole('heading', { name: 'DeepBook Season 1' }) });
  await season.locator('summary').click();
  await expect(season.getByText(/2027/)).toBeVisible();
  await expect(season.getByRole('link', { name: /0x9b262545/ })).toBeVisible();
  await season.locator('summary').click();
  await page.getByRole('combobox', { name: 'Status', exact: true }).click();
  await page.getByRole('option', { name: 'Unclaimed', exact: true }).click();
  await expect(page.getByText('198.165393 DEEP', { exact: true })).toBeVisible();
  await expect(page.getByText('866 WAL', { exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Status', exact: true }).click();
  await page.getByRole('option', { name: 'All statuses', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/suitokensaver.*\.json/);
  await page.screenshot({ path: 'artifacts/desktop-results.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/mobile-results.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('SuiNS aliases deduplicate and failed input remains visible', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  let scans = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/scan')) scans++; });
  await page.getByLabel('Addresses or SuiNS names').fill('bread.sui\n@bread\nthis-name-should-not-exist-49278651.sui');
  await page.getByRole('button', { name: 'Scan addresses' }).click();
  await expect(page.getByRole('heading', { name: 'Scan results' })).toBeVisible({ timeout: 90000 });
  await expect(page.getByText('1 addresses checked / 1 failed')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('not found');
  expect(scans).toBe(1);
});

test('failed scans never become empty successful results', async ({ page }) => {
  await page.route('**/api/scan', (route) => route.fulfill({
    status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Provider unavailable' }),
  }));
  await page.goto('/');
  await page.getByLabel('Addresses or SuiNS names').fill(`0x${'1'.repeat(64)}`);
  await page.getByRole('button', { name: 'Scan addresses' }).click();
  await expect(page.getByRole('alert')).toContainText('Provider unavailable');
  await expect(page.getByText('No object found', { exact: true })).toHaveCount(0);
});

test('a canceled request cannot overwrite a new scan', async ({ page }) => {
  let count = 0;
  await page.route('**/api/scan', async (route) => {
    const first = count++ === 0;
    if (first) await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: first ? 'Old error' : 'New error' }) }).catch(() => {});
  });
  await page.goto('/');
  await page.getByLabel('Addresses or SuiNS names').fill(`0x${'1'.repeat(64)}`);
  const request = page.waitForRequest('**/api/scan');
  await page.getByRole('button', { name: 'Scan addresses' }).click();
  await request;
  await page.getByRole('button', { name: 'Cancel scan' }).click();
  await page.getByRole('button', { name: 'Scan addresses' }).click();
  await expect(page.getByRole('alert')).toContainText('New error');
  await page.waitForTimeout(1500);
  await expect(page.getByRole('alert')).toContainText('New error');
  await expect(page.getByText('Old error')).toHaveCount(0);
});
