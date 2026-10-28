import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test.beforeEach(async ({ page }) => {
	// External font availability must not block local media tests.
	await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ contentType: 'text/css', body: '' }));
});

test('six-photo collages preserve portrait and landscape frames on every surface', async ({ page }) => {
	for (const path of ['/', '/travel/', '/travel/sample-trip/']) {
		await page.goto(path);
		const collages = page.locator('.travel-collage');
		expect(await collages.count()).toBeGreaterThan(0);
		for (const collage of await collages.all()) {
			await collage.scrollIntoViewIfNeeded();
			await expect(collage.locator('img')).toHaveCount(6);
			const frames = await collage.locator('img').evaluateAll(async (images: HTMLImageElement[]) => {
				await Promise.all(images.map((image) => image.decode()));
				return images.map((image) => {
					const frame = image.getBoundingClientRect(), picture = image.parentElement!.getBoundingClientRect();
					return { error: Math.abs(frame.height - frame.width * image.naturalHeight / image.naturalWidth), clip: Math.abs(picture.height - frame.height), fit: getComputedStyle(image).objectFit };
				});
			});
			for (const frame of frames) { expect(frame.error).toBeLessThan(1); expect(frame.clip).toBeLessThan(1); expect(frame.fit).toBe('contain'); }
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	}
	await page.goto('/travel/sample-trip/first-walk/');
	await expect(page.locator('.travel-collage')).toHaveCount(0);
	await expect(page.locator('.travel-prose travel-gallery')).toHaveCount(1);
});

test('gallery rows fit mixed aspect ratios without gaps or cropping', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const gallery = page.locator('travel-gallery');
	await expect(gallery.locator('.travel-media-grid')).toHaveAttribute('data-layout', '');
	{
		const rows = await gallery.locator('.travel-media-grid').evaluate((grid) => {
			const bounds = grid.getBoundingClientRect();
			const rows: { top: number; left: number; right: number; height: number; ratioError: number }[][] = [];
			for (const figure of grid.querySelectorAll('figure')) {
				const link = figure.querySelector('a')!, image = link.querySelector('img')!;
				const box = link.getBoundingClientRect();
				const item = { top: box.top, left: box.left - bounds.left, right: bounds.right - box.right, height: box.height, ratioError: Math.abs(box.width / box.height - Number(image.getAttribute('width')) / Number(image.getAttribute('height'))) };
				const row = rows.find((row) => Math.abs(row[0].top - item.top) < 1);
				if (row) row.push(item); else rows.push([item]);
			}
			return rows;
		});
		expect(rows.length).toBeGreaterThan(1);
		for (const [index, row] of rows.entries()) {
			expect(row[0].left).toBeLessThan(1);
			if (index < rows.length - 1) expect(row.at(-1)!.right).toBeLessThan(1);
			for (const item of row) {
				expect(Math.abs(item.height - row[0].height)).toBeLessThan(1);
				expect(item.ratioError).toBeLessThan(.01);
			}
		}
	}
	const viewport = page.viewportSize()!;
	await page.setViewportSize({ ...viewport, width: viewport.width - 100 });
	await expect.poll(async () => {
		const layout = await gallery.locator('.travel-media-grid').evaluate((grid) => ({
			width: grid.clientWidth,
			minimum: parseFloat(getComputedStyle(document.documentElement).fontSize) * (matchMedia('(max-width: 600px)').matches ? 9 : 14),
			items: [...grid.querySelectorAll('img')].map((image) => ({ width: Number(image.getAttribute('width')), height: Number(image.getAttribute('height')), actualHeight: image.getBoundingClientRect().height })),
		}));
		return Math.min(...layout.items.map((item) => item.actualHeight - Math.min(layout.minimum, layout.width * item.height / item.width)));
	}).toBeGreaterThan(-1);
});

