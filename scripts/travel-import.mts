import { readFile, writeFile, mkdir, realpath, stat, readdir } from 'node:fs/promises';
import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'astro/zod';
import { slugSchema } from '../src/data/travel.mts';
import { pickCollagePhotos } from '../src/data/travel-media.mts';
import { parseHTML } from 'linkedom';

const mappingSchema = z.object({ trip: slugSchema, title: z.string().min(1), description: z.string().min(1), destinations: z.array(z.string()).min(1), startDate: z.iso.date(), endDate: z.iso.date().optional(), entries: z.array(z.object({ slug: slugSchema, kind: z.enum(['chapter', 'note']), title: z.string().optional(), description: z.string().optional(), messageIds: z.array(z.number().int()).min(1) })).min(1) }).refine((mapping) => !mapping.endDate || mapping.endDate >= mapping.startDate, 'Trip ends before it starts');
const entitySchema = z.union([z.string(), z.object({ type: z.string().optional(), text: z.string(), href: z.string().optional() })]);
const messageSchema = z.object({ id: z.number().int(), type: z.string(), date: z.string().optional(), text: z.union([z.string(), z.array(entitySchema)]).optional(), text_entities: z.array(entitySchema).optional(), photo: z.string().optional(), file: z.string().optional(), media_type: z.string().optional(), mime_type: z.string().optional() });
type ExportBlock = { kind: 'text'; mdx: string } | { kind: 'media'; mediaType: 'photo' | 'video' | 'file'; file: string; caption?: string } | { kind: 'break' };
type Message = z.infer<typeof messageSchema> & { blocks?: ExportBlock[] };

