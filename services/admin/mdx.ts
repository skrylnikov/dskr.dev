import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';

export type EditorNode = {
	type: string;
	text?: string;
	attrs?: Record<string, any>;
	marks?: { type: string; attrs?: Record<string, any> }[];
	content?: EditorNode[];
};
type Ast = {
	type: string;
	children?: Ast[];
	value?: string;
	depth?: number;
	ordered?: boolean;
	start?: number | null;
	checked?: boolean | null;
	lang?: string | null;
	meta?: string | null;
	url?: string;
	title?: string | null;
	alt?: string | null;
	align?: (string | null)[];
	name?: string | null;
	attributes?: { type: string; name?: string; value?: unknown }[];
};
const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkMdx)
	.use(remarkStringify, { bullet: '-', fences: true });
const unsupported = (type: string): never => {
	throw new Error(`Визуальный редактор не поддерживает: ${type}`);
};
const children = (node: Ast) => (node.children ?? []).flatMap(fromAst);
const markOrder = ['link', 'bold', 'italic', 'strike', 'code'];
const content = (node: EditorNode) =>
	mergeInline((node.content ?? []).map(toAst));
function mergeInline(nodes: Ast[]): Ast[] {
	const merged: Ast[] = [];
	const isMark = (node: Ast) =>
		['strong', 'emphasis', 'delete', 'link'].includes(node.type);
	for (const node of nodes) {
		const previous = merged.at(-1);
		if (
			previous &&
			isMark(node) &&
			previous.type === node.type &&
			previous.url === node.url &&
			previous.title === node.title
		)
			previous.children!.push(...node.children!);
		else merged.push(node);
	}
	return merged.flatMap((node) => {
		if (!isMark(node)) return [node];
		node.children = mergeInline(node.children ?? []);
		if (node.type === 'link') return [node];
		const first = node.children[0],
			last = node.children.at(-1);
		const leading =
			first?.type === 'text' ? (/^\s+/.exec(first.value ?? '')?.[0] ?? '') : '';
		if (leading) first.value = first.value!.slice(leading.length);
		const trailing =
			last?.type === 'text' ? (/\s+$/.exec(last.value ?? '')?.[0] ?? '') : '';
		if (trailing) last!.value = last!.value!.slice(0, -trailing.length);
		node.children = node.children.filter((n) => n.type !== 'text' || n.value);
		return [
			...(leading ? [{ type: 'text', value: leading }] : []),
			...(node.children.length ? [node] : []),
			...(trailing ? [{ type: 'text', value: trailing }] : []),
		];
	});
}

function fromAst(node: Ast): EditorNode[] {
	switch (node.type) {
		case 'root':
			return [{ type: 'doc', content: children(node) }];
		case 'text':
			return node.value ? [{ type: 'text', text: node.value }] : [];
		case 'paragraph':
			return [{ type: 'paragraph', content: children(node) }];
		case 'heading':
			return [
				{
					type: 'heading',
					attrs: { level: node.depth },
					content: children(node),
				},
			];
		case 'strong':
		case 'emphasis':
		case 'delete':
		case 'link': {
			const mark = {
				type: {
					strong: 'bold',
					emphasis: 'italic',
					delete: 'strike',
					link: 'link',
				}[node.type],
				...(node.type === 'link'
					? { attrs: { href: safeUrl(node.url!), title: node.title ?? null } }
					: {}),
			};
			return children(node).map((child) => {
				if (child.type !== 'text')
					return unsupported(`форматирование ${child.type}`);
				return {
					...child,
					marks: [...(child.marks ?? []), mark].sort(
						(a, b) => markOrder.indexOf(a.type) - markOrder.indexOf(b.type),
					),
				};
			});
		}
		case 'inlineCode':
			return [{ type: 'text', text: node.value!, marks: [{ type: 'code' }] }];
		case 'break':
			return [{ type: 'hardBreak' }];
		case 'thematicBreak':
			return [{ type: 'horizontalRule' }];
		case 'blockquote':
			return [{ type: 'blockquote', content: children(node) }];
		case 'code':
			if (node.meta) return unsupported('метаданные блока кода');
			return [
				{
					type: 'codeBlock',
					attrs: { language: node.lang ?? null },
					content: node.value ? [{ type: 'text', text: node.value }] : [],
				},
			];
		case 'image':
			return [
				{
					type: 'image',
					attrs: {
						src: safeUrl(node.url!),
						alt: node.alt ?? '',
						title: node.title ?? null,
					},
				},
			];
		case 'list':
			return [
				{
					type: node.ordered ? 'orderedList' : 'bulletList',
					...(node.ordered ? { attrs: { start: node.start ?? 1 } } : {}),
					content: children(node),
				},
			];
		case 'listItem':
			if (node.checked != null) return unsupported('список задач');
			return [{ type: 'listItem', content: children(node) }];
		case 'table':
			return [
				{
					type: 'table',
					content: (node.children ?? []).map((row, rowIndex) => ({
						type: 'tableRow',
						content: (row.children ?? []).map((cell, index) => ({
							type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
							attrs: { textAlign: node.align?.[index] ?? null },
							content: [{ type: 'paragraph', content: children(cell) }],
						})),
					})),
				},
			];
		case 'mdxJsxFlowElement':
		case 'mdxJsxTextElement': {
			if (
				node.name === 'MediaGallery' &&
				!node.children?.length &&
				node.attributes?.length === 1
			) {
				const attr = node.attributes[0];
				if (
					attr.type === 'mdxJsxAttribute' &&
					attr.name === 'gallery' &&
					typeof attr.value === 'string' &&
					/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(attr.value)
				)
					return [{ type: 'mediaGallery', attrs: { gallery: attr.value } }];
			}
			if (node.name === 'details' && !node.attributes?.length) {
				const [first, ...body] = node.children ?? [];
				const summary =
					first?.type === 'paragraph' && first.children?.length === 1
						? first.children[0]
						: first;
				if (summary?.name !== 'summary' || summary.attributes?.length)
					return unsupported('details без обычного summary');
				return [
					{
						type: 'details',
						content: [
							{
								type: 'detailsSummary',
								content: (summary.children ?? []).flatMap((child) =>
									child.type === 'paragraph' ? children(child) : fromAst(child),
								),
							},
							{ type: 'detailsContent', content: body.flatMap(fromAst) },
						],
					},
				];
			}
			return unsupported(`JSX ${node.name}`);
		}
		default:
			return unsupported(node.type);
	}
}

