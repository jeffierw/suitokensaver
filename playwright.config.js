import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  use: { baseURL: 'http://localhost:4173' },
  webServer: { command: 'npm run dev', url: 'http://localhost:4173', reuseExistingServer: true },
});
