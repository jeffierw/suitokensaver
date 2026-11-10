export async function scanBatch(inputs, { resolve, scan, signal, onProgress = () => {} }) {
  const errors = [];
  const addresses = new Map();
  const results = [];
  const check = () => signal?.throwIfAborted();
  async function pool(entries, task) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, entries.length) }, async () => {
      while (next < entries.length) {
        check();
        const entry = entries[next++];
        await task(entry);
        check();
      }
    }));
  }
  check();
  await pool(inputs, async (input) => {
    try {
      const { address } = await resolve(input, signal);
      if (!addresses.has(address)) addresses.set(address, []);
      addresses.get(address).push(input);
    } catch (error) {
      check();
      errors.push({ inputs: [input], error: error.message });
    }
  });
  let done = 0;
  onProgress({ done, total: addresses.size });
  await pool([...addresses], async ([address, aliases]) => {
    try {
      const result = await scan(address, signal);
      results.push({ ...result, inputs: aliases });
    } catch (error) {
      check();
      errors.push({ inputs: aliases, address, error: error.message });
    }
    onProgress({ done: ++done, total: addresses.size });
  });
  check();
  return { results, errors };
}
