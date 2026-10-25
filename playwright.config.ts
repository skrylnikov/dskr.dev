import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/travel/browser',
	outputDir: '.state/travel-test-results',
	workers: 1,
	use: { baseURL: 'http://127.0.0.1:4399', screenshot: 'only-on-failure' },
	webServer: {
		command: 'pnpm travel:fixtures && TRAVEL_TEST_BUILD=1 TRAVEL_CONTENT_ROOT=.state/travel-fixtures pnpm build && node tests/travel/server.mjs',
		url: 'http://127.0.0.1:4399/travel/',
		reuseExistingServer: false,
	},
	projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
});
