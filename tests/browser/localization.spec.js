import { test, expect } from '@playwright/test';
import { DICTIONARIES, LOCALES } from '../../src/locales.mjs';

const address = `0x${'1'.repeat(64)}`;
const item = { status: 'claimable', amount: '1000000000', objectId: `0x${'2'.repeat(64)}`, reason: 'An unclaimed NFT and its matching funded object are present; on-chain claiming is enabled.', type: 'official::airdrop::NFT' };
async function fixture(page) {
  await page.route('**/api/snapshots/**', (route) => route.fulfill({ status: 503, json: { error: 'No completed snapshot is available yet.' } }));
  await page.route('**/api/scan', (route) => route.fulfill({ json: {
    address, checkedAt: '2026-11-10T10:00:00Z', checkpointTime: '2026-11-10T10:00:00Z', checkpoint: 123, source: 'Sui GraphQL',
    groups: [
      { campaignId: 'wal-launch', complete: true, errors: [], items: [item] },
      { campaignId: 'wal-stakers', complete: true, errors: [], items: [] },
      { campaignId: 'ns-launch', complete: true, errors: [], items: [{ ...item, amount: '1000000' }] },
      { campaignId: 'deep-s1', complete: true, errors: [], items: [{ ...item, amount: '2000000' }] },
      { campaignId: 'deep-launch', complete: true, errors: [], items: [] },
    ],
  } }));
}
for (const [locale] of LOCALES) {
  test(`${locale} translates query, validation, evidence and claims without native selects`, async ({ page }) => {
    const strings = DICTIONARIES[locale];
    await page.addInitScript((value) => localStorage.setItem('suitokensaver:locale', value), locale);
    await fixture(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('select:visible')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: strings['Unclaimed on Sui'] })).toBeVisible();
    await page.getByRole('button', { name: strings['Scan addresses'], exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(strings['Enter at least one address or SuiNS name.']);
    await page.getByLabel(strings['Addresses or SuiNS names']).fill(address);
    await page.getByRole('button', { name: strings['Scan addresses'], exact: true }).click();
    await expect(page.locator('.campaign')).toHaveCount(3);
    await expect(page.locator('.campaign-heading').filter({ hasText: strings['Staker airdrop'] })).toHaveCount(0);
    await expect(page.locator('.campaign-heading').filter({ hasText: strings['Initial airdrop'] })).toHaveCount(locale.startsWith('zh') ? 1 : 0);
    await expect(page.locator('.claim-link').first()).toHaveAttribute('href', 'https://claim.walrus.xyz/');
    await expect(page.locator('.claim-link').last()).toHaveAttribute('href', 'https://claim.suins.io/');
    await expect(page.getByRole('button', { name: strings['Copy DEEP claim prompt'] })).toBeVisible();
    await page.locator('.result-row summary').first().click();
    await expect(page.locator('.evidence').first()).toContainText(strings[item.reason]);
    await expect(page.locator('.evidence').first()).toContainText('UTC');
    const language = page.getByRole('combobox', { name: strings.Language, exact: true });
    await language.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(language).toBeFocused();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/locale-${locale}-mobile.png`, fullPage: true });
  });
}
test('DEEP prompt copies historical evidence and explicit wallet safety constraints', async ({ page }) => {
  await page.addInitScript(() => {
    window.copiedPrompt = '';
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.copiedPrompt = value; } } });
  });
  await fixture(page);
  await page.goto('/');
  await page.getByLabel('Addresses or SuiNS names').fill(address);
  await page.getByRole('button', { name: 'Scan addresses', exact: true }).click();
  await page.getByRole('button', { name: 'Copy DEEP claim prompt' }).click();
  const prompt = await page.evaluate(() => window.copiedPrompt);
  expect(prompt).toContain(address);
  expect(prompt).toContain('deep-s1');
  expect(prompt).toContain('simulate it first');
  expect(prompt).toContain('Never ask for a seed phrase');
});
