import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
});

test('photos fade over the placeholder after decode, including collages, posters and revealed tiles', async ({ page }, testInfo) => {
	await page.addInitScript(() => {
		document.addEventListener('transitionrun', (event) => {
			const image = event.target;
			if (!(image instanceof HTMLImageElement) || !image.parentElement?.matches('picture[data-media-state]')) return;
			for (const animation of image.getAnimations()) { animation.pause(); animation.currentTime = 0; }
		}, true);
	});
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => { release = resolve; });
	await page.route('**/media/**', async (route) => { await blocked; await route.continue(); });
	try {
		await page.goto('/travel/sample-trip/', { waitUntil: 'domcontentloaded' });
		await page.locator('travel-gallery [data-show-more]').click();
		const images = [page.locator('.travel-collage img').first(), ...[0, 4, 6].map((index) => page.locator(`travel-gallery [data-media-index="${index}"] img`))];
		for (const image of images) {
			await expect(image.locator('..')).toHaveAttribute('data-media-state', 'loading');
			await expect(image).toHaveCSS('opacity', '0');
			await expect(image.locator('..')).toHaveCSS('background-image', /radial-gradient/);
		}
		const photo = images[1];
		await photo.scrollIntoViewIfNeeded();
		const before = await photo.boundingBox();
		await page.screenshot({ path: testInfo.outputPath('reveal-before.png') });
		release();
		for (const image of images) {
			await expect(image.locator('..')).toHaveAttribute('data-media-state', 'ready');
			await expect.poll(() => image.evaluate((node) => node.getAnimations().length)).toBe(1);
			const timing = await image.evaluate((node: HTMLImageElement) => {
				const animation = node.getAnimations()[0];
				animation.currentTime = 210;
				return { decoded: node.naturalWidth > 0, duration: animation.effect!.getTiming().duration, opacity: Number(getComputedStyle(node).opacity) };
			});
			expect(timing.decoded).toBe(true);
			expect(timing.duration).toBe(420);
			expect(timing.opacity).toBeGreaterThan(.3);
			expect(timing.opacity).toBeLessThan(.98);
		}
		expect(await photo.boundingBox()).toEqual(before);
		await page.screenshot({ path: testInfo.outputPath('reveal-middle.png') });
		for (const image of images) {
			await image.evaluate((node) => node.getAnimations().forEach((animation) => animation.finish()));
			await expect(image).toHaveCSS('opacity', '1');
		}
		await page.screenshot({ path: testInfo.outputPath('reveal-after.png') });
	} finally { release(); }
});

test('reduced motion reveals decoded photos without a transition', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => { release = resolve; });
	await page.route('**/media/**', async (route) => { await blocked; await route.continue(); });
	try {
		await page.goto('/travel/sample-trip/first-walk/', { waitUntil: 'domcontentloaded' });
		const image = page.locator('travel-gallery img').first();
		await image.scrollIntoViewIfNeeded();
		await expect(image).toHaveCSS('opacity', '0');
		release();
		await expect(image.locator('..')).toHaveAttribute('data-media-state', 'ready');
		await expect(image).toHaveCSS('opacity', '1');
		expect(await image.evaluate((node) => node.getAnimations().length)).toBe(0);
	} finally { release(); }
});

test('already loaded photos stay visible when the page is initialized again', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const image = page.locator('travel-gallery img').first();
	await image.evaluate(async (node: HTMLImageElement) => {
		await node.decode();
		node.getAnimations().forEach((animation) => animation.finish());
		node.parentElement!.removeAttribute('data-media-state');
		document.dispatchEvent(new Event('astro:page-load'));
	});
	await expect(image).toHaveCSS('opacity', '1');
	await expect(image.locator('..')).not.toHaveAttribute('data-media-state', 'loading');
	expect(await image.evaluate((node) => node.getAnimations().length)).toBe(0);
});

test('Astro navigation initializes new placeholders and failed images remain usable', async ({ page }) => {
	await page.goto('/travel/');
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => { release = resolve; });
	await page.route('**/media/**', async (route) => { await blocked; await route.fulfill({ status: 404 }); });
	try {
		await page.locator('.travel-card-link').first().click();
		await expect(page).toHaveURL(/\/travel\/sample-trip\/$/);
		const link = page.locator('travel-gallery [data-media-index="4"]');
		const image = link.locator('img');
		await image.scrollIntoViewIfNeeded();
		await expect(image.locator('..')).toHaveAttribute('data-media-state', 'loading');
		release();
		await expect(link).toHaveClass(/travel-media-error/);
		await expect(image).toHaveCSS('opacity', '1');
		await expect(image.locator('..')).not.toHaveAttribute('data-media-state', 'loading');
		await expect(image.locator('..')).toHaveCSS('background-image', /radial-gradient/);
		await expect(link).toHaveAttribute('href', /video.mp4$/);
	} finally { release(); }
});
