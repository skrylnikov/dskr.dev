import assert from 'node:assert/strict';
import test from 'node:test';
import {
	mkdtemp,
	mkdir,
	readFile,
	writeFile,
	rm,
	symlink,
	realpath,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { ContentStore, splitSource, type MaterialInput } from '../store.ts';
import { parseBody, serializeBody } from '../mdx.ts';
import { createApi, previewPath } from '../api.ts';
import { MediaManager, type Job } from '../media.ts';
import {
	prepareGallery,
	publishGallery,
	run,
} from '../../../scripts/travel-media.mts';
import { buildTravelCatalog, tripSchema } from '../../../src/data/travel.mts';

const hash = 'a'.repeat(64);
const gallery = {
	id: 'photos',
	items: ['one', 'two'].map((id) => ({
		id,
		kind: 'image' as const,
		width: 20,
		height: 10,
		alt: { ru: 'Фото', en: 'Photo' },
		sources: [
			{
				url: `/media/${hash}/20.jpeg`,
				width: 20,
				height: 10,
				format: 'jpeg' as const,
			},
		],
	})),
};
const trip = {
	slug: 'sample',
	locale: 'ru',
	title: 'Поездка',
	description: 'Описание',
	destinations: ['Город'],
	startDate: '2026-10-25',
	collage: ['photos/one', 'photos/one', 'photos/one'],
	draft: true,
};
const source = (metadata: unknown, body = '\nТекст\n') =>
	`---\n${JSON.stringify(metadata, null, 2)}\n---\n${body}`;
async function fixture() {
	const root = await realpath(await mkdtemp(join(tmpdir(), 'dskr-admin-')));
	for (const dir of [
		'blog',
		'blogEn',
		'travel/trips',
		'travel/entries',
		'travel/media',
	])
		await mkdir(join(root, dir), { recursive: true });
	await writeFile(
		join(root, 'travel/media/photos.json'),
		JSON.stringify(gallery),
	);
	await writeFile(join(root, 'travel/trips/sample.ru.mdx'), source(trip));
	const store = new ContentStore(root);
	return {
		root,
		store,
		clean: () => rm(root, { recursive: true, force: true }),
	};
}
const blogInput = (): MaterialInput => ({
	type: 'blog',
	slug: 'new-post',
	locale: 'ru',
	version: null,
	metadata: {
		title: 'Статья',
		description: 'Описание',
		publishDate: '2026-10-25',
	},
	document: parseBody('Привет **мир**!\n'),
});

test('all existing MDX survives conversion in both directions', async () => {
	const store = new ContentStore();
	for (const entry of await store.list()) {
		const material = await store.read(entry.id);
		assert.equal(material.readOnly, undefined, entry.id);
		assert.deepEqual(
			parseBody(serializeBody(material.document!)),
			material.document,
			entry.id,
		);
	}
});
test('literal JSX, braces, code, nested formatting and details stay literal or structural', () => {
	const doc = parseBody(
		'**жирный и *курсив***\n\n<details>\n<summary>Скрыто</summary>\n\n```typescript\nconst x = { a: "<X />" };\n```\n\n</details>\n',
	);
	assert.deepEqual(parseBody(serializeBody(doc)), doc);
	const literal = {
		type: 'doc',
		content: [
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: '<script>{alert(1)}</script> & **literal**' },
				],
			},
		],
	};
	assert.deepEqual(parseBody(serializeBody(literal)), literal);
	for (const mdx of [
		'<Unknown />',
		'{danger()}',
		'import x from "./x"',
		'<MediaGallery gallery={id} />',
		'<details open>\n<summary>x</summary>\n</details>',
	])
		assert.throws(() => parseBody(mdx), /не поддерживает/);
	assert.throws(
		() =>
			serializeBody({
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }],
					},
				],
			}),
		/URL/,
	);
});
test('unchanged save is byte-identical; metadata-only edit preserves body, JSON/YAML and extra fields', async () => {
	const f = await fixture();
	try {
		for (const [name, text] of [
			[
				'json',
				source(
					{ ...blogInput().metadata, sourceMessageIds: [42] },
					'\n## Текст\n\nС пробелами.  \n',
				),
			],
			[
				'yaml',
				'---\n# comment\ntitle: Статья\ndescription: Описание\npublishDate: 2026-10-25\nextra: keep\n---\n\nТекст\n',
			],
		] as const) {
			const file = join(f.root, `blog/${name}.mdx`);
			await writeFile(file, text);
			const material = await f.store.read(`blog/ru/${name}`);
			await f.store.save({ ...material });
			assert.equal(await readFile(file, 'utf8'), text);
			const updated = await f.store.save({
				...material,
				metadata: { ...material.metadata, title: 'Изменено' },
				document: undefined,
			});
			const saved = await readFile(file, 'utf8');
			assert.equal(splitSource(saved).body, splitSource(text).body);
			assert.equal(
				updated.metadata.extra ?? updated.metadata.sourceMessageIds?.[0],
				name === 'yaml' ? 'keep' : 42,
			);
			if (name === 'yaml') assert.match(saved, /# comment/);
			else assert.match(saved, /^---\n\{/);
		}
	} finally {
		await f.clean();
	}
});
test('create, conflicts, concurrent saves, immutable identity, references, order and unsupported MDX', async () => {
	const f = await fixture();
	try {
		let material = await f.store.save(blogInput());
		assert.equal(material.metadata.hidden, true);
		assert.match(previewPath(material), /\/blog\/new-post\//);
		await assert.rejects(f.store.save(blogInput()), /существует/);
		await assert.rejects(
			f.store.save({ ...material, slug: 'changed' }),
			/менять нельзя/,
		);
		const result = await Promise.allSettled(
			['Один', 'Два'].map((title) =>
				f.store.save({
					...material,
					metadata: { ...material.metadata, title },
					document: undefined,
				}),
			),
		);
		assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
		material = await f.store.read(material.id);
		await writeFile(
			join(f.root, 'blog/new-post.mdx'),
			source({ ...material.metadata, title: 'Внешнее изменение' }),
		);
		await assert.rejects(f.store.save(material), /изменён извне/);
		await assert.rejects(
			f.store.save({ ...blogInput(), slug: '../escape' }),
			/Invalid/,
		);
		await assert.rejects(
			f.store.save({
				...blogInput(),
				slug: 'gallery-error',
				document: parseBody('<MediaGallery gallery="missing" />'),
			}),
			/Не найдена галерея/,
		);
		const entry: MaterialInput = {
			type: 'entry',
			slug: 'note',
			trip: 'sample',
			locale: 'ru',
			version: null,
			metadata: { kind: 'note', order: 0, draft: true },
		};
		const note = await f.store.save(entry);
		assert.equal(previewPath(note), '/travel/sample/#note-note');
		await assert.rejects(
			f.store.save({ ...entry, slug: 'other' }),
			/Duplicate entry/,
		);
		await assert.rejects(
			f.store.save({ ...entry, trip: 'missing', slug: 'other' }),
			/Missing trip/,
		);
		await writeFile(
			join(f.root, 'blog/unknown.mdx'),
			source(blogInput().metadata, '<Unknown />'),
		);
		const unknown = await f.store.read('blog/ru/unknown');
		assert.ok(unknown.readOnly);
		await assert.rejects(f.store.save(unknown), /только для чтения/);
		const before = await readFile(
			join(f.root, 'travel/media/photos.json'),
			'utf8',
		);
		await assert.rejects(
			f.store.saveGallery(
				{ ...gallery, items: [gallery.items[1]] },
				(await f.store.galleries())[0].version,
			),
			/используется/,
		);
		assert.equal(
			await readFile(join(f.root, 'travel/media/photos.json'), 'utf8'),
			before,
		);
	} finally {
		await f.clean();
	}
});
test('content root and individual symlinks cannot escape permitted directories', async () => {
	const f = await fixture();
	try {
		await symlink('/etc/passwd', join(f.root, 'blog/escape.mdx'));
		await assert.rejects(f.store.list(), /Символические ссылки/);
		await assert.rejects(
			f.store.safePath(join(f.root, '../outside')),
			/вне каталога/,
		);
		const link = `${f.root}-link`;
		await symlink(f.root, link);
		try {
			await assert.rejects(
				new ContentStore(link).list(),
				/Символические ссылки/,
			);
		} finally {
			await rm(link);
		}
	} finally {
		await f.clean();
	}
});
test('API restricts Host/Origin, validates inputs, and serves no originals or credentials', async () => {
	const f = await fixture();
	const app = createApi({ store: f.store });
	const headers = { host: '127.0.0.1:4323', origin: 'http://127.0.0.1:4322' };
	try {
		assert.equal((await app.inject({ url: '/api/materials' })).statusCode, 403);
		assert.equal(
			(
				await app.inject({
					method: 'POST',
					url: '/api/material',
					headers: { ...headers, origin: 'https://evil.test' },
					payload: blogInput(),
				})
			).statusCode,
			403,
		);
		assert.equal(
			(
				await app.inject({
					method: 'POST',
					url: '/api/material',
					headers,
					payload: blogInput(),
				})
			).statusCode,
			200,
		);
		assert.equal(
			(
				await app.inject({
					method: 'POST',
					url: '/api/material',
					headers,
					payload: {},
				})
			).statusCode,
			400,
		);
		assert.equal(
			(await app.inject({ url: `/media/${hash}/original.jpeg`, headers }))
				.statusCode,
			400,
		);
		assert.equal((await app.inject({ url: '/.env', headers })).statusCode, 404);
		const list = await app.inject({ url: '/api/materials', headers });
		assert.equal(list.statusCode, 200);
		assert.ok(!list.body.includes('MEDIA_S3'));
		assert.equal(
			(await app.inject({ url: '/api/material?id=../../.env', headers }))
				.statusCode,
			404,
		);
	} finally {
		await app.close();
		await f.clean();
	}
});
test('append media without old originals; metadata and order need no preparation; S3 failure remains retryable', async () => {
	const f = await fixture();
	let attempts = 0;
	const calls: string[][] = [];
	const media = new MediaManager(
		f.store,
		async (_batch, ids) => {
			attempts++;
			if (attempts === 1) throw new Error('S3 unavailable');
			calls.push(ids!);
		},
		join(f.root, 'state'),
	);
	const finish = async (job: Job) => {
		for (let i = 0; i < 1000 && !['done', 'error'].includes(job.stage); i++)
			await new Promise((r) => setTimeout(r, 10));
		return job;
	};
	try {
		const dir = join(media.state.root, 'uploads', 'admin-test');
		await mkdir(dir, { recursive: true });
		const file = join(dir, 'new.jpeg');
		await sharp({
			create: { width: 20, height: 10, channels: 3, background: '#258' },
		})
			.jpeg()
			.toFile(file);
		await media.prepare(
			'photos',
			'admin-test',
			[{ id: 'new-image', file }],
			(await f.store.galleries())[0].version,
		);
		let current = (await f.store.galleries())[0];
		assert.equal(current.items.length, 3);
		current.items.reverse();
		current.items[0].alt.ru = 'Новое описание';
		await f.store.saveGallery(current, current.version);
		assert.equal((await finish(media.publish('photos'))).stage, 'error');
		assert.equal((await media.pending('photos')).length, 1);
		assert.equal((await finish(media.publish('photos'))).stage, 'done');
		assert.equal((await media.pending('photos')).length, 0);
		assert.ok(calls[0].includes('new-image'));
		current = (await f.store.galleries())[0];
		assert.equal(current.items[0].alt.ru, 'Новое описание');
	} finally {
		await f.clean();
	}
});
test('preview includes travel drafts only when explicitly enabled', () => {
	const data = tripSchema.parse(trip);
	assert.equal(
		buildTravelCatalog([{ id: 'sample', data }], []).trips.length,
		0,
	);
	assert.equal(
		buildTravelCatalog([{ id: 'sample', data }], [], true).trips.length,
		1,
	);
});

test('S3 publisher only reads selected new originals from a prepared batch', async (t) => {
	const f = await fixture();
	const keys = {
		MEDIA_S3_ENDPOINT: 'https://s3.example.test',
		MEDIA_S3_REGION: 'us-east-1',
		MEDIA_S3_ORIGINALS_BUCKET: 'originals',
		MEDIA_S3_PUBLISHED_BUCKET: 'published',
		MEDIA_S3_ACCESS_KEY_ID: 'test-key',
		MEDIA_S3_SECRET_ACCESS_KEY: 'test-secret',
	};
	const previous = Object.fromEntries(
		Object.keys(keys).map((key) => [key, process.env[key]]),
	);
	const objects = new Map<string, number>();
	t.mock.method(
		globalThis,
		'fetch',
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = new Request(input, init);
			const path = new URL(request.url).pathname;
			if (request.method === 'PUT') {
				objects.set(path, (await request.arrayBuffer()).byteLength);
				return new Response('', { status: 200 });
			}
			return new Response(null, {
				status: objects.has(path) ? 200 : 404,
				headers: objects.has(path)
					? { 'content-length': String(objects.get(path)) }
					: {},
			});
		},
	);
	try {
		Object.assign(process.env, keys);
		for (const [name, color] of [
			['old', '#123'],
			['new', '#456'],
		])
			await sharp({
				create: { width: 20, height: 10, channels: 3, background: color },
			})
				.jpeg()
				.toFile(join(f.root, `${name}.jpeg`));
		const id = `admin-selection-${Date.now()}`;
		const input = join(f.root, 'input.json');
		await writeFile(
			input,
			JSON.stringify({
				id,
				items: ['old', 'new'].map((name) => ({
					id: name,
					file: `${name}.jpeg`,
					alt: { ru: '', en: '' },
				})),
			}),
		);
		await prepareGallery(input, join(f.root, 'manifests'));
		await rm(join(f.root, 'old.jpeg'));
		await publishGallery(id, ['new']);
		assert.equal(
			[...objects.keys()].filter((key) => key.startsWith('/originals/')).length,
			1,
		);
		assert.ok([...objects.keys()].some((key) => key.endsWith('.jxl')));
	} finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await f.clean();
	}
});

test('shutdown aborts media subprocesses and prevents further S3 requests', async () => {
	const controller = new AbortController();
	const child = run(
		process.execPath,
		['-e', 'setTimeout(() => {}, 60000)'],
		controller.signal,
	);
	controller.abort();
	await assert.rejects(child, { name: 'AbortError' });
	await assert.rejects(publishGallery('photos', [], controller.signal), {
		name: 'AbortError',
	});
});