test('localized routes, mixed feed, drafts, language fallback and home placement', async ({ page }) => {
	await page.goto('/travel/sample-trip/');
	expect(await page.locator('.travel-feed > article').evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual(['chapter-first-walk', 'note-evening', 'chapter-ru-only']);
	await expect(page.locator('#note-evening')).toContainText('A short evening note.');
	await expect(page.locator('#note-evening h2')).toHaveCount(0);
	await expect(page.locator('body')).not.toContainText('MUST NOT LEAK');
	await expect(page.locator('.site-nav a.active')).toHaveText('Путешествия');
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://dskr.dev/travel/sample-trip/');
	await page.goto('/travel/sample-trip/ru-only/');
	await expect(page.locator('.language-switch')).toHaveAttribute('href', '/en/travel/');
	await page.goto('/en/travel/sample-trip/first-walk/');
	await expect(page.locator('h1')).toHaveText('A walk');
	await expect(page.locator('.language-switch')).toHaveAttribute('href', '/travel/sample-trip/first-walk/');
	await page.goto('/');
	expect(await page.locator('main > section').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-labelledby')))).toEqual([null, 'latest-heading', 'latest-trip-heading', 'projects-heading']);
	const sitemap = await readFile('.state/travel-dist/sitemap-0.xml', 'utf8');
	expect(sitemap).not.toContain('draft-trip'); expect(sitemap).not.toContain('/en/travel/sample-trip/ru-only/'); expect(sitemap).not.toContain('/evening/');
});

test('JPEG XL sources precede fallbacks and the viewer follows browser decoding support', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const picture = page.locator('travel-gallery picture').first();
	await expect(picture.locator('source').first()).toHaveAttribute('type', 'image/jxl');
	await picture.scrollIntoViewIfNeeded();
	const supportsJxl = await picture.locator('img').evaluate(async (image: HTMLImageElement) => { await image.decode(); return image.currentSrc.endsWith('.jxl'); });
	await page.locator('travel-gallery [data-media-index="0"]').click();
	await expect(page.locator('.gslide.current .gslide-image img')).toHaveAttribute('src', supportsJxl ? /\.jxl$/ : /\.jpeg$/);
	await expect(page.locator('.gslide.current .gslide-image img')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.locator('[data-media-index="6"] source').first()).toHaveAttribute('type', 'image/jxl');
});

test('gallery media links do not prefetch on hover or focus', async ({ page }) => {
	const prefetched: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/media/') && request.resourceType() !== 'image') prefetched.push(request.url());
	});
	await page.goto('/travel/sample-trip/first-walk/');
	const gallery = page.locator('travel-gallery');
	for (const index of [0, 4, 6]) {
		const link = gallery.locator(`[data-media-index="${index}"]`);
		await expect(link).toHaveAttribute('data-astro-prefetch', 'false');
		await link.hover();
		await link.focus();
		// Astro starts hover/focus prefetch after 80 ms.
		await page.waitForTimeout(200);
	}
	expect(prefetched).toEqual([]);
});

test('video posters use picture formats in thumbnails and JXL in the viewer', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const gallery = page.locator('travel-gallery');
	for (const index of [4, 199]) {
		const thumbnail = gallery.locator(`[data-media-index="${index}"]`);
		await expect(thumbnail.locator('source').first()).toHaveAttribute('type', 'image/jxl');
		await expect(thumbnail.locator('source').nth(1)).toHaveAttribute('type', 'image/webp');
		await thumbnail.scrollIntoViewIfNeeded();
		const usesJxl = await thumbnail.locator('img').evaluate(async (image: HTMLImageElement) => { await image.decode(); return image.currentSrc.endsWith('.jxl'); });
		await thumbnail.click();
		await expect(page.locator('.gslide.current video')).toHaveAttribute('poster', usesJxl ? /\.jxl$/ : /\.jpeg$/);
		await page.keyboard.press('Escape');
	}
});

test('viewer keeps JPEG fallback when JPEG XL decoding is unavailable', async ({ page }) => {
	await page.addInitScript(() => {
		const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
		Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descriptor, set(value: string) {
			descriptor.set!.call(this, value.startsWith('data:image/jxl;') ? 'data:image/jxl;base64,invalid' : value);
		} });
	});
	await page.goto('/travel/sample-trip/first-walk/');
	await page.locator('travel-gallery [data-media-index="0"]').click();
	await expect(page.locator('.gslide.current .gslide-image img')).toHaveAttribute('src', /\.jpeg$/);
	await expect.poll(() => page.locator('.gslide.current .gslide-image img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
});

