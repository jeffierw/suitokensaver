import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeInput } from '../shared/validation.mjs';
import { resolveName } from './chain.mjs';
import { scanAddress } from './scanner.mjs';
import { handleSnapshot } from './snapshots.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/api', (request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const origin = request.headers.origin;
  if (origin && new URL(origin).host !== request.headers.host) {
    return response.status(403).json({ error: 'Cross-origin requests are not allowed.' });
  }
  next();
});
let activeScans = 0;
const requests = new Map();
app.use('/api', (request, response, next) => {
  const now = Date.now();
  for (const [key, value] of requests) if (value.until <= now) requests.delete(key);
  const key = request.ip;
  const bucket = requests.get(key) || { count: 0, until: now + 60000 };
  bucket.count++;
  requests.set(key, bucket);
  if (bucket.count > 100) return response.status(429).json({ error: 'Too many queries. Please wait a minute.' });
  next();
});
app.post('/api/resolve', async (request, response) => {
  const input = normalizeInput(request.body?.input);
  if (!input.valid) return response.status(400).json({ error: input.error });
  try {
    const address = input.kind === 'name' ? await resolveName(input.value) : input.value;
    response.json({ input: input.input, name: input.kind === 'name' ? input.value : null, address });
  } catch (error) {
    response.status(422).json({ error: error.message });
  }
});
app.post('/api/scan', async (request, response) => {
  const input = normalizeInput(request.body?.address);
  if (!input.valid || input.kind !== 'address') return response.status(400).json({ error: 'A full Sui address is required.' });
  if (activeScans >= 6) return response.status(429).json({ error: 'The scanner is busy. Retry this address shortly.' });
  activeScans++;
  try {
    response.json(await scanAddress(input.value));
  } catch (error) {
    response.status(502).json({ error: error.message });
  } finally {
    activeScans--;
  }
});
app.use('/api/snapshots', handleSnapshot);
app.use('/api', (request, response) => response.status(404).json({ error: 'Unknown API route.' }));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (request, response) => response.sendFile(path.join(root, 'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);
  response.status(error.status === 413 ? 413 : 400).json({ error: 'Invalid request.' });
});
const port = Number(process.env.PORT || 4173);
app.listen(port, '127.0.0.1', () => console.log(`Sui Token Saver: http://localhost:${port}`));
