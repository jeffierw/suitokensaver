import { normalizeInput } from '../shared/validation.mjs';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function handleLiveApi(request, { resolveName, scanAddress }) {
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== url.host) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
  if (request.method !== 'POST') return json({ error: 'Unknown API route.' }, 404);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (url.pathname === '/api/resolve') {
    const input = normalizeInput(body?.input);
    if (!input.valid) return json({ error: input.error }, 400);
    try {
      const address = input.kind === 'name' ? await resolveName(input.value) : input.value;
      return json({ input: input.input, name: input.kind === 'name' ? input.value : null, address });
    } catch (error) { return json({ error: error.message }, 422); }
  }
  if (url.pathname === '/api/scan') {
    const input = normalizeInput(body?.address);
    if (!input.valid || input.kind !== 'address') return json({ error: 'A full Sui address is required.' }, 400);
    try { return json(await scanAddress(input.value)); }
    catch (error) { return json({ error: error.message }, 502); }
  }
  return json({ error: 'Unknown API route.' }, 404);
}
