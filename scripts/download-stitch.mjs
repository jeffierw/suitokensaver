import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = await fs.readFile(path.join(root, '.codex/config.toml'), 'utf8');
const apiKey = config.match(/"X-Goog-Api-Key"\s*=\s*"([^"]+)"/)?.[1];
if (!apiKey) throw new Error('Missing Stitch API key in .codex/config.toml');

const projectId = '5510102675825052347';
const screens = [
  ['da0ba2ea27a342dc9a6e7ddd7dfd5772', '01-favicon-logo'],
  ['b22535e42e7c4edeb3f555e680a85552', '02-unclaimed-scanner'],
  ['a47505e0e31d4ca78d09f2f7c5a63161', '03-unclaimed-vault'],
  ['c3307b70942d43e887e5f74f7c94fe0a', '04-move-claim-spec'],
  ['76d6f9aa067b45c4a20214043c2b5a7a', '05-ai-signer-skill-prompt'],
];

async function callTool(name, args) {
  const response = await fetch('https://stitch.googleapis.com/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: name,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`Stitch HTTP ${response.status}`);
  const envelope = await response.json();
  if (envelope.error || envelope.result?.isError) {
    throw new Error(JSON.stringify(envelope.error ?? envelope.result));
  }
  const result = envelope.result;
  if (result.structuredContent) return result.structuredContent;
  for (const content of result.content ?? []) {
    if (content.type === 'text') {
      try {
        return JSON.parse(content.text);
      } catch {}
    }
  }
  throw new Error('No structured screen data returned');
}

const exportDir = path.join(root, 'design/stitch');
await fs.mkdir(exportDir, { recursive: true });
const project = await callTool('get_project', { name: `projects/${projectId}` });
await fs.writeFile(path.join(exportDir, 'project.json'), JSON.stringify(project, null, 2));
for (const [screenId, folder] of screens) {
  const screen = await callTool('get_screen', {
    name: `projects/${projectId}/screens/${screenId}`,
  });
  const directory = path.join(exportDir, folder);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'screen.json'), JSON.stringify(screen, null, 2));
  console.log(folder, 'fields:', Object.keys(screen).join(', '));
  for (const [field, filename] of [['screenshot', 'screenshot.png'], ['htmlCode', 'index.html']]) {
    let url = screen[field]?.downloadUrl;
    if (!url) {
      console.log(`  ${field}: no hosted download available`);
      continue;
    }
    if (new URL(url).protocol !== 'https:') throw new Error('Expected HTTPS download');
    if (new URL(url).origin === 'https://stitch.googleapis.com') {
      const response = await fetch(url, {
        headers: { 'X-Goog-Api-Key': apiKey },
        redirect: 'manual',
        signal: AbortSignal.timeout(60000),
      });
      if (response.status >= 300 && response.status < 400) {
        url = new URL(response.headers.get('location'), url).href;
      } else {
        if (!response.ok) throw new Error(`Download HTTP ${response.status}`);
        let bytes = Buffer.from(await response.arrayBuffer());
        if (response.headers.get('content-type')?.includes('application/json')) {
          const payload = JSON.parse(bytes.toString('utf8'));
          if (typeof payload.dataString !== 'string') throw new Error('Missing file data');
          bytes = payload.dataString.trimStart().startsWith('<')
            ? Buffer.from(payload.dataString, 'utf8')
            : Buffer.from(payload.dataString, 'base64');
        }
        if (!bytes.length) throw new Error(`Empty download: ${folder}/${filename}`);
        const actualFilename = field === 'htmlCode' && bytes.toString('utf8').trimStart().startsWith('<svg')
          ? 'logo.svg' : filename;
        await fs.writeFile(path.join(directory, actualFilename), bytes);
        if (actualFilename !== filename) await fs.rm(path.join(directory, filename), { force: true });
        console.log(`  ${actualFilename}: ${bytes.length} bytes`);
        continue;
      }
    }
    execFileSync('curl', [
      '--fail', '--silent', '--show-error', '--location',
      '--retry', '2', '--max-time', '120', '--proto', '=https',
      '--proto-redir', '=https', '--output', path.join(directory, filename), url,
    ], { stdio: 'pipe' });
    const { size } = await fs.stat(path.join(directory, filename));
    if (!size) throw new Error(`Empty download: ${folder}/${filename}`);
    console.log(`  ${filename}: ${size} bytes`);
  }
}
