import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { generateLqip } from '../../scripts/travel-lqip.mts';
import { preparePlaceholders } from '../../scripts/travel-media.mts';
import { gallerySchema } from '../../src/data/travel.mts';
import { mediaPlaceholderStyle } from '../../src/data/travel-media.mts';

test('LQIP is deterministic, follows EXIF orientation and preserves broad light/dark structure', async () => {
	const pixels = Buffer.from(Array.from({ length: 24 * 16 * 3 }, (_, index) => Math.floor(index / 3) % 24 < 12 ? 0 : 255));
	const input = await sharp(pixels, { raw: { width: 24, height: 16, channels: 3 } }).png().withMetadata({ orientation: 6 }).toBuffer();
	const oriented = await sharp(input).autoOrient().png().toBuffer();
	const palette = await generateLqip(input);
	assert.deepEqual(palette, await generateLqip(input));
	assert.deepEqual(palette, await generateLqip(oriented));
	assert.equal(palette.length, 6);
	for (const colour of palette) assert.match(colour, /^#[a-f0-9]{6}$/);
	assert.ok(parseInt(palette[0].slice(1, 3), 16) < parseInt(palette[3].slice(1, 3), 16), 'rotated dark half should be above the light half');
	await assert.rejects(generateLqip(Buffer.from('not an image')));
});

test('each region preserves its full RGB colour, including subtle blues and a different foreground hue', async () => {
	const palette = ['#96b9dc', '#6090ba', '#adc3dd', '#aa5a3c', '#227744', '#c09365'];
	const pixels = Buffer.concat(palette.map((colour) => Buffer.from(colour.slice(1), 'hex')));
	const input = await sharp(pixels, { raw: { width: 3, height: 2, channels: 3 } }).png().toBuffer();
	assert.deepEqual(await generateLqip(input), palette);
	const transparent = await sharp({ create: { width: 3, height: 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
	assert.deepEqual(await generateLqip(transparent), Array(6).fill('#ffffff'));
});

const media = { id: 'one', kind: 'video', width: 24, height: 16, duration: 1, alt: { ru: 'Кадр', en: 'Frame' }, url: `/media/${'a'.repeat(64)}/video.mp4`, poster: `/media/${'a'.repeat(64)}/poster.jpeg` };
test('LQIP schema validates six RGB colours and accepts legacy numeric manifests', () => {
	assert.equal(gallerySchema.parse({ id: 'g', items: [media] }).items[0].lqip, undefined);
	const palette = ['#96b9dc', '#6090ba', '#adc3dd', '#aa5a3c', '#227744', '#c09365'];
	const parsed = gallerySchema.parse({ id: 'g', items: [{ ...media, lqip: palette }] }).items[0];
	assert.deepEqual(parsed.lqip, palette);
	assert.equal(mediaPlaceholderStyle(parsed), palette.map((colour, index) => `--lqip-${'abcdef'[index]}:${colour}`).join(';'));
	assert.equal(mediaPlaceholderStyle({ ...media, kind: 'video', lqip: 0 }), undefined);
	for (const lqip of [palette.slice(1), [...palette, '#ffffff'], ['url(https://example.com)', ...palette.slice(1)], ['#1234', ...palette.slice(1)]]) assert.equal(gallerySchema.safeParse({ id: 'g', items: [{ ...media, lqip }] }).success, false);
	for (const lqip of [-524288, 0, 524287]) assert.equal(gallerySchema.parse({ id: 'g', items: [{ ...media, lqip }] }).items[0].lqip, lqip);
	for (const lqip of [-524289, 524288, 0.5, '0', null]) assert.equal(gallerySchema.safeParse({ id: 'g', items: [{ ...media, lqip }] }).success, false);
});

test('backfill migrates numeric codes, preserves metadata and skips existing palettes', async () => {
	const root = await mkdtemp(join(tmpdir(), 'travel-lqip-'));
	const objects = join('.state/travel/objects', createHash('sha256').update(root).digest('hex'));
	const previous = process.env.TRAVEL_CONTENT_ROOT;
	try {
		await mkdir(join(root, 'media')); await mkdir(objects, { recursive: true });
		const jpeg = join(objects, 'poster.jpeg');
		await sharp({ create: { width: 24, height: 16, channels: 3, background: 'green' } }).jpeg().toFile(jpeg);
		const poster = `/media/${objects.split('/').at(-1)}/poster.jpeg`;
		const manifest = { id: 'g', custom: 'preserved', items: [{ ...media, poster, custom: 'also preserved' }, { ...media, poster, id: 'zero', lqip: 0 }] };
		const path = join(root, 'media/g.json');
		await writeFile(path, JSON.stringify(manifest));
		process.env.TRAVEL_CONTENT_ROOT = root;
		assert.equal(await preparePlaceholders(), 2);
		let source = await readFile(path, 'utf8');
		const palette = await generateLqip(jpeg);
		assert.deepEqual(JSON.parse(source), { ...manifest, items: manifest.items.map((item) => ({ ...item, lqip: palette })) });
		assert.equal(await preparePlaceholders(undefined, true), 2);
		source = await readFile(path, 'utf8');
		assert.deepEqual(JSON.parse(source).items[1].lqip, await generateLqip(jpeg));
		await rm(jpeg);
		assert.equal(await preparePlaceholders(), 0);
		assert.equal(await readFile(path, 'utf8'), source);
		await writeFile(path, JSON.stringify({ ...manifest, items: [manifest.items[0]] }));
		const before = await readFile(path, 'utf8');
		await assert.rejects(preparePlaceholders(), /Missing local JPEG for g\/one:/);
		assert.equal(await readFile(path, 'utf8'), before);
		assert.deepEqual(await readdir(join(root, 'media')), ['g.json']);
	} finally {
		if (previous === undefined) delete process.env.TRAVEL_CONTENT_ROOT; else process.env.TRAVEL_CONTENT_ROOT = previous;
		await rm(root, { recursive: true, force: true }); await rm(objects, { recursive: true, force: true });
	}
});
