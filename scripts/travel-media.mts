import { createHash } from 'node:crypto';
import { createReadStream, openAsBlob } from 'node:fs';
import { mkdir, readFile, writeFile, stat, rename, rm } from 'node:fs/promises';
import { resolve, dirname, join, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { z } from 'astro/zod';
import { gallerySchema, slugSchema, type Gallery, type TravelMedia } from '../src/data/travel.mts';

const text = z.object({ ru: z.string(), en: z.string() });
export const inputSchema = z.object({ id: slugSchema, items: z.array(z.object({ id: slugSchema, file: z.string().min(1), alt: text, caption: text.optional() })).min(1) });
const recipe = 'travel-v1-webp84-jpeg86-640-1280-2560-h264crf23-1080-aac128';
const jxlRecipe = 'jxl-v2-progressive-d1-e7-640-1280-2560';
const stateRoot = resolve('.state/travel');

export async function run(binary: string, args: string[], signal?: AbortSignal) {
	return await new Promise<string>((resolveRun, reject) => {
		const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
		let stdout = '', stderr = '';
		child.stdout.on('data', (data) => { stdout += data; });
		child.stderr.on('data', (data) => { stderr = (stderr + data).slice(-8000); });
		child.on('error', reject);
		child.on('close', (code) => code === 0 ? resolveRun(stdout) : reject(new Error(`${binary} exited ${code}: ${stderr}`)));
	});
}
async function digest(file: string) {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(file)) hash.update(chunk);
	return hash.digest('hex');
}
async function writeJson(file: string, value: unknown) {
	await mkdir(dirname(file), { recursive: true });
	const temp = `${file}.${process.pid}.tmp`;
	await writeFile(temp, JSON.stringify(value, null, 2) + '\n');
	await rename(temp, file);
}
const exists = async (file: string) => stat(file).then(() => true, (error) => { if (error.code === 'ENOENT') return false; throw error; });

async function prepareImage(file: string, hash: string, jxlHash: string, signal?: AbortSignal) {
	const metadata = await sharp(file, { limitInputPixels: 100_000_000 }).metadata();
	const width = metadata.autoOrient?.width ?? metadata.width;
	const height = metadata.autoOrient?.height ?? metadata.height;
	if (!width || !height) throw new Error(`Missing dimensions: ${file}`);
	const output = join(stateRoot, 'objects', hash);
	const jxlOutput = join(stateRoot, 'objects', jxlHash);
	await mkdir(output, { recursive: true });
	await mkdir(jxlOutput, { recursive: true });
	const sources: Extract<TravelMedia, { kind: 'image' }>['sources'] = [];
	for (const size of [...new Set([640, 1280, 2560].map((size) => Math.min(size, width)))]) {
		for (const format of ['webp', 'jpeg'] as const) {
			signal?.throwIfAborted();
			const destination = join(output, `${size}.${format}`);
			if (!(await exists(destination))) {
				const temporary = join(output, `${size}.${process.pid}.tmp.${format}`);
				try {
					const image = sharp(file, { limitInputPixels: 100_000_000 }).autoOrient().resize({ width: size, withoutEnlargement: true });
					await (format === 'webp' ? image.webp({ quality: 84 }) : image.jpeg({ quality: 86, progressive: true })).toFile(temporary);
					await rename(temporary, destination);
				} finally { await rm(temporary, { force: true }); }
			}
			const info = await sharp(destination).metadata();
			sources.push({ url: `/media/${hash}/${size}.${format}`, width: info.width!, height: info.height!, format });
		}
	}
	for (const source of sources.filter((source) => source.format === 'jpeg')) {
		signal?.throwIfAborted();
		const destination = join(jxlOutput, `${source.width}.jxl`);
		if (!(await exists(destination))) {
			const png = join(jxlOutput, `${source.width}.${process.pid}.tmp.png`);
			const temporary = join(jxlOutput, `${source.width}.${process.pid}.tmp.jxl`);
			try {
				await sharp(file, { limitInputPixels: 100_000_000 }).autoOrient().resize({ width: source.width, withoutEnlargement: true }).png().toFile(png);
				await run('cjxl', [png, temporary, '--distance=1', '--effort=7', '--progressive', '--num_threads=2'], signal);
				await rename(temporary, destination);
			} finally { await rm(png, { force: true }); await rm(temporary, { force: true }); }
		}
		sources.push({ url: `/media/${jxlHash}/${source.width}.jxl`, width: source.width, height: source.height, format: 'jxl' });
	}
	return { width, height, sources };
}