export const escapeMdx = (text: string) => text.replace(/[&<>{}\\`*_\[\]#!|]/g, (char) => `&#${char.charCodeAt(0)};`);
const finishMdx = (text: string) => text.replace(/^([ \t]*)(import|export)(?=\s)/gm, (_, indent, word) => `${indent}&#${word.charCodeAt(0)};${word.slice(1)}`).replace(/(?<!\n)\n(?!\n)/g, '  \n');
const mdxLink = (text: string, href?: string | null) => href && /^(https?:|mailto:)/i.test(href) ? `[${text}](${href.replace(/[\s()<>"\\{}\[\]`]/g, (char) => encodeURIComponent(char).replace(/[()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))})` : text;
export function telegramText(message: Pick<Message, 'text' | 'text_entities'>): string {
	const entities = message.text_entities ?? (Array.isArray(message.text) ? message.text : [message.text ?? '']);
	return finishMdx(entities.map((entity) => {
		if (typeof entity === 'string') return escapeMdx(entity);
		const text = escapeMdx(entity.text);
		if (entity.type === 'bold') return `**${text}**`;
		if (entity.type === 'italic') return `*${text}*`;
		if (entity.type === 'strikethrough') return `~~${text}~~`;
		if (entity.type === 'code' || entity.type === 'pre') return `<${entity.type === 'pre' ? 'pre' : 'code'}>${text}</${entity.type === 'pre' ? 'pre' : 'code'}>`;
		const href = entity.type === 'text_link' ? entity.href : entity.type === 'link' ? entity.text : undefined;
		return mdxLink(text, href);
	}).join(''));
}

function htmlText(node: Node): string {
	if (node.nodeType === 3) return escapeMdx(node.textContent || '');
	if (node.nodeType !== 1) return '';
	const element = node as Element;
	const tag = element.tagName.toLowerCase();
	if (['script', 'style', 'iframe', 'object', 'svg', 'form'].includes(tag)) return '';
	if (tag === 'br') return '\n';
	const text = [...node.childNodes].map(htmlText).join('');
	if (tag === 'a') return mdxLink(text, element.getAttribute('href'));
	if (tag === 'b' || tag === 'strong') return `**${text}**`;
	if (tag === 'i' || tag === 'em') return `*${text}*`;
	if (tag === 's' || tag === 'del') return `~~${text}~~`;
	if (tag === 'code' || tag === 'pre') return `<${tag}>${text}</${tag}>`;
	if (tag === 'blockquote') return text.trim().split('\n').map((line) => `> ${line}`).join('\n') + '\n\n';
	return tag === 'p' || tag === 'div' ? `${text}\n\n` : text;
}

export function parseTelegramHtml(html: string): Message[] {
	const { document } = parseHTML(html);
	const messages: Message[] = [];
	let previousDate: string | undefined;
	for (const message of document.querySelectorAll('.message.default[id]')) {
		const id = message.id.match(/^message(\d+)$/);
		if (!id) throw new Error(`Unsupported HTML message id: ${message.id}`);
		const dateTitle = message.querySelector('.date[title]')?.getAttribute('title');
		if (dateTitle) {
			const numeric = dateTitle.match(/^(\d{2})\.(\d{2})\.(\d{4})\b/);
			const russian = dateTitle.match(/^(\d{1,2})\s+([а-я]+)\s+(\d{4})\b/iu);
			const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
			const month = russian ? months.indexOf(russian[2].toLowerCase()) + 1 : 0;
			const date = numeric ? `${numeric[3]}-${numeric[2]}-${numeric[1]}` : russian && month ? `${russian[3]}-${String(month).padStart(2, '0')}-${russian[1].padStart(2, '0')}` : undefined;
			if (!date) throw new Error(`Unsupported HTML date: ${dateTitle}`);
			previousDate = z.iso.date().parse(date);
		}
		const blocks: ExportBlock[] = [];
		const addText = (node: Element) => { const text = htmlText(node).trim(); if (text) blocks.push({ kind: 'text', mdx: finishMdx(text) }); };
		const addMedia = (anchor: Element, caption?: string) => {
			const href = anchor.getAttribute('href');
			if (!href) throw new Error(`Missing attachment href in ${message.id}`);
			const mediaType = anchor.matches('.photo_wrap,.media_photo') ? 'photo' : anchor.matches('.video_file_wrap,.media_video') ? 'video' : 'file';
			blocks.push({ kind: 'media', mediaType, file: decodeURIComponent(href.split(/[?#]/)[0]), caption });
		};
		const walk = (element: Element) => {
			if (element.matches('.date,.from_name,.reactions,.reply_to,.forwarded,.userpic_wrap')) return;
			if (element.matches('.rich_media_item')) {
				const anchor = element.querySelector('a.photo_wrap,a.video_file_wrap,a.media_video,a.media_photo,a.media_file');
				if (!anchor) throw new Error(`Unsupported rich attachment in ${message.id}`);
				const caption = element.querySelector('figcaption')?.textContent.trim().replace(/\s+/g, ' ');
				addMedia(anchor, caption);
				return;
			}
			if (element.matches('.rich_media_group')) {
				blocks.push({ kind: 'break' });
				for (const child of element.children) if (child.tagName !== 'FIGCAPTION') walk(child);
				blocks.push({ kind: 'break' });
				const caption = element.querySelector(':scope > figcaption');
				if (caption) addText(caption);
				return;
			}
			if (element.matches('a.photo_wrap,a.video_file_wrap,a.media_video,a.media_photo,a.media_file')) { addMedia(element); return; }
			if (element.matches('.text') && !element.querySelector('.rich_block')) { addText(element); return; }
			if (element.matches('.rich_paragraph')) { addText(element); return; }
			if (element.matches('.rich_block')) throw new Error(`Unsupported rich block in ${message.id}: ${element.getAttribute('data-rich-kind')}`);
			for (const child of element.children) walk(child);
		};
		const body = message.querySelector(':scope > .body');
		if (!body) throw new Error(`Missing HTML body: ${message.id}`);
		walk(body);
		messages.push({ id: Number(id[1]), type: 'message', date: previousDate, blocks });
	}
	if (!messages.length) throw new Error('No Telegram messages found in HTML export');
	return messages;
}

export async function readTelegramExport(exportFile: string): Promise<Message[]> {
	if (!/\.html?$/i.test(exportFile)) return z.object({ messages: z.array(messageSchema) }).parse(JSON.parse(await readFile(exportFile, 'utf8'))).messages;
	const root = await realpath(dirname(exportFile));
	const pages = (await readdir(root)).filter((file) => /^messages(?:\d+)?\.html$/.test(file)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
	if (!pages.includes(exportFile.split(/[\\/]/).pop()!)) throw new Error('Select messages.html from a Telegram export');
	const messages: Message[] = [];
	const ids = new Set<number>();
	for (const page of pages) {
		const file = await realpath(join(root, page));
		if (dirname(file) !== root) throw new Error(`Export page escapes its folder: ${page}`);
		for (const message of parseTelegramHtml(await readFile(file, 'utf8'))) {
			if (ids.has(message.id)) throw new Error(`Duplicate HTML message: ${message.id}`);
			ids.add(message.id); messages.push(message);
		}
	}
	return messages;
}
async function createOnly(file: string, contents: string) {
	await mkdir(dirname(file), { recursive: true });
	try { await writeFile(file, contents, { flag: 'wx' }); return true; }
	catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false; throw error; }
}
const mdx = (frontmatter: unknown, body: string) => `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n\n${body}\n`;

export async function importTelegram(exportFile: string, mappingFile: string, root = 'src/content/travel') {
	const exported = await readTelegramExport(exportFile);
	const mapping = mappingSchema.parse(JSON.parse(await readFile(mappingFile, 'utf8')));
	const messages = new Map<number, Message>(exported.filter((message) => message.type === 'message').map((message) => [message.id, message]));
	const exportRoot = await realpath(dirname(exportFile));
	const report: { missing: string[]; created: string[]; skipped: string[] } = { missing: [], created: [], skipped: [] };
	const noteFile = async (file: string, contents: string) => { (await createOnly(file, contents) ? report.created : report.skipped).push(file); };
	const allIds = mapping.entries.flatMap((entry) => entry.messageIds);
	if (new Set(allIds).size !== allIds.length || new Set(mapping.entries.map((entry) => entry.slug)).size !== mapping.entries.length) throw new Error('Duplicate mapped message or entry slug');
	for (const entry of mapping.entries) if (entry.kind === 'chapter' && (!entry.title || !entry.description)) throw new Error(`Chapter needs title and description: ${entry.slug}`);
	const tripCollage: string[] = [];
	for (const [order, entry] of mapping.entries.entries()) {
		const galleryPrefix = `${mapping.trip}-${entry.slug}`;
		let group = 1;
		let items: { id: string; file: string; alt: { ru: string; en: string }; caption?: { ru: string; en: string } }[] = [];
		const blocks: string[] = [];
		const collage: string[] = [];
		const flushGallery = async () => {
			if (!items.length) return;
			const id = `${galleryPrefix}-${group++}`;
			await noteFile(join('.state/travel/import', mapping.trip, `${id}.json`), JSON.stringify({ id, items }, null, 2) + '\n');
			blocks.push(`<MediaGallery gallery="${id}" />`);
			items = [];
		};
		// Export order is authoritative; the mapping selects membership, not media order.
		const selected = [...messages.values()].filter((message) => entry.messageIds.includes(message.id));
		for (const id of entry.messageIds) if (!messages.has(id)) report.missing.push(`Message ${id}`);
		for (const message of selected) {
			const parts: ExportBlock[] = message.blocks ?? [
				...(message.photo ? [{ kind: 'media' as const, mediaType: 'photo' as const, file: message.photo }] : message.file ? [{ kind: 'media' as const, mediaType: message.media_type === 'video_file' || message.mime_type?.startsWith('video/') ? 'video' as const : 'file' as const, file: message.file }] : []),
				{ kind: 'text', mdx: telegramText(message) },
			];
			let mediaIndex = 0;
			for (const part of parts) {
				if (part.kind === 'break') { await flushGallery(); continue; }
				if (part.kind === 'text') { if (part.mdx.trim()) { await flushGallery(); blocks.push(part.mdx); } continue; }
				const mediaId = message.blocks ? `message-${message.id}-${++mediaIndex}` : `message-${message.id}`;
				if (part.mediaType === 'file') { report.missing.push(`Unsupported attachment in message ${message.id}: ${part.file}`); continue; }
				const file = resolve(exportRoot, part.file);
				let safe = false;
				try { const actual = await realpath(file); const path = relative(exportRoot, actual); safe = path !== '..' && !path.startsWith('../') && !isAbsolute(path) && (await stat(actual)).isFile(); } catch { /* Recorded below; the draft keeps the missing attachment marker. */ }
				if (!safe) { await flushGallery(); report.missing.push(`${message.id}: ${part.file}`); blocks.push(`<!-- Missing media: message ${message.id} -->`); }
				else {
					items.push({ id: mediaId, file, alt: { ru: part.caption || entry.title || 'Кадр из путешествия', en: 'Travel moment' }, ...(part.caption ? { caption: { ru: part.caption, en: '' } } : {}) });
					if (part.mediaType === 'photo') collage.push(`${galleryPrefix}-${group}/${mediaId}`);
				}
			}
		}
		await flushGallery();
		tripCollage.push(...collage);
		const frontmatter = { slug: entry.slug, trip: mapping.trip, locale: 'ru', kind: entry.kind, order, draft: true, date: selected[0]?.date?.slice(0, 10), title: entry.title, ...(entry.kind === 'chapter' ? { description: entry.description, collage: pickCollagePhotos(collage.length ? collage : [`${galleryPrefix}-1/missing-photo`]) } : {}), sourceMessageIds: entry.messageIds };
		await noteFile(join(root, 'entries', mapping.trip, `${entry.slug}.ru.mdx`), mdx(frontmatter, blocks.join('\n\n')));
	}
	const collage = pickCollagePhotos(tripCollage.length ? tripCollage : [`${mapping.trip}/missing-photo`]);
	await noteFile(join(root, 'trips', `${mapping.trip}.ru.mdx`), mdx({ slug: mapping.trip, locale: 'ru', title: mapping.title, description: mapping.description, destinations: mapping.destinations, startDate: mapping.startDate, endDate: mapping.endDate, collage, draft: true }, ''));
	const reportFile = join('.state/travel/import', mapping.trip, 'report.json');
	await mkdir(dirname(reportFile), { recursive: true }); await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
	return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	const [exportFile, mappingFile] = process.argv.slice(2);
	if (!exportFile || !mappingFile) throw new Error('Usage: pnpm travel:import <result.json|messages.html> <mapping.json>');
	const report = await importTelegram(resolve(exportFile), resolve(mappingFile));
	console.log(JSON.stringify(report, null, 2));
	if (report.missing.length) process.exitCode = 1;
}
