import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { prepareGallery, publishGallery, run } from '../../scripts/travel-media.mts';

test('preparation orients photos, strips metadata, avoids enlargement and reuses content keys', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'travel-prepare-'));
	try {
		await sharp({ create: { width: 40, height: 20, channels: 3, background: '#087f5b' } }).jpeg().withMetadata({ orientation: 6 }).toFile(join(dir, 'source.jpg'));
		const input = join(dir, 'input.json');
		await writeFile(input, JSON.stringify({ id: 'test-prepared', items: [{ id: 'one', file: 'source.jpg', alt: { ru: 'Фото', en: 'Photo' } }] }));
		const first = await prepareGallery(input, join(dir, 'manifests'));
		const second = await prepareGallery(input, join(dir, 'manifests'));
		assert.deepEqual(second, first);
		const image = first.items[0]; assert.equal(image.kind, 'image');
		if (image.kind !== 'image') return;
		assert.equal(image.width, 20); assert.equal(image.height, 40); assert.equal(image.sources.length, 3);
		for (const source of image.sources) {
			let file = join('.state/travel/objects', source.url.replace('/media/', ''));
			if (source.format === 'jxl') { await run('djxl', [file, join(dir, 'decoded.png')]); file = join(dir, 'decoded.png'); }
			const metadata = await sharp(await readFile(file)).metadata();
			assert.equal(metadata.width, 20); assert.equal(metadata.height, 40); assert.equal(metadata.exif, undefined);
		}
		const missing = join('.state/travel/objects', image.sources[0].url.replace('/media/', ''));
		await rm(missing);
		await prepareGallery(input, join(dir, 'manifests'));
		assert.ok((await readFile(missing)).byteLength > 0);
	} finally { await rm(dir, { recursive: true, force: true }); }
});
test('video preparation creates browser-compatible MP4, poster and duration', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'travel-video-'));
	try {
		await run('ffmpeg', ['-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=160x120:d=0.4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'source.mp4')]);
		const input = join(dir, 'input.json');
		await writeFile(input, JSON.stringify({ id: 'test-video', items: [{ id: 'clip', file: 'source.mp4', alt: { ru: 'Видео', en: 'Video' } }] }));
		const gallery = await prepareGallery(input, join(dir, 'manifests'));
		assert.equal(gallery.items[0].kind, 'video');
		const video = gallery.items[0];
		if (video.kind !== 'video') return;
		assert.ok(video.duration > 0); assert.equal(video.width, 160);
		assert.match(video.poster, /160.jpeg$/);
		assert.deepEqual(video.posterSources?.map((source) => source.format).sort(), ['jpeg', 'jxl', 'webp']);
		for (const source of video.posterSources!) {
			let file = join('.state/travel/objects', source.url.replace('/media/', ''));
			if (source.format === 'jxl') { await run('djxl', [file, join(dir, 'decoded.png')]); file = join(dir, 'decoded.png'); }
			const metadata = await sharp(file).metadata();
			assert.equal(metadata.width, 160); assert.equal(metadata.height, 120); assert.equal(metadata.exif, undefined);
			if (source.format === 'jpeg') assert.equal(metadata.isProgressive, true);
		}
		const videoFile = join('.state/travel/objects', video.url.replace('/media/', ''));
		const videoMtime = (await stat(videoFile)).mtimeMs;
		const legacy = { ...video }; delete legacy.posterSources;
		await writeFile(join(videoFile, '..', 'metadata.json'), JSON.stringify(legacy));
		await rm(join('.state/travel/objects', video.posterSources![0].url.replace('/media/', '')));
		const regenerated = await prepareGallery(input, join(dir, 'manifests'));
		assert.deepEqual(regenerated, gallery);
		assert.equal((await stat(videoFile)).mtimeMs, videoMtime);
	} finally { await rm(dir, { recursive: true, force: true }); }
});

test('publishing separates originals, sends cache headers, skips existing objects and rejects changed originals', async (t) => {
	const dir = await mkdtemp(join(tmpdir(), 'travel-publish-'));
	const keys = { MEDIA_S3_ENDPOINT: 'https://s3.example.test', MEDIA_S3_ORIGINALS_BUCKET: 'originals', MEDIA_S3_PUBLISHED_BUCKET: 'published', MEDIA_S3_ACCESS_KEY_ID: 'test-access', MEDIA_S3_SECRET_ACCESS_KEY: 'test-secret' };
	const previous = Object.fromEntries(Object.keys(keys).map((key) => [key, process.env[key]]));
	const stored = new Map<string, { bytes: number; cache: string | null; type: string | null }>();
	let puts = 0;
	t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		const path = new URL(request.url).pathname;
		if (request.method === 'PUT') { puts++; stored.set(path, { bytes: (await request.arrayBuffer()).byteLength, cache: request.headers.get('cache-control'), type: request.headers.get('content-type') }); return new Response('', { status: 200 }); }
		const object = stored.get(path);
		return new Response(null, { status: object ? 200 : 404, headers: object ? { 'content-length': String(object.bytes) } : {} });
	});
	try {
		Object.assign(process.env, keys);
		const source = join(dir, 'source.jpeg');
		await sharp({ create: { width: 16, height: 16, channels: 3, background: '#d8f36a' } }).jpeg().toFile(source);
		await run('ffmpeg', ['-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=160x120:d=0.4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', join(dir, 'source.mp4')]);
		const input = join(dir, 'input.json');
		await writeFile(input, JSON.stringify({ id: 'test-publication', items: [{ id: 'one', file: source, alt: { ru: 'Фото', en: 'Photo' } }, { id: 'clip', file: 'source.mp4', alt: { ru: 'Видео', en: 'Video' } }] }));
		await prepareGallery(input, join(dir, 'manifests'));
		await publishGallery('test-publication');
		assert.equal(stored.size, 9);
		for (const [path, object] of stored) assert.equal(object.cache, path.startsWith('/published/') ? 'public, max-age=31536000, immutable' : 'private, no-store');
		assert.equal([...stored].find(([path]) => path.endsWith('.jxl'))?.[1].type, 'image/jxl');
		assert.equal([...stored.keys()].filter((key) => key.startsWith('/originals/')).length, 2);
		for (const [path, object] of stored) if (path.startsWith('/published/')) assert.equal(object.type, path.endsWith('.mp4') ? 'video/mp4' : path.endsWith('.jpeg') ? 'image/jpeg' : path.endsWith('.webp') ? 'image/webp' : 'image/jxl');
		await publishGallery('test-publication'); assert.equal(puts, 9);
		await writeFile(source, 'changed');
		await assert.rejects(publishGallery('test-publication'), /Original changed/);
	} finally {
		for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
		await rm(dir, { recursive: true, force: true });
	}
});
