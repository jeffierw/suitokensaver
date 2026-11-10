import test from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARIES, LOCALES, detectLocale, formatUtc, translate } from '../src/locales.mjs';
import { readFile } from 'node:fs/promises';

test('locale detection handles Chinese variants and ordered browser preferences', () => {
  assert.equal(detectLocale(['zh-Hant-HK', 'en-US']), 'zh-TW');
  assert.equal(detectLocale(['zh-CN']), 'zh-CN');
  assert.equal(detectLocale(['de-DE', 'fr-FR']), 'fr');
  assert.equal(detectLocale(['de-DE']), 'en');
});
test('all visible literal translation keys have explicit translations in every language', async () => {
  const keys = new Set();
  for (const file of ['src/main.jsx', 'src/SnapshotExplorer.jsx']) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/\bt\(['"]([^'"]+)['"]/g)) keys.add(match[1]);
  }
  for (const [locale] of LOCALES) {
    for (const key of keys) assert.ok(DICTIONARIES[locale][key], `${locale} missing ${key}`);
    for (const [key, text] of Object.entries(DICTIONARIES.en)) {
      assert.ok(DICTIONARIES[locale][key], `${locale} missing ${key}`);
      assert.deepEqual((DICTIONARIES[locale][key].match(/\{\w+\}/g) || []).sort(), (text.match(/\{\w+\}/g) || []).sort(), `${locale}: ${key}`);
    }
  }
});
test('UTC formatting is explicit and dictionaries retain core keys', () => {
  for (const [locale] of LOCALES) assert.equal(typeof DICTIONARIES[locale]['Reference value'], 'string');
  assert.match(formatUtc('2026-11-10T10:00:00Z', 'zh-CN'), /UTC$/);
  assert.equal(translate('fr', 'Excludes {tokens}', { tokens: 'NS' }), 'Hors NS');
});
