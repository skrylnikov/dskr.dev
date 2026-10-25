import { readFile, readdir, mkdir, stat, writeFile, rename } from 'node:fs/promises';
import { openAsBlob } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp, { type OverlayOptions } from 'sharp';
import { parse } from 'yaml';
import { tripSchema, entrySchema, buildTravelCatalog, gallerySchema, mediaSource, type TravelMedia } from '../src/data/travel.mts';
import { travelPreviewKey, type TravelPreview } from '../src/data/travel-previews.mts';

const manifestFile = resolve('src/data/travel-previews.json');
const objectsDir = resolve('.state/travel/objects');

export async function renderTravelPreview(images: Buffer[]) {
	if (images.length < 3 || images.length > 8) throw new Error('A travel preview needs 3–8 photos');
	const metadata = await Promise.all(images.map((image) => sharp(image).metadata()));
	const width = 1200, gap = 6, columns = images.length <= 3 ? images.length : Math.ceil(images.length / 2);
	const rows = Array.from({ length: Math.ceil(images.length / columns) }, (_, index) => metadata.slice(index * columns, (index + 1) * columns));
	const heights = rows.map((row) => Math.round((width - gap * (row.length - 1)) / row.reduce((sum, image) => sum + image.width / image.height, 0)));
	let top = 0, offset = 0;
	const tiles: OverlayOptions[] = [];
	for (const [rowIndex, row] of rows.entries()) {
		let left = 0;
		const ratio = row.reduce((sum, image) => sum + image.width / image.height, 0);
		for (const [index, image] of row.entries()) {
			const tileWidth = index === row.length - 1 ? width - left : Math.round((width - gap * (row.length - 1)) * (image.width / image.height) / ratio);
			const input = await sharp(images[offset++]).resize({ width: tileWidth, height: heights[rowIndex], fit: 'contain', background: '#f5f3eb' }).toBuffer();
			tiles.push({ input, left, top });
			left += tileWidth + gap;
		}
		top += heights[rowIndex] + gap;
	}
	const buffer = await sharp({ create: { width, height: top - gap, channels: 3, background: '#f5f3eb' } }).composite(tiles).jpeg({ quality: 86, progressive: true }).toBuffer();
	return { buffer, width, height: top - gap };
}

async function prepare() {
	const root = resolve(process.env.TRAVEL_CONTENT_ROOT || 'src/content/travel');
	const load = async (directory: string) => await Promise.all((await readdir(join(root, directory), { recursive: true })).filter((file) => file.endsWith('.mdx')).map(async (file) => {
		const source = await readFile(join(root, directory, file), 'utf8');
		const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
		if (!frontmatter) throw new Error(`Missing frontmatter: ${file}`);
		return { id: file, data: directory === 'trips' ? tripSchema.parse(parse(frontmatter)) : entrySchema.parse(parse(frontmatter)) };
	}));
	const catalog = buildTravelCatalog(await load('trips') as Parameters<typeof buildTravelCatalog>[0], await load('entries') as Parameters<typeof buildTravelCatalog>[1]);
	const media = new Map<string, TravelMedia>();
	for (const file of (await readdir(join(root, 'media'))).filter((file) => file.endsWith('.json'))) {
		const gallery = gallerySchema.parse(JSON.parse(await readFile(join(root, 'media', file), 'utf8')));
		for (const item of gallery.items) media.set(`${gallery.id}/${item.id}`, item);
	}
	const manifest: Record<string, TravelPreview> = {};
	for (const { data } of [...catalog.trips, ...catalog.entries]) {
		if (!('collage' in data)) continue;
		const sources = data.collage.map((ref) => {
			const item = media.get(ref);
			if (!item || item.kind !== 'image') throw new Error(`Missing collage photo: ${ref}`);
			return mediaSource(item);
		});
		const key = travelPreviewKey(sources);
		if (manifest[key]) continue;
		const output = join(objectsDir, key, 'preview.jpeg');
		await mkdir(join(objectsDir, key), { recursive: true });
		const cached = await stat(output).then(() => sharp(output).metadata(), (error) => { if (error.code !== 'ENOENT') throw error; return undefined; });
		if (cached) {
			manifest[key] = { url: `/media/${key}/preview.jpeg`, width: cached.width, height: cached.height };
			continue;
		}
		const preview = await renderTravelPreview(await Promise.all(sources.map((url) => readFile(join(objectsDir, url.slice('/media/'.length))))));
		await writeFile(output + '.tmp', preview.buffer);
		await rename(output + '.tmp', output);
		manifest[key] = { url: `/media/${key}/preview.jpeg`, width: preview.width, height: preview.height };
	}
	await writeFile(manifestFile + '.tmp', JSON.stringify(manifest, null, 2) + '\n');
	await rename(manifestFile + '.tmp', manifestFile);
	console.log(`Prepared ${Object.keys(manifest).length} shared RU/EN preview collages.`);
}

async function publish() {
	const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; };
	const { S3mini } = await import('s3mini');
	const store = new S3mini({ endpoint: `${required('MEDIA_S3_ENDPOINT').replace(/\/$/, '')}/${required('MEDIA_S3_PUBLISHED_BUCKET')}`, region: process.env.MEDIA_S3_REGION || 'us-east-1', accessKeyId: required('MEDIA_S3_ACCESS_KEY_ID'), secretAccessKey: required('MEDIA_S3_SECRET_ACCESS_KEY') });
	const manifest: Record<string, TravelPreview> = JSON.parse(await readFile(manifestFile, 'utf8'));
	for (const [hash, preview] of Object.entries(manifest)) {
		if (!/^[a-f0-9]{64}$/.test(hash) || preview.url !== `/media/${hash}/preview.jpeg`) throw new Error('Invalid preview object key');
		const key = preview.url.slice('/media/'.length), file = join(objectsDir, key), bytes = (await stat(file)).size;
		const metadata = await sharp(file).metadata();
		if (metadata.format !== 'jpeg' || metadata.width !== preview.width || metadata.height !== preview.height) throw new Error(`Invalid preview: ${key}`);
		if (!(await store.objectExists(key))) await store.putAnyObject(key, await openAsBlob(file, { type: 'image/jpeg' }), 'image/jpeg', undefined, { 'Cache-Control': 'public, max-age=31536000, immutable' } as Parameters<typeof store.putAnyObject>[4], bytes);
		if (await store.getContentLength(key) !== bytes) throw new Error(`S3 verification failed: ${key}`);
	}
	console.log(`Verified ${Object.keys(manifest).length} published preview JPEGs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const command = process.argv[2];
	if (command === 'prepare') await prepare();
	else if (command === 'publish') await publish();
	else throw new Error('Usage: node --env-file-if-exists=.env --import tsx scripts/travel-previews.mts prepare|publish');
}
