import { createHash, randomUUID } from 'node:crypto';
import {
	lstat,
	readFile,
	readdir,
	mkdir,
	rename,
	writeFile,
	rm,
} from 'node:fs/promises';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseDocument } from 'yaml';
import { z } from 'astro/zod';
import { blogSchema } from '../../src/data/blog.mts';
import {
	tripSchema,
	entrySchema,
	gallerySchema,
	slugSchema,
	buildTravelCatalog,
	type Gallery,
} from '../../src/data/travel.mts';
import {
	parseBody,
	serializeBody,
	galleryIds,
	safeUrl,
	type EditorNode,
} from './mdx';

export class AdminError extends Error {
	constructor(
		message: string,
		public statusCode = 400,
	) {
		super(message);
	}
}
export const versionOf = (source: string | Buffer) =>
	createHash('sha256').update(source).digest('hex');
export type RecordData = Record<string, any>;
export type Material = {
	id: string;
	type: 'blog' | 'trip' | 'entry';
	locale: 'ru' | 'en';
	slug: string;
	trip?: string;
	metadata: RecordData;
	version: string;
	document?: EditorNode;
	readOnly?: string;
	sourceBody?: string;
};
export const materialInput = z.object({
	id: z.string().optional(),
	type: z.enum(['blog', 'trip', 'entry']),
	locale: z.enum(['ru', 'en']),
	slug: slugSchema,
	trip: slugSchema.optional(),
	version: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()),
	document: z.unknown().optional(),
});
export type MaterialInput = z.infer<typeof materialInput>;
const fields = {
	blog: [
		'title',
		'description',
		'publishDate',
		'updatedDate',
		'heroImage',
		'hidden',
	],
	trip: [
		'title',
		'description',
		'destinations',
		'startDate',
		'endDate',
		'collage',
		'draft',
	],
	entry: ['kind', 'title', 'description', 'order', 'date', 'collage', 'draft'],
};
const schemas = { blog: blogSchema, trip: tripSchema, entry: entrySchema };

