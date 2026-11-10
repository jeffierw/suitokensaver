import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fetchQuotes } from '../snapshots/prices.mjs';

const directory = path.resolve(process.env.SNAPSHOT_DIR || '.snapshots');
const quotes = await fetchQuotes(process.env);
await mkdir(path.join(directory, 'quotes'), { recursive: true });
await writeFile(path.join(directory, 'quotes', `${quotes.id}.json`), JSON.stringify(quotes));
await writeFile(path.join(directory, `prices-${quotes.id}.tmp`), JSON.stringify(quotes));
await rename(path.join(directory, `prices-${quotes.id}.tmp`), path.join(directory, 'prices.json'));
console.log(JSON.stringify(quotes, null, 2));
