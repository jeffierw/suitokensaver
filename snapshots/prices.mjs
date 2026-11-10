export const PRICE_IDS = { WAL: 'walrus-2', DEEP: 'deep', NS: 'suins-token' };
export const QUOTE_MAX_AGE = 20 * 60 * 1000;

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
export function quoteValue(amount, decimals, quote, now = Date.now()) {
  if (!quote || now - quote.updatedAt > QUOTE_MAX_AGE || quote.updatedAt > now + 60000) return null;
  return (BigInt(amount) * BigInt(quote.price) * 100n / (10n ** BigInt(decimals + quote.scale))).toString();
}
export async function fetchQuotes(env = {}) {
  const headers = {};
  if (env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(PRICE_IDS).join(',')}&vs_currencies=usd&include_last_updated_at=true`, {
    headers, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Quote provider HTTP ${response.status}`);
  return { id: crypto.randomUUID(), fetchedAt: new Date().toISOString(), quotes: parseQuotes(await response.json()) };
}
