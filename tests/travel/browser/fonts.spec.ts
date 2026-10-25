import { test, expect } from '@playwright/test';

for (const { path, preloads } of [{ path: '/', preloads: 2 }, { path: '/en/', preloads: 1 }]) {
	test(`local fonts load without Google on ${path}`, async ({ page }) => {
		const googleRequests: string[] = [];
		const fontRequests: string[] = [];
		page.on('request', (request) => {
			if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) googleRequests.push(request.url());
			if (request.resourceType() === 'font') fontRequests.push(request.url());
		});
		await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
		await page.goto(path);
		const preload = page.locator('link[rel="preload"][as="font"]');
		await expect(preload).toHaveCount(preloads);
		for (const link of await preload.all()) {
			await expect(link).toHaveAttribute('href', /^\/_astro\/.+\.woff2$/);
			await expect(link).toHaveAttribute('crossorigin', '');
		}

		const loaded = await page.evaluate(async () => {
			await document.fonts.ready;
			const result = [];
			for (const font of ['400 16px "IBM Plex Sans"', '650 16px "IBM Plex Sans"', 'italic 400 16px "IBM Plex Sans"', 'italic 700 16px "IBM Plex Sans"', '400 16px "IBM Plex Mono"', '700 16px "IBM Plex Mono"']) {
				const faces = await document.fonts.load(font, 'Hello Привет Ёж №');
				result.push({ font, loaded: faces.length > 0 && faces.every((face) => face.status === 'loaded') });
			}
			return result;
		});
		for (const face of loaded) expect(face.loaded, face.font).toBe(true);
		expect(googleRequests).toEqual([]);
		expect(fontRequests.length).toBeGreaterThan(0);
		for (const url of fontRequests) {
			expect(new URL(url).origin).toBe(new URL(page.url()).origin);
			expect(new URL(url).pathname).toMatch(/^\/_astro\/.+\.woff2$/);
		}
		expect(new Set(fontRequests).size, 'preloads must be reused without duplicate requests').toBe(fontRequests.length);
	});
}
