import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat, mkdir, rm } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'astro/zod';
import {
	gallerySchema,
	slugSchema,
	travelPath,
} from '../../src/data/travel.mts';
import {
	ContentStore,
	AdminError,
	materialInput,
	type Material,
} from './store';
import { MediaManager } from './media';

export function previewPath(material: Material) {
	if (material.type === 'blog')
		return `${material.locale === 'en' ? '/en' : ''}/blog/${material.slug}/`;
	if (material.type === 'trip')
		return travelPath(material.locale, material.slug);
	return material.metadata.kind === 'note'
		? `${travelPath(material.locale, material.trip)}#note-${material.slug}`
		: travelPath(material.locale, material.trip, material.slug);
}
export function createApi({
	store = new ContentStore(),
	media = new MediaManager(store, undefined, process.env.ADMIN_STATE_ROOT),
	preview = async () => {},
} = {}) {
	const app = Fastify({ bodyLimit: 4 * 1024 * 1024, requestTimeout: 0 });
	app.register(multipart, {
		limits: { fileSize: 1024 * 1024 * 1024, files: 100, fields: 0 },
	});
	app.addHook('preClose', async () => media.stop());
	app.addHook('onRequest', async (request, reply) => {
		if (
			request.headers.origin &&
			!['http://127.0.0.1:4322', 'http://127.0.0.1:4324'].includes(
				request.headers.origin,
			)
		)
			return reply.code(403).send({ error: 'Недопустимый Origin' });
		if (request.headers.host !== '127.0.0.1:4323')
			return reply.code(403).send({ error: 'Недопустимый Host' });
		if (
			!['GET', 'HEAD'].includes(request.method) &&
			request.headers.origin !== 'http://127.0.0.1:4322'
		)
			return reply.code(403).send({ error: 'Недопустимый Origin' });
		reply
			.header('Cache-Control', 'no-store')
			.header('X-Content-Type-Options', 'nosniff');
	});
	app.setErrorHandler((error: any, _request, reply) => {
		const status =
			error instanceof z.ZodError ? 400 : (error.statusCode ?? 500);
		reply.code(status).send({ error: error.message });
	});
	app.get('/api/materials', async () => store.list());
	app.get('/api/material', async (request) =>
		store.read(z.object({ id: z.string() }).parse(request.query).id),
	);
	app.post('/api/material', async (request) =>
		store.save(materialInput.parse(request.body)),
	);
	app.post('/api/preview', async (request) => {
		const { id } = z.object({ id: z.string() }).parse(request.body);
		const material = await store.read(id);
		await preview();
		return { url: `http://127.0.0.1:4324${previewPath(material)}` };
	});
	app.get('/api/galleries', async () =>
		Promise.all(
			(await store.galleries()).map(async (g) => ({
				...g,
				pending: (await media.pending(g.id)).length,
			})),
		),
	);
	app.post('/api/gallery', async (request) => {
		const { gallery, version } = z
			.object({ gallery: gallerySchema, version: z.string().nullable() })
			.parse(request.body);
		return store.exclusive(() => store.saveGallery(gallery, version));
	});
	app.post('/api/upload', async (request, reply) => {
		const { gallery, version } = z
			.object({ gallery: slugSchema, version: z.string().optional() })
			.parse(request.query);
		const batch = `admin-${randomUUID()}`;
		const dir = await media.state.safePath(
			join(media.state.root, 'uploads', batch),
		);
		await mkdir(dir, { recursive: true });
		const files: { id: string; file: string }[] = [];
		try {
			for await (const part of request.files()) {
				const extension = extname(part.filename).toLowerCase();
				if (
					!/^\.(jpe?g|png|webp|avif|heic|heif|tiff?|gif|mp4|mov|m4v|webm|mkv)$/.test(
						extension,
					)
				)
					throw new AdminError('Неподдерживаемый формат файла');
				const id = `media-${randomUUID()}`;
				const file = join(dir, `${id}${extension}`);
				await pipeline(
					part.file,
					createWriteStream(file, { flags: 'wx' }),
				);
				if (part.file.truncated)
					throw new AdminError('Файл превышает лимит 1 ГиБ', 413);
				files.push({ id, file });
			}
			if (!files.length) throw new AdminError('Выберите хотя бы один файл');
		} catch (error) {
			await rm(dir, { recursive: true, force: true });
			throw error;
		}
		return reply
			.code(202)
			.send(
				media.start(gallery, 'preparing', () =>
					media.prepare(gallery, batch, files, version ?? null),
				),
			);
	});
	app.post('/api/publish', async (request, reply) =>
		reply
			.code(202)
			.send(
				media.publish(
					z.object({ gallery: slugSchema }).parse(request.body).gallery,
				),
			),
	);
	app.get('/api/jobs/:id', async (request) => {
		const job = media.jobs.get((request.params as { id: string }).id);
		if (!job) throw new AdminError('Операция не найдена', 404);
		return job;
	});
	const derivatives = new ContentStore('.state/travel/objects');
	app.get('/media/:hash/:file', async (request, reply) => {
		const { hash, file } = z
			.object({
				hash: z.string().regex(/^[a-f0-9]{64}$/),
				file: z
					.string()
					.regex(/^(?:[0-9]+\.(?:jpeg|webp|jxl)|poster\.jpeg|video\.mp4)$/),
			})
			.parse(request.params);
		const local = await derivatives.safePath(
			join(derivatives.root, hash, file),
		);
		const mime = file.endsWith('.mp4')
			? 'video/mp4'
			: file.endsWith('.jxl')
				? 'image/jxl'
				: file.endsWith('.webp')
					? 'image/webp'
					: 'image/jpeg';
		let size;
		try {
			size = (await stat(local)).size;
		} catch (error: any) {
			if (error.code !== 'ENOENT') throw error;
		}
		if (size === undefined) {
			const response = await fetch(`https://dskr.dev/media/${hash}/${file}`, {
				headers: request.headers.range ? { Range: request.headers.range } : {},
				redirect: 'error',
				signal: AbortSignal.timeout(30_000),
			});
			for (const header of [
				'content-type',
				'content-length',
				'content-range',
				'accept-ranges',
			]) {
				const value = response.headers.get(header);
				if (value) reply.header(header, value);
			}
			reply.code(response.status);
			return response.body
				? reply.send(Readable.fromWeb(response.body as any))
				: reply.send();
		}
		reply.type(mime).header('Accept-Ranges', 'bytes');
		if (request.headers.range) {
			const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
			if (!match || (!match[1] && !match[2]))
				return reply
					.code(416)
					.header('Content-Range', `bytes */${size}`)
					.send();
			const start = match[1]
				? Number(match[1])
				: Math.max(0, size - Number(match[2]));
			const end =
				match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
			if (
				start > end ||
				!Number.isSafeInteger(start) ||
				!Number.isSafeInteger(end)
			)
				return reply
					.code(416)
					.header('Content-Range', `bytes */${size}`)
					.send();
			return reply
				.code(206)
				.header('Content-Range', `bytes ${start}-${end}/${size}`)
				.header('Content-Length', end - start + 1)
				.send(createReadStream(local, { start, end }));
		}
		return reply.header('Content-Length', size).send(createReadStream(local));
	});
	return app;
}
