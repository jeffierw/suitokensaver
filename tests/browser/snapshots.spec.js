import { test, expect } from '@playwright/test';

test('snapshot categories paginate and live verification does not rewrite historical amounts', async ({ page }) => {
  await page.route('**/api/snapshots/**', async (route) => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname.endsWith('/latest')) data = {
      id: 'test-snapshot', checkpoint: { sequenceNumber: 123, timestamp: new Date().toISOString() },
      complete: true, unresolved: 0, holders: 27, allocations: 27,
      scopes: Object.fromEntries(['WAL', 'DEEP', 'NS'].map((token) => [`${token}/all/claimable`, { amount: '1000000000', holders: 27, allocations: 27, pages: 2 }])),
    };
    else if (url.pathname.endsWith('/prices')) data = { id: 'test-quote', quotes: {} };
    else if (url.pathname.endsWith('/evidence')) data = { items: [], hasMore: false };
    else data = { id: 'test-snapshot', page: Number(url.searchParams.get('page') || 1), pages: 2,
      rows: [{ address: `0x${'1'.repeat(64)}`, amount: '1000000000', allocations: 1, recovery: 0 }] };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.route('**/api/scan', (route) => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({
      address: `0x${'1'.repeat(64)}`, checkedAt: new Date().toISOString(), complete: true,
      groups: [{ campaignId: 'wal-launch', complete: true, errors: [], items: [{ status: 'claimed', amount: '1000000000' }] }],
    }),
  }));
  await page.goto('/');
  const region = page.getByRole('region', { name: 'Global airdrop snapshot' });
  await expect(region.getByRole('heading', { name: 'Still waiting on-chain' })).toBeVisible();
  await expect(region.getByText('1 WAL', { exact: true })).toBeVisible();
  await region.getByRole('button', { name: 'Next page' }).click();
  await expect(region.getByText('Page 2 of 2')).toBeVisible();
  await region.getByRole('tab', { name: 'DEEP', exact: true }).click();
  await expect(region.getByText('Page 1 of 2')).toBeVisible();
  await expect(region.getByText('1,000 DEEP', { exact: true })).toBeVisible();
  await region.getByRole('tab', { name: 'WAL', exact: true }).click();
  await region.getByRole('button', { name: 'Verify address on-chain' }).click();
  await expect(region.getByRole('heading', { name: 'Live verification' })).toBeVisible();
  await expect(region.getByText('Claimed', { exact: true })).toBeVisible();
  await expect(region.getByText('1 WAL', { exact: true }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/snapshot-mobile-test.png', fullPage: true });
});

test('missing global snapshot never displays fake zero totals', async ({ page }) => {
  await page.route('**/api/snapshots/**', (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No completed snapshot is available yet.' }),
  }));
  await page.goto('/');
  const region = page.getByRole('region', { name: 'Global airdrop snapshot' });
  await expect(region.getByText('No completed snapshot is available yet.')).toBeVisible();
  await expect(region.getByText('$0.00', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Scan addresses' })).toBeEnabled();
});
