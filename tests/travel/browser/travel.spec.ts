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
	await expect(page.locator('.gslide.current img')).toHaveAttribute('src', supportsJxl ? /\.jxl$/ : /\.jpeg$/);
	await expect(page.locator('.gslide.current img')).toBeVisible();
	await page.keyboard.press('Escape');
	await page.locator('travel-gallery [data-show-more]').click();
	await expect(page.locator('[data-media-index="6"] source').first()).toHaveAttribute('type', 'image/jxl');
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
	await expect(page.locator('.gslide.current img')).toHaveAttribute('src', /\.jpeg$/);
	await expect.poll(() => page.locator('.gslide.current img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
});

test('200 media: only six thumbnails initially, progressive reveal, all slides and restored focus', async ({ page }) => {
	const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
	const mediaRequests: string[] = []; page.on('request', (request) => { if (request.url().includes('/media/')) mediaRequests.push(request.url()); });
	await page.goto('/travel/sample-trip/first-walk/');
	const gallery = page.locator('travel-gallery');
	await expect(gallery.locator('figure')).toHaveCount(6);
	await gallery.scrollIntoViewIfNeeded();
	await expect(gallery.locator('[data-show-more]')).toBeVisible();
	expect(mediaRequests.some((url) => url.endsWith('.mp4'))).toBe(false);
	await gallery.locator('[data-show-more]').click();
	await expect(gallery.locator('figure')).toHaveCount(30);
	expect(new Set(mediaRequests).size).toBeLessThan(50);
	const trigger = gallery.locator('[data-media-index="0"]');
	await trigger.click();
	await expect(page.locator('.glightbox-container')).toBeVisible();
	await expect(page.locator('.travel-viewer-counter')).toHaveText('1 / 200');
	await expect(page.locator('.gslide.current img')).toBeVisible();
	expect(mediaRequests.some((url) => url.includes(createHash('sha256').update('199').digest('hex')))).toBe(false);
	expect(mediaRequests.some((url) => url.endsWith('.mp4'))).toBe(false);
	await page.locator('.gnext').click();
	await expect(page.locator('.travel-viewer-counter')).toHaveText('2 / 200');
	await page.keyboard.press('Escape');
	await expect(page.locator('.glightbox-container')).toHaveCount(0);
	await expect(trigger).toBeFocused();
	for (let n = 0; n < 8; n++) await gallery.locator('[data-show-more]').click();
	await expect(gallery.locator('figure')).toHaveCount(200);
	await expect(gallery.locator('[data-show-more]')).toBeHidden();
	await gallery.locator('[data-media-index="199"]').click();
	await expect(page.locator('.travel-viewer-counter')).toHaveText('200 / 200');
	await page.keyboard.press('Escape');
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
	await page.screenshot({ path: `.state/travel-${test.info().project.name}-dark.png`, fullPage: true, animations: 'disabled' });
	await page.locator('[data-theme-option="light"]').click();
	await page.screenshot({ path: `.state/travel-${test.info().project.name}-light.png`, fullPage: true, animations: 'disabled' });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	expect(errors).toEqual([]);
});

test('video frame fits its content and captions stay below the player', async ({ page }) => {
	await page.goto('/travel/sample-trip/first-walk/');
	const gallery = page.locator('travel-gallery');
	for (let n = 0; n < 9; n++) await gallery.locator('[data-show-more]').click();
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