export function safeUrl(url: string) {
	if (
		/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(url) &&
		!/[\x00-\x20\\]/.test(url)
	)
		return url;
	throw new Error(`Недопустимый URL: ${url}`);
}

function toAst(node: EditorNode): Ast {
	if (node.type === 'text') {
		let result: Ast = { type: 'text', value: node.text ?? '' };
		for (const mark of [...(node.marks ?? [])].sort(
			(a, b) => markOrder.indexOf(b.type) - markOrder.indexOf(a.type),
		)) {
			if (mark.type === 'code') {
				if (result.type !== 'text')
					return unsupported('форматирование внутри кода');
				result = { type: 'inlineCode', value: node.text ?? '' };
			} else if (mark.type === 'link')
				result = {
					type: 'link',
					url: safeUrl(mark.attrs?.href),
					title: mark.attrs?.title ?? null,
					children: [result],
				};
			else {
				const type = (
					{ bold: 'strong', italic: 'emphasis', strike: 'delete' } as Record<
						string,
						string
					>
				)[mark.type];
				if (!type) return unsupported(mark.type);
				result = { type, children: [result] };
			}
		}
		return result;
	}
	switch (node.type) {
		case 'doc':
			return { type: 'root', children: content(node) };
		case 'paragraph':
			return { type: 'paragraph', children: content(node) };
		case 'heading':
			return {
				type: 'heading',
				depth: node.attrs?.level ?? 2,
				children: content(node),
			};
		case 'blockquote':
			return { type: 'blockquote', children: content(node) };
		case 'hardBreak':
			return { type: 'break' };
		case 'horizontalRule':
			return { type: 'thematicBreak' };
		case 'codeBlock':
			if (
				node.attrs?.language &&
				!/^[a-zA-Z0-9_+.-]+$/.test(node.attrs.language)
			)
				return unsupported('язык кода: используйте одно имя без пробелов');
			return {
				type: 'code',
				lang: node.attrs?.language || null,
				value: (node.content ?? []).map((n) => n.text ?? '').join(''),
			};
		case 'image':
			return {
				type: 'image',
				url: safeUrl(node.attrs?.src),
				alt: node.attrs?.alt ?? '',
				title: node.attrs?.title ?? null,
			};
		case 'bulletList':
		case 'orderedList':
			return {
				type: 'list',
				ordered: node.type === 'orderedList',
				start: node.attrs?.start ?? 1,
				children: content(node),
			};
		case 'listItem':
			return { type: 'listItem', children: content(node) };
		case 'table': {
			const rows = node.content ?? [];
			if (
				!rows.length ||
				rows[0].content?.some((cell) => cell.type !== 'tableHeader')
			)
				return unsupported('таблица без строки заголовков');
			const align = rows[0].content?.map(
				(cell) => cell.attrs?.textAlign ?? null,
			);
			return {
				type: 'table',
				align,
				children: rows.map((row) => ({
					type: 'tableRow',
					children: (row.content ?? []).map((cell, index) => {
						if (
							(cell.attrs?.colspan ?? 1) !== 1 ||
							(cell.attrs?.rowspan ?? 1) !== 1 ||
							(cell.attrs?.textAlign ?? null) !== align?.[index] ||
							cell.content?.length !== 1 ||
							cell.content[0].type !== 'paragraph'
						)
							return unsupported(
								'объединённые ячейки, разные выравнивания или многострочные ячейки',
							);
						return { type: 'tableCell', children: content(cell.content[0]) };
					}),
				})),
			};
		}
		case 'mediaGallery':
			if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(node.attrs?.gallery))
				return unsupported('идентификатор галереи');
			return {
				type: 'mdxJsxFlowElement',
				name: 'MediaGallery',
				attributes: [
					{
						type: 'mdxJsxAttribute',
						name: 'gallery',
						value: node.attrs!.gallery,
					},
				],
				children: [],
			};
		case 'details': {
			const [summary, body] = node.content ?? [];
			if (summary?.type !== 'detailsSummary' || body?.type !== 'detailsContent')
				return unsupported('структура details');
			return {
				type: 'mdxJsxFlowElement',
				name: 'details',
				attributes: [],
				children: [
					{
						type: 'mdxJsxFlowElement',
						name: 'summary',
						attributes: [],
						children: [{ type: 'paragraph', children: content(summary) }],
					},
					...content(body),
				],
			};
		}
		default:
			return unsupported(node.type);
	}
}

export function parseBody(body: string): EditorNode {
	return fromAst(processor.parse(body) as unknown as Ast)[0];
}
export function serializeBody(doc: EditorNode): string {
	const body = processor.stringify(toAst(doc) as any);
	// Validate generated MDX as well: text containing JSX syntax must stay literal.
	parseBody(body);
	return body;
}
export function galleryIds(doc: EditorNode): string[] {
	return [
		...new Set([
			...(doc.type === 'mediaGallery' ? [doc.attrs?.gallery as string] : []),
			...(doc.content ?? []).flatMap(galleryIds),
		]),
	];
}
