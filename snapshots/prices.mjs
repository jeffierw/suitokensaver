export const PRICE_IDS = { WAL: 'walrus-2', DEEP: 'deep', NS: 'suins-token' };
export const QUOTE_MAX_AGE = 20 * 60 * 1000;
export const USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
export const CETUS_TOKENS = {
  WAL: { type: '0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL', decimals: 9, amount: '10000000000' },
  DEEP: { type: '0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP', decimals: 6, amount: '100000000' },
  NS: { type: '0x5145494a5f5100e645e4b0aa950fa6b68f614e8c59e17bc5ded3495123a79178::ns::NS', decimals: 6, amount: '100000000' },
};

function micros(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000000) return null;
  const fixed = value.toFixed(8);
  const amount = BigInt(fixed.replace('.', ''));
  return amount > 0n ? amount.toString() : null;
}
export function parseQuotes(data, now = Date.now()) {
  return Object.fromEntries(Object.entries(PRICE_IDS).map(([symbol, id]) => {
    const entry = data?.[id];
    const updatedAt = entry?.last_updated_at * 1000;
    const price = micros(entry?.usd);
    return [symbol, price && Number.isFinite(updatedAt) && now - updatedAt <= QUOTE_MAX_AGE && updatedAt <= now + 60000
      ? { price, scale: 8, updatedAt, source: 'CoinGecko', id } : null];
  }));
}
export function parseDefiLlamaQuotes(data, now = Date.now()) {
  return Object.fromEntries(Object.entries(PRICE_IDS).map(([symbol, id]) => {
    const entry = data?.coins?.[`coingecko:${id}`];
    const updatedAt = entry?.timestamp * 1000;
    const price = micros(entry?.price);
    return [symbol, price && Number.isFinite(updatedAt) && now - updatedAt <= QUOTE_MAX_AGE && updatedAt <= now + 60000
      ? { price, scale: 8, updatedAt, source: 'DefiLlama', id } : null];
  }));
}
export function quoteValue(amount, decimals, quote, now = Date.now(), allowStale = false) {
  if (!quote || (!allowStale && now - quote.updatedAt > QUOTE_MAX_AGE) || quote.updatedAt > now + 60000) return null;
  return (BigInt(amount) * BigInt(quote.price) * 100n / (10n ** BigInt(decimals + quote.scale))).toString();
}
function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? BigInt(value) : null;
}
export function parseCetusRoute(token, data, now = Date.now()) {
  const config = CETUS_TOKENS[token];
  const route = data?.data;
  const input = positiveInteger(route?.amount_in);
  const output = positiveInteger(route?.amount_out);
  const deviation = Number(route?.deviation_ratio);
  const paths = route?.paths;
  if (!config || !input || !output || !Array.isArray(paths) || !paths.length
      || !Number.isFinite(deviation) || Math.abs(deviation) > 0.1
      || paths[0].from !== config.type || paths.at(-1).target !== USDC_TYPE
      || paths.some((path, index) => index > 0 && path.from !== paths[index - 1].target)) return null;
  const expectedInput = BigInt(config.amount);
  if (input !== expectedInput) return null;
  const price = output * (10n ** BigInt(config.decimals)) * 100000000n / (input * 1000000n);
  if (price <= 0n) return null;
  const providers = [...new Set(paths.map((path) => path.provider).filter((provider) => typeof provider === 'string'))];
  return {
    price: price.toString(), scale: 8, updatedAt: now, source: 'Cetus Aggregator',
    id: config.type, providers, reference: { input: config.amount, token, output: output.toString(), asset: 'USDC', deviation },
  };
}
export async function fetchCetusQuote(token, fetchImpl = fetch, now = Date.now()) {
  const config = CETUS_TOKENS[token];
  if (!config) return null;
  const params = new URLSearchParams({ from: config.type, target: USDC_TYPE, amount: config.amount, by_amount_in: 'true', split_count: '1', v: '1999999' });
  const response = await fetchImpl(`https://api-sui.cetus.zone/router_v3/find_routes?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  return parseCetusRoute(token, await response.json(), now);
}
export async function fetchQuotes(fetchImpl = fetch, now = Date.now()) {
  const ids = Object.values(PRICE_IDS).map((id) => `coingecko:${id}`).join(',');
  let quotes = Object.fromEntries(Object.keys(PRICE_IDS).map((token) => [token, null]));
  try {
    const response = await fetchImpl(`https://coins.llama.fi/prices/current/${ids}`, { signal: AbortSignal.timeout(15000) });
    if (response.ok) quotes = parseDefiLlamaQuotes(await response.json(), now);
  } catch {}
  await Promise.all(Object.keys(quotes).filter((token) => !quotes[token] || now - quotes[token].updatedAt > 5 * 60000).map(async (token) => {
    try { quotes[token] = await fetchCetusQuote(token, fetchImpl, now) || quotes[token]; }
    catch {}
  }));
  return { id: crypto.randomUUID(), fetchedAt: new Date(now).toISOString(), quotes };
}