for (const { index, reduced, cached } of [{ index: 0, reduced: false, cached: false }, { index: 2, reduced: false, cached: false }, { index: 0, reduced: true, cached: false }, { index: 0, reduced: false, cached: true }]) {
	test(`photo preview stays visible until full-size decode (${index}${reduced ? ', reduced motion' : ''}${cached ? ', cached' : ''})`, async ({ page }, testInfo) => {
		await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
		await page.goto('/travel/sample-trip/first-walk/');
		// Give viewer images distinct URLs so even cached thumbnails cannot satisfy them.
		if (!cached) await page.locator('travel-gallery').evaluate((gallery) => {
			const script = gallery.querySelector('[data-gallery-items]')!;
			const items = JSON.parse(script.textContent!);
			for (const item of items) if (item.kind === 'image') for (const source of item.sources) source.url += '?full-size';
			script.textContent = JSON.stringify(items);
			gallery.replaceWith(gallery.cloneNode(true));
		});
		let release!: () => void;
		const pending = new Promise<void>((resolve) => { release = resolve; });
		await page.route((url) => url.searchParams.has('full-size'), async (route) => { await pending; await route.continue(); });
		const trigger = page.locator(`travel-gallery [data-media-index="${index}"]`);
		await trigger.scrollIntoViewIfNeeded();
		const thumbnail = await trigger.locator('img').evaluate(async (image: HTMLImageElement) => { await image.decode(); return image.currentSrc; });
		const origin = await trigger.locator('img').boundingBox();
		if (!reduced && !cached) await page.evaluate(() => {
			const animate = Element.prototype.animate;
			Element.prototype.animate = function (keyframes, options) {
				const animation = animate.call(this, keyframes, options);
				if (this.matches('.travel-viewer-preview') && (keyframes as Keyframe[]).some((frame) => frame.opacity === 0)) {
					const slide = document.querySelector('.gslide.current')!;
					(this as HTMLElement).dataset.backingAnimation = getComputedStyle(slide).animationName;
					animation.pause(); animation.currentTime = 110;
				}
				return animation;
			};
		});
		if (!reduced) await page.evaluate(() => {
			const observer = new MutationObserver(() => {
				const preview = document.querySelector('.travel-viewer-preview');
				const flight = preview?.getAnimations()[0];
				if (!flight) return;
				flight.pause(); flight.currentTime = 0;
				observer.disconnect();
			});
			observer.observe(document.body, { attributes: true, childList: true, subtree: true });
		});
		try {
			await trigger.click();
			const preview = page.locator('.travel-viewer-preview');
			await expect(preview).toBeVisible();
			await expect(preview).toHaveAttribute('src', thumbnail);
			await expect(preview).toHaveAttribute('aria-hidden', 'true');
			await expect(page.locator('.gloader')).toBeHidden();
			if (reduced) expect(await preview.evaluate((image) => image.getAnimations().length)).toBe(0);
			else {
				const start = await preview.evaluate((image) => {
					const box = image.getBoundingClientRect();
					const crop = getComputedStyle(image).clipPath.match(/^inset\(([\d.]+)%(?: ([\d.]+)%)?/)!;
					const x = Number(crop[2] ?? crop[1]) / 100, y = Number(crop[1]) / 100;
					return { x: box.x + box.width * x, y: box.y + box.height * y, width: box.width * (1 - 2 * x), height: box.height * (1 - 2 * y) };
				});
				for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(start[key] - origin![key])).toBeLessThan(1);
				await expect(page.locator('.travel-viewer-opening .gslide-image')).toHaveCSS('opacity', '0');
				await page.screenshot({ path: testInfo.outputPath('photo-flight-start.png') });
				await preview.evaluate((image) => { const flight = image.getAnimations()[0]; flight.currentTime = Number(flight.effect!.getTiming().duration) / 2; });
				await page.screenshot({ path: testInfo.outputPath('photo-flight-middle.png') });
			}
			await expect(page.locator('.gclose')).toBeFocused();
			const destination = await preview.evaluate((image) => {
				for (const animation of image.getAnimations()) animation.finish();
				return image.getBoundingClientRect().toJSON();
			});
			expect(destination.left).toBeGreaterThanOrEqual(-1); expect(destination.top).toBeGreaterThanOrEqual(-1);
			expect(destination.right).toBeLessThanOrEqual(page.viewportSize()!.width + 1); expect(destination.bottom).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
			await page.screenshot({ path: testInfo.outputPath('photo-preview.png'), animations: 'disabled' });
			release();
			if (!reduced && !cached) {
				await expect(preview).toHaveAttribute('data-backing-animation', 'none');
				await expect(page.locator('.gslide.current')).toHaveCSS('opacity', '1');
				await preview.evaluate((image) => image.getAnimations().forEach((animation) => animation.finish()));
			}
			await expect(preview).toHaveCount(0);
			await expect.poll(() => page.locator('.gslide.current .gslide-image img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
			await page.locator('.gslide.current').evaluate(async (slide) => { await Promise.allSettled(slide.getAnimations().map((animation) => animation.finished)); });
			const full = page.locator('.gslide.current .gslide-image img');
			const finalBounds = await full.boundingBox();
			for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(destination[key] - finalBounds![key])).toBeLessThan(1);
			const caption = page.locator('.gslide.current .gslide-description');
			await expect(caption).toBeVisible();
			const captionBounds = await caption.boundingBox();
			expect(captionBounds!.y).toBeGreaterThanOrEqual(finalBounds!.y + finalBounds!.height - 1);
			expect(captionBounds!.y + captionBounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
			if (testInfo.project.name === 'desktop' && index === 0 && !cached && !reduced) {
				await full.click();
				await expect(page.locator('.gslide.current')).toHaveClass(/zoomed/);
				await full.click();
				await expect(page.locator('.gslide.current')).not.toHaveClass(/zoomed/);
				const afterZoom = await full.boundingBox();
				for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(destination[key] - afterZoom![key])).toBeLessThan(1);
			}
			await page.keyboard.press('Escape');
			await expect(page.locator('.glightbox-container')).toHaveCount(0);
			await expect(trigger).toBeFocused();
		} finally { release(); }
	});
}

for (const reduced of [false, true]) {
	test(`photo navigation handles slow and out-of-order images${reduced ? ' with reduced motion' : ''}`, async ({ page }) => {
		const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
		await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
		await page.goto('/travel/sample-trip/first-walk/');
		await page.locator('travel-gallery').evaluate((gallery) => {
			const script = gallery.querySelector('[data-gallery-items]')!;
			const items = JSON.parse(script.textContent!);
			for (const source of items[1].sources) source.url += '?slow-full';
			script.textContent = JSON.stringify(items); gallery.replaceWith(gallery.cloneNode(true));
		});
		let releaseFull!: () => void, releasePreview!: () => void;
		const fullPending = new Promise<void>((resolve) => { releaseFull = resolve; });
		const previewPending = new Promise<void>((resolve) => { releasePreview = resolve; });
		await page.route((url) => url.searchParams.has('slow-full'), async (route) => { await fullPending; await route.continue(); });
		await page.route((url) => url.searchParams.has('slow-preview'), async (route) => { await previewPending; await route.continue(); });
		await page.locator('travel-gallery [data-media-index="1"] img').evaluate(async (image: HTMLImageElement) => {
			await image.decode();
			// Give the viewer an uncached thumbnail URL independently of the full image.
			Object.defineProperty(image, 'currentSrc', { value: image.currentSrc + '?slow-preview' });
		});
		try {
			await page.locator('travel-gallery [data-media-index="0"]').click();
			await expect(page.locator('.gslide.current .gslide-image img')).toBeVisible();
			await expect(page.locator('.travel-viewer-preview')).toHaveCount(0);
			await page.keyboard.press('ArrowRight');
			await expect(page.locator('.travel-viewer-counter')).toHaveText('2 / 200');
			const previous = page.locator('.gslider > .gslide').nth(0);
			if (!reduced) {
				// Wait past the 220 ms fade: the old photo must remain while the next one is unavailable.
				await page.waitForTimeout(260);
				await expect(previous).toHaveCSS('opacity', '1');
			}
			releasePreview();
			await expect.poll(() => page.locator('.gslide[data-media-index="1"] > .travel-viewer-preview').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
			if (!reduced) {
				const incoming = page.locator('.gslider > .gslide').nth(1);
				await expect.poll(() => incoming.evaluate((slide) => slide.getAnimations().length)).toBe(1);
				const movement = await page.evaluate(() => {
					const slides = document.querySelectorAll<HTMLElement>('.gslider > .gslide');
					for (const slide of [slides[0], slides[1]]) for (const animation of slide.getAnimations()) { animation.pause(); animation.currentTime = 180; }
					const image = slides[1].querySelector('.gslide-image img')!.getBoundingClientRect();
					const preview = slides[1].querySelector('.travel-viewer-preview')!.getBoundingClientRect();
					return { outgoingX: slides[0].getBoundingClientRect().left, incomingX: slides[1].getBoundingClientRect().left, offset: Math.max(Math.abs(image.left - preview.left), Math.abs(image.top - preview.top)) };
				});
				expect(movement.outgoingX).toBeLessThan(0); expect(movement.incomingX).toBeGreaterThan(0);
				expect(movement.offset).toBeLessThan(1);
				await incoming.evaluate((slide) => { for (const animation of slide.getAnimations()) animation.finish(); });
				await expect.poll(() => incoming.evaluate((slide) => slide.getAnimations().length)).toBe(0);
			}
			await expect(page.locator('.gslide[data-media-index="1"]')).toHaveCSS('opacity', '1');
			await page.keyboard.press('ArrowRight');
			await expect(page.locator('.travel-viewer-counter')).toHaveText('3 / 200');
			await expect(page.locator('.gslide.current')).toHaveAttribute('data-media-index', '2');
			await page.keyboard.press('ArrowLeft');
			await expect(page.locator('.travel-viewer-counter')).toHaveText('2 / 200');
			await expect(page.locator('.gslide[data-media-index="1"] > .travel-viewer-preview')).toBeVisible();
			await page.keyboard.press('ArrowRight');
			await expect(page.locator('.travel-viewer-counter')).toHaveText('3 / 200');
			const response = page.waitForResponse((response) => response.url().includes('?slow-full') && response.ok());
			releaseFull(); await response;
			await expect(page.locator('.travel-viewer-preview')).toHaveCount(0);
			await expect(page.locator('.gslide.current')).toHaveCount(1);
			await expect(page.locator('.gslide.current')).toHaveAttribute('data-media-index', '2');
			await page.keyboard.press('ArrowLeft');
			await expect(page.locator('.gslide.current')).toHaveAttribute('data-media-index', '1');
			await expect(page.locator('.travel-viewer-counter')).toHaveText('2 / 200');
			await page.keyboard.press('Escape');
			await expect(page.locator('.glightbox-container')).toHaveCount(0);
			expect(errors).toEqual([]);
		} finally { releasePreview(); releaseFull(); }
	});
}

test('captioned photo layout stays within the viewport when resized', async ({ page }) => {
	const viewport = page.viewportSize()!;
	await page.goto('/travel/sample-trip/first-walk/');
	await page.locator('travel-gallery [data-media-index="2"]').click();
	const photo = page.locator('.gslide.current .gslide-image img');
	await expect(photo).toBeVisible();
	await expect(page.locator('.travel-viewer-preview')).toHaveCount(0);
	const original = await photo.boundingBox();
	await page.setViewportSize({ width: 900, height: 600 });
	await expect.poll(() => page.locator('.gslide.current').evaluate((slide) => {
		const image = slide.querySelector('img')!.getBoundingClientRect();
		const caption = slide.querySelector('.gslide-description')!.getBoundingClientRect();
		return image.left >= 0 && image.top >= 0 && image.right <= innerWidth && caption.top >= image.bottom - 1 && caption.bottom <= innerHeight;
	})).toBe(true);
	await page.setViewportSize(viewport);
	await expect.poll(async () => {
		const bounds = await photo.boundingBox();
		return Math.max(...(['x', 'y', 'width', 'height'] as const).map((key) => Math.abs(bounds![key] - original![key])));
	}).toBeLessThan(1);
	await page.keyboard.press('Escape');
	await expect(page.locator('.glightbox-container')).toHaveCount(0);
});

test('the sticky site header and page stay in place while the viewer opens and closes', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const trigger = page.locator('travel-gallery [data-media-index="0"]');
	await trigger.scrollIntoViewIfNeeded();
	await trigger.locator('img').evaluate((image: HTMLImageElement) => image.decode());
	expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
	const before = await page.locator('.site-header').boundingBox();
	await page.evaluate(() => {
		const state = window as unknown as { headerFrames: number[][]; headerFrameId: number };
		state.headerFrames = [];
		const sample = () => {
			const box = document.querySelector('.site-header')!.getBoundingClientRect();
			state.headerFrames.push([box.x, box.y, box.width, box.height, scrollY]);
			state.headerFrameId = requestAnimationFrame(sample);
		};
		sample();
	});
	await trigger.click();
	await expect(page.locator('.gslide.current .gslide-image img')).toBeVisible();
	await expect(page.locator('.travel-viewer-preview')).toHaveCount(0);
	await expect(page.locator('.site-header')).toHaveAttribute('aria-hidden', 'true');
	await page.mouse.wheel(0, 350);
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
	await page.keyboard.press('Escape');
	await expect(page.locator('.glightbox-container')).toHaveCount(0);
	await expect(page.locator('.site-header')).not.toHaveAttribute('aria-hidden');
	const frames = await page.evaluate(() => {
		const state = window as unknown as { headerFrames: number[][]; headerFrameId: number };
		cancelAnimationFrame(state.headerFrameId);
		return state.headerFrames;
	});
	expect(frames.length).toBeGreaterThan(2);
	const expected = [before!.x, before!.y, before!.width, before!.height, frames[0][4]];
	for (const frame of frames) for (const [index, value] of frame.entries()) expect(Math.abs(value - expected[index]), `Header/page position changed in frame ${frame}`).toBeLessThan(1);
});

test('closing while a full-size photo is loading removes the preview and restores focus', async ({ page }) => {
	const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/travel/sample-trip/first-walk/');
	await page.locator('travel-gallery').evaluate((gallery) => {
		const script = gallery.querySelector('[data-gallery-items]')!;
		const items = JSON.parse(script.textContent!);
		for (const source of items[0].sources) source.url += '?full-size';
		script.textContent = JSON.stringify(items);
		gallery.replaceWith(gallery.cloneNode(true));
	});
	let release!: () => void;
	const pending = new Promise<void>((resolve) => { release = resolve; });
	await page.route((url) => url.searchParams.has('full-size'), async (route) => { await pending; await route.continue(); });
	const trigger = page.locator('travel-gallery [data-media-index="0"]');
	try {
		await trigger.click();
		await expect(page.locator('.travel-viewer-preview')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('.glightbox-container, .travel-viewer-preview')).toHaveCount(0);
		await expect(trigger).toBeFocused();
		const response = page.waitForResponse((response) => response.url().includes('?full-size') && response.ok());
		release();
		await response;
		expect(errors).toEqual([]);
	} finally { release(); }
});

for (const { index, next, button, during } of [{ index: 0, next: false, button: false }, { index: 2, next: false, button: true }, { index: 0, next: true, button: false }, { index: 0, next: true, button: false, during: true }]) {
	test(`closing photo flies back to its thumbnail (${index}${next ? ', next slide' : ''}${button ? ', button' : ', Escape'}${during ? ', during navigation' : ''})`, async ({ page }, testInfo) => {
		await page.goto('/travel/sample-trip/first-walk/');
		const gallery = page.locator('travel-gallery');
		const trigger = gallery.locator(`[data-media-index="${index}"]`);
		await trigger.click();
		await expect(page.locator('.travel-viewer-preview')).toHaveCount(0);
		if (next) await page.locator('.gnext').click();
		await expect(page.locator('.travel-viewer-counter')).toHaveText(`${index + (next ? 2 : 1)} / 200`);
		await expect(page.locator('.gslide.current .gslide-image img')).toBeVisible();
		await expect(page.locator('.travel-viewer-preview')).toHaveCount(0);
		await page.locator('.gslide.current').evaluate(async (slide, during) => {
			if (during) for (const animation of slide.getAnimations()) { animation.pause(); animation.currentTime = 180; }
			else await Promise.allSettled(slide.getAnimations().map((animation) => animation.finished));
		}, during);
		const enlarged = await page.locator('.gslide.current .gslide-image img').boundingBox();
		const target = await gallery.locator(`[data-media-index="${index + (next ? 1 : 0)}"] img`).boundingBox();
		await page.evaluate(() => {
			const observer = new MutationObserver(() => {
				const preview = document.querySelector('.travel-viewer-returning .travel-viewer-preview');
				const flight = preview?.getAnimations()[0];
				if (!flight) return;
				flight.pause(); flight.currentTime = 0;
				observer.disconnect();
			});
			observer.observe(document.body, { attributes: true, childList: true, subtree: true });
		});
		if (button) await page.locator('.gclose').click();
		else await page.keyboard.press('Escape');
		const preview = page.locator('.travel-viewer-returning .travel-viewer-preview');
		await expect(preview).toBeVisible();
		const start = await preview.boundingBox();
		for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(start![key] - enlarged![key])).toBeLessThan(1);
		await preview.evaluate((image) => {
			const flight = image.getAnimations()[0];
			flight.currentTime = Number(flight.effect!.getTiming().duration);
		});
		const end = await preview.evaluate((image) => {
			const box = image.getBoundingClientRect();
			const crop = getComputedStyle(image).clipPath.match(/^inset\(([\d.]+)%(?: ([\d.]+)%)?/)!;
			const x = Number(crop[2] ?? crop[1]) / 100, y = Number(crop[1]) / 100;
			return { x: box.x + box.width * x, y: box.y + box.height * y, width: box.width * (1 - 2 * x), height: box.height * (1 - 2 * y) };
		});
		for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(end[key] - target![key])).toBeLessThan(1);
		await page.screenshot({ path: testInfo.outputPath('photo-return-end.png') });
		await preview.evaluate((image) => image.getAnimations()[0].finish());
		await expect(page.locator('.glightbox-container, .travel-viewer-preview')).toHaveCount(0);
		await expect(trigger).toBeFocused();
	});
}