export async function prepareGallery(inputFile: string, mediaDir = 'src/content/travel/media', signal?: AbortSignal): Promise<Gallery> {
	const execute = (binary: string, args: string[]) => run(binary, args, signal);
	signal?.throwIfAborted();
	const input = inputSchema.parse(JSON.parse(await readFile(inputFile, 'utf8')));
	if (new Set(input.items.map((item) => item.id)).size !== input.items.length) throw new Error('Duplicate input media id');
	const items: TravelMedia[] = [];
	const originals: { file: string; key: string }[] = [];
	for (const item of input.items) {
		signal?.throwIfAborted();
		const file = resolve(dirname(inputFile), item.file);
		const originalHash = await digest(file);
		const hash = createHash('sha256').update(originalHash + recipe).digest('hex');
		const output = join(stateRoot, 'objects', hash);
		const cacheFile = join(output, 'metadata.json');
		await mkdir(output, { recursive: true });
		let media: TravelMedia;
		const cached = await exists(cacheFile) ? gallerySchema.parse({ id: input.id, items: [JSON.parse(await readFile(cacheFile, 'utf8'))] }).items[0] : undefined;
		if (cached?.kind === 'video' && await exists(join(stateRoot, 'objects', cached.url.replace('/media/', '')))) {
			media = cached;
		} else if (/\.(mp4|mov|m4v|webm|mkv)$/i.test(file)) {
			const video = join(output, 'video.mp4');
			const temporary = join(output, `${process.pid}.tmp.mp4`);
			try {
				await execute('ffmpeg', ['-nostdin', '-y', '-i', file, '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-vf', "scale=w='min(1080,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1", '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', temporary]);
				await rename(temporary, video);
			} finally { await rm(temporary, { force: true }); }
			const probe = JSON.parse(await execute('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video]));
			const dimensions = probe.streams.find((stream: { width?: number }) => stream.width);
			media = { id: item.id, kind: 'video', width: dimensions.width, height: dimensions.height, duration: Number(probe.format.duration), url: `/media/${hash}/video.mp4`, poster: `/media/${hash}/poster.jpeg`, alt: item.alt };
		} else {
			media = { id: item.id, kind: 'image', ...await prepareImage(file, hash, createHash('sha256').update(originalHash + jxlRecipe).digest('hex'), signal), alt: item.alt };
		}
		if (media.kind === 'video') {
			const posterFile = join(output, 'poster.png');
			if (!(await exists(posterFile))) {
				const temporary = join(output, `${process.pid}.tmp.png`);
				try {
					await execute('ffmpeg', ['-nostdin', '-y', '-i', join(output, 'video.mp4'), '-frames:v', '1', temporary]);
					await rename(temporary, posterFile);
				} finally { await rm(temporary, { force: true }); }
			}
			const posterHash = createHash('sha256').update(originalHash + 'poster-v1-' + recipe).digest('hex');
			const posterJxlHash = createHash('sha256').update(originalHash + 'poster-v1-' + jxlRecipe).digest('hex');
			media.posterSources = (await prepareImage(posterFile, posterHash, posterJxlHash, signal)).sources;
			media.poster = media.posterSources.filter((source) => source.format === 'jpeg').sort((a, b) => b.width - a.width)[0].url;
		}
		media = { ...media, id: item.id, alt: item.alt, caption: item.caption };
		await writeJson(cacheFile, media);
		items.push(media);
		originals.push({ file, key: `${originalHash}/original${extname(file).toLowerCase().replace(/[^.a-z0-9]/g, '')}` });
	}
	signal?.throwIfAborted();
	const gallery = gallerySchema.parse({ id: input.id, items });
	await writeJson(join(mediaDir, `${input.id}.json`), gallery);
	await writeJson(join(stateRoot, 'prepared', `${input.id}.json`), { gallery, originals });
	return gallery;
}

export async function publishGallery(id: string, itemIds?: string[], signal?: AbortSignal) {
	signal?.throwIfAborted();
	slugSchema.parse(id);
	const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; };
	const { S3mini } = await import('s3mini');
	const credentials = {
		accessKeyId: required('MEDIA_S3_ACCESS_KEY_ID'), secretAccessKey: required('MEDIA_S3_SECRET_ACCESS_KEY'),
		region: process.env.MEDIA_S3_REGION || 'us-east-1',
		...(signal ? { fetch: (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, {
			...init, signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
		}) } : {}),
	};
	const endpoint = required('MEDIA_S3_ENDPOINT').replace(/\/$/, '');
	const originalsStore = new S3mini({ ...credentials, endpoint: `${endpoint}/${required('MEDIA_S3_ORIGINALS_BUCKET')}` });
	const publishedStore = new S3mini({ ...credentials, endpoint: `${endpoint}/${required('MEDIA_S3_PUBLISHED_BUCKET')}` });
	const prepared = JSON.parse(await readFile(join(stateRoot, 'prepared', `${id}.json`), 'utf8'));
	const gallery = gallerySchema.parse(prepared.gallery);
	const selected = itemIds ? new Set(itemIds) : null;
	const upload = async (store: InstanceType<typeof S3mini>, file: string, key: string, mime: string) => {
		const bytes = (await stat(file)).size;
		// s3mini types only x-amz-* headers, but its implementation forwards standard headers too.
		const headers = { 'Cache-Control': store === publishedStore ? 'public, max-age=31536000, immutable' : 'private, no-store' };
		if (!(await store.objectExists(key))) await store.putAnyObject(key, await openAsBlob(file, { type: mime }), mime, undefined, headers as Parameters<typeof store.putAnyObject>[4], bytes);
		if (await store.getContentLength(key) !== bytes) throw new Error(`S3 verification failed: ${key}`);
	};
	for (const [index, original] of prepared.originals.entries()) {
		if (selected && !selected.has(gallery.items[index]?.id)) continue;
		if (await digest(original.file) !== original.key.split('/')[0]) throw new Error(`Original changed since preparation: ${original.file}`);
		await upload(originalsStore, original.file, original.key, 'application/octet-stream');
	}
	const urls = new Set(gallery.items.filter((media) => !selected || selected.has(media.id)).flatMap((media) => media.kind === 'image' ? media.sources.map((source) => source.url) : [media.url, media.poster, ...(media.posterSources ?? []).map((source) => source.url)]));
	for (const url of urls) {
		const key = url.replace('/media/', '');
		const mime = key.endsWith('.mp4') ? 'video/mp4' : key.endsWith('.webp') ? 'image/webp' : key.endsWith('.jxl') ? 'image/jxl' : 'image/jpeg';
		await upload(publishedStore, join(stateRoot, 'objects', key), key, mime);
	}
	console.log(`Verified ${id}: ${urls.size} published objects; originals remain private.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const [command, file] = process.argv.slice(2);
	if (!file || !['prepare', 'publish'].includes(command)) throw new Error('Usage: pnpm travel:media prepare <input.json> | publish <gallery-id>');
	if (command === 'prepare') console.log(await prepareGallery(resolve(file)));
	else await publishGallery(file);
}
