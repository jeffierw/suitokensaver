import { fetchQuotes, PRICE_IDS } from './prices.mjs';

export async function refreshPrices(store, fetcher = fetchQuotes, now = Date.now()) {
  const previous = await store.get('prices.json');
  const age = now - Date.parse(previous?.fetchedAt);
  if (age >= 0 && age < 60000) return previous;
  let current;
  try { current = await fetcher(); }
  catch { current = { id: crypto.randomUUID(), quotes: {} }; }
  const quotes = Object.fromEntries(Object.keys(PRICE_IDS).map((symbol) => [
    symbol, current.quotes[symbol] || previous?.quotes?.[symbol] || null,
  ]));
  const result = { ...current, fetchedAt: new Date(now).toISOString(), quotes };
  await store.putQuote(result);
  return result;
}
