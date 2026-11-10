import test from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARIES, LOCALES, detectLocale, formatUtc, translate } from '../src/locales.mjs';

test('locale detection handles Chinese variants and ordered browser preferences', () => {
  assert.equal(detectLocale(['zh-Hant-HK', 'en-US']), 'zh-TW');
  assert.equal(detectLocale(['zh-CN']), 'zh-CN');
  assert.equal(detectLocale(['de-DE', 'fr-FR']), 'fr');
  assert.equal(detectLocale(['de-DE']), 'en');
});
test('UTC formatting is explicit and dictionaries retain core keys', () => {
  for (const [locale] of LOCALES) assert.equal(typeof DICTIONARIES[locale]['Reference value'], 'string');
  assert.match(formatUtc('2026-11-10T10:00:00Z', 'zh-CN'), /UTC$/);
  assert.equal(translate('fr', 'Excludes {tokens}', { tokens: 'NS' }), 'Hors NS');
});