test('closing a photo without a rendered thumbnail falls back to fading', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const trigger = page.locator('travel-gallery [data-media-index="5"]');
	await trigger.click();
	await expect(page.locator('.travel-viewer-preview')).toHaveCount(0);
	await page.locator('.gnext').click();
	await expect(page.locator('.travel-viewer-counter')).toHaveText('7 / 200');
	await page.locator('travel-gallery [data-media-index="6"]').evaluate((link) => link.closest('figure')!.remove());
	await page.keyboard.press('Escape');
	await expect(page.locator('.travel-viewer-returning')).toHaveCount(0);
	await expect(page.locator('.glightbox-container')).toHaveCount(0);
	await expect(trigger).toBeFocused();
});

test('200 media: all thumbnails are visible, images load lazily and the viewer restores focus', async ({ page }) => {
	const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
	const mediaRequests: string[] = []; page.on('request', (request) => { if (request.url().includes('/media/')) mediaRequests.push(request.url()); });
	await page.goto('/travel/sample-trip/first-walk/');
	const gallery = page.locator('travel-gallery');
	await expect(gallery.locator('figure')).toHaveCount(200);
	await gallery.locator('[data-media-index="0"]').scrollIntoViewIfNeeded();
	await expect(gallery.locator('button')).toHaveCount(0);
	await expect(gallery.locator('[data-media-index="199"] img')).toHaveAttribute('loading', 'lazy');
	expect(mediaRequests.some((url) => url.endsWith('.mp4'))).toBe(false);
	expect(new Set(mediaRequests).size).toBeLessThan(50);
	const trigger = gallery.locator('[data-media-index="0"]');
	await trigger.click();
	await expect(page.locator('.glightbox-container')).toBeVisible();
	await expect(page.locator('.travel-viewer-counter')).toHaveText('1 / 200');
	await expect(page.locator('.gslide.current .gslide-image img')).toBeVisible();
	expect(mediaRequests.some((url) => url.includes(createHash('sha256').update('199').digest('hex')))).toBe(false);
	expect(mediaRequests.some((url) => url.endsWith('.mp4'))).toBe(false);
	await page.locator('.gnext').click();
	await expect(page.locator('.travel-viewer-counter')).toHaveText('2 / 200');
	await page.keyboard.press('Escape');
	await expect(page.locator('.glightbox-container')).toHaveCount(0);
	await expect(trigger).toBeFocused();
	const last = gallery.locator('[data-media-index="199"]');
	await last.click();
	await expect(page.locator('.travel-viewer-counter')).toHaveText('200 / 200');
	await page.keyboard.press('Escape');
	await expect(last).toBeFocused();
	expect(errors).toEqual([]);
});