export function splitSource(source: string) {
	const match = /^(---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(source);
	if (!match) throw new AdminError('Файл не содержит frontmatter');
	const yaml = parseDocument(match[2]);
	if (yaml.errors.length) throw new AdminError(yaml.errors[0].message);
	const metadata = yaml.toJS();
	if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
		throw new AdminError('Frontmatter должен быть объектом');
	return {
		metadata: metadata as RecordData,
		body: source.slice(match[0].length),
		header: match[0],
		yaml,
		json: match[2].trimStart().startsWith('{'),
	};
}

export class ContentStore {
	readonly root: string;
	private queue: Promise<unknown> = Promise.resolve();
	constructor(root = 'src/content') {
		this.root = resolve(root);
	}
	exclusive<T>(task: () => Promise<T>): Promise<T> {
		const next = this.queue.then(task, task);
		this.queue = next.catch(() => {});
		return next;
	}
	async safePath(file: string) {
		const absolute = resolve(file);
		if (absolute !== this.root && !absolute.startsWith(this.root + sep))
			throw new AdminError('Путь вне каталога контента');
		// Check every ancestor, including the content root itself, before reads and writes.
		let current: string = sep;
		for (const part of absolute.split(sep).filter(Boolean)) {
			current = join(current, part);
			try {
				if ((await lstat(current)).isSymbolicLink())
					throw new AdminError('Символические ссылки запрещены');
			} catch (error: any) {
				if (error.code !== 'ENOENT') throw error;
			}
		}
		return absolute;
	}
	async walk(directory: string): Promise<string[]> {
		await this.safePath(directory);
		let names;
		try {
			names = await readdir(directory, { withFileTypes: true });
		} catch (error: any) {
			if (error.code === 'ENOENT') return [];
			throw error;
		}
		const result: string[] = [];
		for (const item of names) {
			if (item.isSymbolicLink())
				throw new AdminError('Символические ссылки запрещены');
			const file = join(directory, item.name);
			if (item.isDirectory()) result.push(...(await this.walk(file)));
			else result.push(file);
		}
		return result;
	}
	async files() {
		const result: {
			file: string;
			id: string;
			type: Material['type'];
			locale: Material['locale'];
			slug: string;
			trip?: string;
		}[] = [];
		for (const [directory, type, language] of [
			['blog', 'blog', 'ru'],
			['blogEn', 'blog', 'en'],
			['travel/trips', 'trip', null],
			['travel/entries', 'entry', null],
		] as const) {
			for (const file of await this.walk(join(this.root, directory))) {
				if (!(type === 'blog' ? /\.mdx?$/ : /\.(ru|en)\.mdx$/).test(file))
					continue;
				const local = relative(join(this.root, directory), file);
				const locale =
					language ?? (/\.(ru|en)\.mdx$/.exec(local)![1] as Material['locale']);
				const slugPath = local.replace(
					type === 'blog' ? /\.mdx?$/ : /\.(ru|en)\.mdx$/,
					'',
				);
				result.push({
					file,
					id: `${type}/${locale}/${slugPath}`,
					type,
					locale,
					slug: slugPath.split('/').at(-1)!,
					...(type === 'entry' ? { trip: slugPath.split('/')[0] } : {}),
				});
			}
		}
		if (new Set(result.map((r) => r.id)).size !== result.length)
			throw new AdminError('Дублирующиеся файлы материалов');
		return result;
	}
	async list() {
		return await Promise.all(
			(await this.files()).map(async ({ file, ...identity }) => {
				const source = await readFile(await this.safePath(file), 'utf8');
				return {
					...identity,
					metadata: splitSource(source).metadata,
					version: versionOf(source),
				};
			}),
		);
	}
	async read(id: string): Promise<Material> {
		const target = (await this.files()).find((item) => item.id === id);
		if (!target) throw new AdminError('Материал не найден', 404);
		const source = await readFile(await this.safePath(target.file), 'utf8');
		const { file, ...identity } = target;
		const parsed = splitSource(source);
		const result: Material = {
			...identity,
			metadata: parsed.metadata,
			version: versionOf(source),
		};
		try {
			result.document = parseBody(parsed.body);
		} catch (error: any) {
			result.readOnly = error.message;
			result.sourceBody = parsed.body;
		}
		return result;
	}
	async atomic(file: string, value: string, expected: string | null) {
		await this.safePath(file);
		let previous: string | null = null;
		try {
			previous = versionOf(await readFile(file));
		} catch (error: any) {
			if (error.code !== 'ENOENT') throw error;
		}
		if (previous !== expected)
			throw new AdminError(
				'Файл изменён извне. Откройте его заново перед сохранением.',
				409,
			);
		await mkdir(dirname(file), { recursive: true });
		const temp = `${file}.${randomUUID()}.tmp`;
		try {
			await writeFile(temp, value, { flag: 'wx' });
			await this.safePath(file);
			let latest: string | null = null;
			try {
				latest = versionOf(await readFile(file));
			} catch (error: any) {
				if (error.code !== 'ENOENT') throw error;
			}
			if (latest !== expected)
				throw new AdminError('Файл изменён извне. Сохранение отменено.', 409);
			await rename(temp, file);
		} finally {
			await rm(temp, { force: true });
		}
	}
	async galleries() {
		const result = [];
		for (const file of await this.walk(join(this.root, 'travel/media'))) {
			if (!file.endsWith('.json')) continue;
			const source = await readFile(await this.safePath(file), 'utf8');
			const gallery = gallerySchema.parse(JSON.parse(source));
			if (file !== join(this.root, 'travel/media', `${gallery.id}.json`))
				throw new AdminError('Имя файла не совпадает с ID галереи');
			result.push({ ...gallery, version: versionOf(source) });
		}
		return result;
	}
	async validateReferences(metadata: RecordData, doc: EditorNode) {
		const galleries = await this.galleries();
		for (const id of galleryIds(doc))
			if (!galleries.some((g) => g.id === id))
				throw new AdminError(`Не найдена галерея: ${id}`);
		for (const ref of metadata.collage ?? []) {
			const [gallery, id] = ref.split('/');
			if (
				!galleries
					.find((g) => g.id === gallery)
					?.items.some((item) => item.id === id && item.kind === 'image')
			)
				throw new AdminError(`Не найдена фотография коллажа: ${ref}`);
		}
		if (metadata.heroImage) {
			safeUrl(metadata.heroImage);
			if (
				metadata.heroImage.startsWith('/media/') &&
				!galleries.some((g) =>
					g.items.some(
						(item) =>
							item.kind === 'image' &&
							item.sources.some((s) => s.url === metadata.heroImage),
					),
				)
			)
				throw new AdminError('Обложка не найдена в медиабиблиотеке');
		}
	}
	async save(raw: MaterialInput) {
		return this.exclusive(async () => {
			const input = materialInput.parse(raw);
			const id = `${input.type}/${input.locale}/${input.type === 'entry' ? `${slugSchema.parse(input.trip)}/` : ''}${input.slug}`;
			if (input.id && input.id !== id)
				throw new AdminError(
					'Slug, язык и поездку существующего материала менять нельзя',
				);
			const existing = (await this.files()).find((item) => item.id === id);
			if (existing && !input.id)
				throw new AdminError('Материал с таким slug уже существует', 409);
			if (!existing && input.id)
				throw new AdminError('Материал не найден', 404);
			const file =
				existing?.file ??
				join(
					this.root,
					input.type === 'blog'
						? input.locale === 'ru'
							? 'blog'
							: 'blogEn'
						: input.type === 'trip'
							? 'travel/trips'
							: `travel/entries/${input.trip}`,
					`${input.slug}${input.type === 'blog' ? '' : `.${input.locale}`}.mdx`,
				);
			const source = existing
				? await readFile(await this.safePath(file), 'utf8')
				: null;
			if ((source === null ? null : versionOf(source)) !== input.version)
				throw new AdminError('Файл изменён извне. Откройте его заново.', 409);
			const parsed = source === null ? null : splitSource(source);
			let originalDocument: EditorNode;
			try {
				originalDocument = parseBody(parsed?.body ?? '');
			} catch {
				throw new AdminError('Неподдерживаемый MDX доступен только для чтения');
			}
			const metadata: RecordData = {
				...(parsed?.metadata ??
					(input.type === 'blog' ? { hidden: true } : { draft: true })),
			};
			for (const key of fields[input.type]) {
				if (!(key in input.metadata)) continue;
				if (input.metadata[key] === '' || input.metadata[key] === null)
					delete metadata[key];
				else metadata[key] = input.metadata[key];
			}
			if (input.type !== 'blog')
				Object.assign(
					metadata,
					{ slug: input.slug, locale: input.locale },
					input.type === 'entry' ? { trip: input.trip } : {},
				);
			schemas[input.type].parse(metadata);
			const doc =
				input.document === undefined
					? originalDocument
					: (input.document as EditorNode);
			const body =
				input.document === undefined || isDeepStrictEqual(doc, originalDocument)
					? (parsed?.body ?? '\n')
					: `\n${serializeBody(doc)}`;
			await this.validateReferences(metadata, doc);
			const all = (await this.list()).filter((item) => item.id !== id);
			all.push({
				id,
				type: input.type,
				locale: input.locale,
				slug: input.slug,
				metadata,
				version: '',
			});
			buildTravelCatalog(
				all
					.filter((m) => m.type === 'trip')
					.map((m) => ({ id: m.id, data: tripSchema.parse(m.metadata) })),
				all
					.filter((m) => m.type === 'entry')
					.map((m) => ({ id: m.id, data: entrySchema.parse(m.metadata) })),
			);
			let header = parsed?.header;
			if (!parsed || !isDeepStrictEqual(parsed.metadata, metadata)) {
				if (parsed && !parsed.json) {
					for (const key of Object.keys(parsed.metadata))
						if (!(key in metadata)) parsed.yaml.delete(key);
					for (const [key, value] of Object.entries(metadata))
						if (!isDeepStrictEqual(parsed.metadata[key], value))
							parsed.yaml.set(key, value);
					header = `---\n${parsed.yaml.toString()}---\n`;
				} else header = `---\n${JSON.stringify(metadata, null, 2)}\n---\n`;
			}
			if (header + body !== source)
				await this.atomic(file, header + body, input.version);
			return this.read(id);
		});
	}
	async saveGallery(gallery: Gallery, version: string | null) {
		const old = (await this.galleries()).find((g) => g.id === gallery.id);
		const next = gallerySchema.parse(gallery);
		if (old)
			for (const item of old.items) {
				const replacement = next.items.find((n) => n.id === item.id);
				if (
					replacement &&
					!isDeepStrictEqual(
						{ ...item, alt: undefined, caption: undefined },
						{ ...replacement, alt: undefined, caption: undefined },
					)
				)
					throw new AdminError('Готовые файлы медиа менять нельзя');
				if (!replacement)
					for (const material of await this.list()) {
						if (
							material.metadata.collage?.includes(`${old.id}/${item.id}`) ||
							(item.kind === 'image' &&
								item.sources.some((s) => material.metadata.heroImage === s.url))
						)
							throw new AdminError(
								`Медиа используется в коллаже или обложке: ${material.metadata.title ?? material.id}`,
							);
					}
			}
		await this.atomic(
			join(this.root, 'travel/media', `${next.id}.json`),
			JSON.stringify(next, null, 2) + '\n',
			version,
		);
		return (await this.galleries()).find((g) => g.id === next.id)!;
	}
}
