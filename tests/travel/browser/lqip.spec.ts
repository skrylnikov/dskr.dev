import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test.beforeEach(async ({ page }) => {
	await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
});

for (const javaScriptEnabled of [true, false]) {
	test.describe(`CSS placeholders with JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}`, () => {
		test.use({ javaScriptEnabled });
		test('collages, photos and video posters appear before media and keep their layout', async ({ page }, testInfo) => {
			let release!: () => void;
			const blocked = new Promise<void>((resolve) => { release = resolve; });
			await page.route('**/media/**', async (route) => { await blocked; await route.continue(); });
			try {
				await page.goto('/travel/sample-trip/', { waitUntil: 'domcontentloaded' });
				const collage = page.locator('.travel-collage img').first();
				const gallery = page.locator('travel-gallery');
				const photo = gallery.locator('[data-media-index="0"] img');
				const poster = gallery.locator('[data-media-index="4"] img');
				for (const image of [collage, photo, poster]) {
					expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(0);
					await expect(image.locator('..')).toHaveCSS('background-image', /radial-gradient/);
					await expect(image).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
					const ratioError = await image.evaluate((node: HTMLImageElement) => {
						const box = node.getBoundingClientRect();
						return Math.abs(box.height - box.width * Number(node.getAttribute('height')) / Number(node.getAttribute('width')));
					});
					expect(ratioError).toBeLessThan(1);
				}
				await expect(photo).toHaveAttribute('alt', 'Тестовый кадр 0');
				await expect(photo.locator('..')).toHaveAttribute('style', /--lqip-a:#[a-f0-9]{6};.*--lqip-f:#[a-f0-9]{6}/);
				await expect(gallery.locator('[data-media-index="0"]')).toHaveAccessibleName('Открыть фото: Тестовый кадр 0');
				await expect(gallery.locator('.travel-video-badge')).toHaveText('▶ 0:06');
				await collage.scrollIntoViewIfNeeded();
				await page.screenshot({ path: testInfo.outputPath('collage-pending.png') });
				if (javaScriptEnabled) {
					await gallery.locator('[data-show-more]').click();
					await expect(gallery.locator('[data-media-index="6"] picture')).toHaveCSS('background-image', /radial-gradient/);
				}
				await photo.scrollIntoViewIfNeeded();
				await page.screenshot({ path: testInfo.outputPath('gallery-pending.png') });
				const before = await gallery.locator('[data-media-index="0"]').boundingBox();
				release();
				for (const image of [collage, photo, poster]) await image.evaluate((node: HTMLImageElement) => node.decode());
				expect(await gallery.locator('[data-media-index="0"]').boundingBox()).toEqual(before);
				await page.screenshot({ path: testInfo.outputPath('gallery-loaded.png') });
			} finally { release(); }
		});

		test('single photos reserve their actual aspect ratio without placeholder sidebars', async ({ page }, testInfo) => {
			let release!: () => void;
			const blocked = new Promise<void>((resolve) => { release = resolve; });
			await page.route('**/media/**', async (route) => { await blocked; await route.continue(); });
			try {
				await page.goto('/travel/sample-trip/ru-only/', { waitUntil: 'domcontentloaded' });
				const galleries = page.locator('.travel-media-grid--single');
				await expect(galleries).toHaveCount(2);
				const sizes: { width: number; height: number }[] = [];
				for (const gallery of await galleries.all()) {
					const image = gallery.locator('img');
					await image.scrollIntoViewIfNeeded();
					const frame = await image.evaluate((node: HTMLImageElement) => {
						const box = node.getBoundingClientRect(), link = node.closest('a')!.getBoundingClientRect(), grid = node.closest('.travel-media-grid')!.getBoundingClientRect();
						return { width: box.width, height: box.height, expectedHeight: box.width * Number(node.getAttribute('height')) / Number(node.getAttribute('width')), linkWidth: link.width, linkHeight: link.height, viewportHeight: innerHeight, widthLimit: (grid.width - (innerWidth <= 600 ? 8 : 16)) * (innerWidth <= 600 ? .75 : .5), centreError: Math.abs(box.x + box.width / 2 - grid.x - grid.width / 2) };
					});
					expect(Math.abs(frame.height - frame.expectedHeight)).toBeLessThan(1);
					expect(frame.height).toBeLessThanOrEqual(frame.viewportHeight * .6 + 1);
					expect(frame.width).toBeLessThanOrEqual(frame.widthLimit + 1);
					expect(frame.centreError).toBeLessThan(1);
					expect(frame.width).toBe(frame.linkWidth);
					expect(frame.height).toBe(frame.linkHeight);
					sizes.push({ width: frame.width, height: frame.height });
				}
				await page.screenshot({ path: testInfo.outputPath('single-pending.png'), fullPage: true });
				release();
				for (const [index, gallery] of (await galleries.all()).entries()) {
					const image = gallery.locator('img');
					await image.evaluate((node: HTMLImageElement) => node.decode());
					const box = (await image.boundingBox())!;
					expect({ width: box.width, height: box.height }).toEqual(sizes[index]);
				}
				await page.screenshot({ path: testInfo.outputPath('single-loaded.png'), fullPage: true });
			} finally { release(); }
		});
	});
}

test('legacy items retain their normal fallback background', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const image = page.locator('travel-gallery img').first();
	await image.evaluate((node) => node.parentElement!.removeAttribute('style'));
	await expect(image.locator('..')).toHaveCSS('background-image', 'none');
	await expect(image.locator('xpath=../..')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('rendered placeholder retains blue sky and a warm foreground at the same time', async ({ page }) => {
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => { release = resolve; });
	await page.route('**/media/**', async (route) => { await blocked; await route.continue(); });
	try {
		await page.goto('/travel/sample-trip/first-walk/', { waitUntil: 'domcontentloaded' });
		const image = page.locator('travel-gallery img').first();
		await image.evaluate((node) => {
			const palette = ['#96b9dc', '#6090ba', '#adc3dd', '#aa5a3c', '#aa5a3c', '#c09365'];
			node.parentElement!.setAttribute('style', palette.map((colour, index) => `--lqip-${'abcdef'[index]}:${colour}`).join(';'));
		});
		const { data, info } = await sharp(await image.screenshot({ scale: 'css' })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
		const sample = (y: number) => {
			const offset = (Math.floor(info.height * y) * info.width + Math.floor(info.width / 2)) * info.channels;
			return [...data.subarray(offset, offset + 3)];
		};
		const top = sample(.25), bottom = sample(.75);
		expect(top[2] - top[0]).toBeGreaterThan(20);
		expect(bottom[0] - bottom[2]).toBeGreaterThan(15);
	} finally { release(); }
});