test('video loads on opening, plays and pauses; galleries survive Astro navigation and themes', async ({ page }) => {
	const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/travel/sample-trip/first-walk/');
	await page.locator('travel-gallery [data-media-index="4"]').click();
	const video = page.locator('.glightbox-container video');
	await expect(video).toHaveAttribute('src', /video.mp4$/);
	await expect(video).toHaveJSProperty('paused', false);
	await page.locator('.gnext').click();
	await expect(video).toHaveJSProperty('paused', true);
	await page.locator('.gprev').click();
	await expect(video).toHaveJSProperty('paused', false);
	const playingVideo = await video.elementHandle();
	await page.keyboard.press('Escape');
	await expect.poll(() => playingVideo!.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
	await page.locator('.travel-chapter-nav a', { hasText: 'К ленте' }).click();
	await expect(page).toHaveURL(/\/travel\/sample-trip\/#chapter-first-walk$/);
	await page.locator('#note-evening [data-media-index="0"]').click();
	await expect(page.locator('.glightbox-container')).toBeVisible();
	await page.keyboard.press('Escape');
	await page.locator('[data-theme-option="dark"]').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.screenshot({ path: `.state/travel-${test.info().project.name}-dark.png`, animations: 'disabled' });
	await page.locator('[data-theme-option="light"]').click();
	await page.screenshot({ path: `.state/travel-${test.info().project.name}-light.png`, animations: 'disabled' });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	expect(errors).toEqual([]);
});

test('video frame fits its content and captions stay below the player', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const gallery = page.locator('travel-gallery');
	for (const index of [4, 199]) {
		await gallery.locator(`[data-media-index="${index}"]`).click();
		const video = page.locator('.gslide.current video');
		await expect(video).toHaveJSProperty('paused', false);
		const layout = await video.evaluate((node) => {
			const slide = node.closest('.gslide')!;
			const media = slide.querySelector('.gslide-inline')!, caption = slide.querySelector('.gslide-description')!, text = slide.querySelector('.gslide-desc')!;
			return { video: node.getBoundingClientRect().toJSON(), media: media.getBoundingClientRect().toJSON(), caption: caption.getBoundingClientRect().toJSON(), background: getComputedStyle(media).backgroundColor, captionBackground: getComputedStyle(caption).backgroundColor, color: getComputedStyle(text).color, align: getComputedStyle(text).textAlign, viewport: innerHeight };
		});
		expect(Math.abs(layout.media.width - layout.video.width)).toBeLessThan(1);
		expect(Math.abs(layout.media.height - layout.video.height)).toBeLessThan(1);
		expect(layout.background).toBe('rgba(0, 0, 0, 0)');
		expect(layout.captionBackground).toBe('rgba(0, 0, 0, 0)');
		expect(layout.color).toBe('rgb(221, 221, 221)');
		expect(layout.align).toBe('center');
		expect(layout.caption.top).toBeGreaterThanOrEqual(layout.video.bottom - 1);
		expect(layout.caption.bottom).toBeLessThanOrEqual(layout.viewport);
		await page.screenshot({ path: `.state/travel-video-${index}-${test.info().project.name}.png`, animations: 'disabled' });
		await page.keyboard.press('Escape');
	}
});

test('autoplay retries muted when browser policy blocks sound', async ({ page }) => {
	const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => {
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function () {
			return this.muted ? play.call(this) : Promise.reject(new DOMException('Sound blocked by browser policy', 'NotAllowedError'));
		};
	});
	await page.goto('/travel/sample-trip/first-walk/');
	await page.locator('travel-gallery [data-media-index="4"]').click();
	const video = page.locator('.glightbox-container video');
	await expect(video).toHaveJSProperty('muted', true);
	await expect(video).toHaveJSProperty('paused', false);
	await expect(video).toHaveJSProperty('controls', true);
	await page.locator('.gnext').click();
	await expect(video).toHaveJSProperty('paused', true);
	expect(errors).toEqual([]);
});

test('missing image keeps a usable fallback and does not break navigation', async ({ page }) => {
	await page.route((url) => url.pathname.startsWith('/media/') && /\.(jpeg|webp|jxl)$/.test(url.pathname), (route) => route.fulfill({ status: 404 }));
	await page.goto('/travel/sample-trip/first-walk/');
	await page.locator('travel-gallery').scrollIntoViewIfNeeded();
	await expect(page.locator('travel-gallery .travel-media-error').first()).toBeVisible();
	await expect(page.locator('travel-gallery [data-media-index="0"]')).toHaveAttribute('href', /1280.jpeg$/);
	await page.locator('travel-gallery [data-media-index="0"]').click();
	await expect(page.locator('.gslide.current .travel-viewer-error')).toBeVisible();
	await page.locator('.gnext').click();
	await expect(page.locator('.travel-viewer-counter')).toHaveText('2 / 200');
	await page.keyboard.press('Escape');
});
