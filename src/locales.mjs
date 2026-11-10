import { COMPLETE } from './translations.mjs';

export const LOCALES = [
  ['en', 'English'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'],
  ['ja', '日本語'], ['ko', '한국어'], ['fr', 'Français'], ['uk', 'Українська'],
];
export const DICTIONARIES = COMPLETE;
const aliases = {
  'Enter an address or SuiNS name.': 'Enter at least one address or SuiNS name.',
  'A full Sui address is required.': 'Use a full 0x address, name.sui or @name.',
  'A full normalized Sui address is required.': 'Use a full 0x address, name.sui or @name.',
  'The official claim configuration could not be verified.': 'The current claim configuration could not be verified.',
  'The NFT contains an invalid funding object ID.': 'The matching funding object is missing or could not be verified.',
  'The associated funding object has an unexpected type or owner.': 'The matching funding object is missing or could not be verified.',
  'Creation history is unavailable.': 'Creation history unavailable',
  'SuiNS expiry could not be verified.': 'The mainnet query was incomplete. Retry this address.',
  'The parent SuiNS name is expired or unverifiable.': 'The mainnet query was incomplete. Retry this address.',
  'SuiNS resolver is behind mainnet. Retry shortly.': 'The mainnet query was incomplete. Retry this address.',
  'RPC queue is busy. Please retry shortly.': 'Query failed. Please retry.',
  'Invalid object pagination response.': 'The mainnet query was incomplete. Retry this address.',
  'Invalid object pagination cursor.': 'The mainnet query was incomplete. Retry this address.',
  'Object pagination limit reached; this result is incomplete.': 'The mainnet query was incomplete. Retry this address.',
  'The mainnet provider returned a stale or invalid checkpoint.': 'The mainnet query was incomplete. Retry this address.',
};

export function detectLocale(languages = []) {
  for (const item of languages) {
    const value = String(item).toLowerCase();
    if (value.startsWith('zh-hant') || /^zh-(tw|hk|mo)(-|$)/.test(value)) return 'zh-TW';
    if (value === 'zh' || value.startsWith('zh-')) return 'zh-CN';
    const base = value.split('-')[0];
    if (LOCALES.some(([code]) => code === base)) return base;
  }
  return 'en';
}
export function translate(locale, source, variables = {}) {
  const key = aliases[source] || source;
  const value = COMPLETE[locale]?.[key] || COMPLETE.en[key] || source || '';
  return value.replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? `{${name}}`));
}
export function translateError(locale, source) {
  if (locale === 'en' || COMPLETE[locale]?.[source] || aliases[source]) return translate(locale, source);
  return translate(locale, 'Query failed. Please retry.');
}
export function formatUtc(value, locale = 'en') {
  if (!value || Number.isNaN(new Date(value).getTime())) return '--';
  return `${new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC', hour12: false }).format(new Date(value))} UTC`;
}
