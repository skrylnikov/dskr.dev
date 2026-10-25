import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';

export default defineConfig({
	testDir: './tests/browser',
	outputDir: '../../.state/admin-test-results',
	workers: 1,
	timeout: 60_000,
	expect: { timeout: 15_000 },
	use: {
		baseURL: 'http://127.0.0.1:4322',
		viewport: { width: 1440, height: 1000 },
		screenshot: 'only-on-failure',
	},
	webServer: {
		command:
			'node --import tsx services/admin/tests/fixtures.mts && node --import tsx services/admin/server.ts',
		cwd: resolve(import.meta.dirname, '../..'),
		env: {
			ADMIN_CONTENT_ROOT: resolve(
				import.meta.dirname,
				'../../.state/admin-e2e/content',
			),
			ADMIN_STATE_ROOT: resolve(
				import.meta.dirname,
				'../../.state/admin-e2e/state',
			),
		},
		url: 'http://127.0.0.1:4322',
		reuseExistingServer: false,
		timeout: 90_000,
	},
});
