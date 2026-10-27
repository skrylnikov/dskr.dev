import { useMemo, useState } from 'react';
import {
	Button,
	Group,
	Modal,
	Select,
	Stack,
	TextInput,
	Text,
} from '@mantine/core';
import { RichTextEditor } from '@mantine/tiptap';
import {
	useEditor,
	ReactNodeViewRenderer,
	NodeViewWrapper,
	NodeViewContent,
	type ReactNodeViewProps,
} from '@tiptap/react';
import { Node, mergeAttributes, type Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import CodeBlock from '@tiptap/extension-code-block';
import {
	Table,
	TableRow,
	TableCell,
	TableHeader,
} from '@tiptap/extension-table';
import {
	Details,
	DetailsSummary,
	DetailsContent,
} from '@tiptap/extension-details';
import TextAlign from '@tiptap/extension-text-align';
import type { EditorNode } from '../mdx';
import { previewImage, fullImage, type AdminGallery } from './client';

function CodeView({ node, updateAttributes }: ReactNodeViewProps) {
	return (
		<NodeViewWrapper className="code-block">
			<label contentEditable={false}>
				Язык кода{' '}
				<input
					aria-label="Язык кода"
					value={node.attrs.language ?? ''}
					onChange={(e) =>
						updateAttributes({ language: e.target.value || null })
					}
					placeholder="typescript"
				/>
			</label>
			<pre>
				<NodeViewContent as="div" />
			</pre>
		</NodeViewWrapper>
	);
}
function moveBlock(
	editor: Editor,
	position: number | undefined,
	direction: -1 | 1,
) {
	if (position === undefined) return;
	const node = editor.state.doc.nodeAt(position);
	if (!node) return;
	const adjacent =
		direction === -1
			? editor.state.doc.resolve(position).nodeBefore
			: editor.state.doc.resolve(position + node.nodeSize).nodeAfter;
	if (!adjacent) return;
	editor.view.dispatch(
		editor.state.tr
			.delete(position, position + node.nodeSize)
			.insert(position + direction * adjacent.nodeSize, node),
	);
}
export function VisualEditor({
	document,
	galleries,
	onChange,
	onReady,
	onEditGallery,
	onCreateGallery,
}: {
	document: EditorNode;
	galleries: AdminGallery[];
	onChange: (doc: EditorNode) => void;
	onReady: (editor: Editor) => void;
	onEditGallery: (id: string) => void;
	onCreateGallery: () => void;
}) {
	const [image, setImage] = useState<{
		src: string;
		alt: string;
		title: string;
	} | null>(null);
	const [galleryPicker, setGalleryPicker] = useState(false);
	const [chosenGallery, setChosenGallery] = useState<string | null>(null);
	const extensions = useMemo(() => {
		function GalleryView({
			node,
			editor,
			getPos,
			deleteNode,
			updateAttributes,
		}: ReactNodeViewProps) {
			const gallery = galleries.find((g) => g.id === node.attrs.gallery);
			return (
				<NodeViewWrapper className="gallery-block" data-testid="gallery-block">
					<div contentEditable={false}>
						<Group justify="space-between">
							<Text fw={600} size="sm" data-drag-handle draggable>
								⠿ Галерея · общая RU/EN
							</Text>
							<Group gap="xs">
								<Button
									size="compact-xs"
									variant="default"
									onClick={() => moveBlock(editor, getPos(), -1)}
									aria-label="Галерею выше"
								>
									↑
								</Button>
								<Button
									size="compact-xs"
									variant="default"
									onClick={() => moveBlock(editor, getPos(), 1)}
									aria-label="Галерею ниже"
								>
									↓
								</Button>
								<Button
									size="compact-xs"
									color="red"
									variant="subtle"
									onClick={deleteNode}
								>
									Убрать из текста
								</Button>
							</Group>
						</Group>
						<Select
							aria-label="Галерея в тексте"
							mt="sm"
							data={galleries.map((g) => g.id)}
							value={node.attrs.gallery}
							onChange={(value) =>
								value && updateAttributes({ gallery: value })
							}
							searchable
						/>
						<div className="media-strip">
							{gallery?.items.slice(0, 6).map((item) => (
								<img key={item.id} src={previewImage(item)} alt={item.alt.ru} />
							))}
						</div>
						<Group justify="space-between">
							<Text size="xs" c="dimmed">
								{gallery?.items.length ?? 0} фото и видео
							</Text>
							<Button
								size="compact-sm"
								variant="default"
								disabled={!gallery}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => onEditGallery(node.attrs.gallery)}
							>
								Редактировать медиа
							</Button>
						</Group>
					</div>
				</NodeViewWrapper>
			);
		}
		return [
			StarterKit.configure({
				codeBlock: false,
				underline: false,
				link: { openOnClick: false },
			}),
			CodeBlock.extend({ addNodeView: () => ReactNodeViewRenderer(CodeView) }),
			Image.configure({ inline: true, allowBase64: false }),
			Table.configure({ resizable: false }),
			TableRow,
			TableCell,
			TableHeader,
			TextAlign.configure({
				types: ['tableCell', 'tableHeader'],
				defaultAlignment: null,
			}),
			Details.configure({
				HTMLAttributes: { class: 'details' },
				renderToggleButton: ({ element, isOpen }) => {
					element.setAttribute(
						'aria-label',
						isOpen ? 'Свернуть содержимое' : 'Развернуть содержимое',
					);
					element.setAttribute('aria-expanded', String(isOpen));
				},
			}),
			DetailsSummary,
			DetailsContent,
			Node.create({
				name: 'mediaGallery',
				group: 'block',
				atom: true,
				draggable: true,
				addAttributes: () => ({ gallery: { default: null } }),
				parseHTML: () => [{ tag: 'div[data-media-gallery]' }],
				renderHTML: ({ HTMLAttributes }) => [
					'div',
					mergeAttributes(HTMLAttributes, {
						'data-media-gallery': HTMLAttributes.gallery,
					}),
				],
				addNodeView: () => ReactNodeViewRenderer(GalleryView),
			}),
		];
	}, [galleries, onEditGallery]);
	const editor = useEditor(
		{
			extensions,
			shouldRerenderOnTransaction: true,
			content: document as any,
			onCreate: ({ editor }) => onReady(editor),
			onUpdate: ({ editor }) => onChange(editor.getJSON() as EditorNode),
		},
		[],
	);
	const action = (label: string, perform: () => void) => (
		<RichTextEditor.Control
			aria-label={label}
			title={label}
			onClick={perform}
			px="xs"
		>
			{label}
		</RichTextEditor.Control>
	);
	const alignColumn = (alignment: string | null) => {
		if (!editor) return;
		const $pos = editor.state.selection.$from;
		for (let depth = $pos.depth; depth > 0; depth--) {
			const cell = $pos.node(depth);
			if (!['tableCell', 'tableHeader'].includes(cell.type.name)) continue;
			const column = $pos.index(depth - 1);
			const tableDepth = depth - 2;
			if (tableDepth < 0) return;
			const table = $pos.node(tableDepth);
			const start = $pos.start(tableDepth);
			const tr = editor.state.tr;
			table.forEach((row, rowOffset) =>
				row.forEach((target, cellOffset, index) => {
					if (index === column)
						tr.setNodeMarkup(start + rowOffset + 1 + cellOffset, undefined, {
							...target.attrs,
							textAlign: alignment,
						});
				}),
			);
			editor.view.dispatch(tr);
			return;
		}
	};
	return (
		<>
			<RichTextEditor
				editor={editor}
				labels={{
					boldControlLabel: 'Жирный',
					italicControlLabel: 'Курсив',
					strikeControlLabel: 'Зачёркнутый',
					codeControlLabel: 'Код',
					h1ControlLabel: 'Заголовок 1',
					h2ControlLabel: 'Заголовок 2',
					h3ControlLabel: 'Заголовок 3',
					blockquoteControlLabel: 'Цитата',
					bulletListControlLabel: 'Список',
					orderedListControlLabel: 'Нумерованный список',
					hrControlLabel: 'Разделитель',
					linkControlLabel: 'Ссылка',
					unlinkControlLabel: 'Убрать ссылку',
					linkEditorSave: 'Сохранить',
					linkEditorExternalLink: 'Открывать в новой вкладке',
					linkEditorInputLabel: 'Адрес ссылки',
					linkEditorInputPlaceholder: 'https://',
					clearFormattingControlLabel: 'Очистить форматирование',
					linkEditorInternalLink: 'Открывать в этой вкладке',
				}}
			>
				<RichTextEditor.Toolbar sticky stickyOffset={65}>
					<RichTextEditor.ControlsGroup>
						<RichTextEditor.Bold />
						<RichTextEditor.Italic />
						<RichTextEditor.Strikethrough />
						<RichTextEditor.Code />
						<RichTextEditor.ClearFormatting />
					</RichTextEditor.ControlsGroup>
					<RichTextEditor.ControlsGroup>
						<RichTextEditor.H1 />
						<RichTextEditor.H2 />
						<RichTextEditor.H3 />
						<RichTextEditor.BulletList />
						<RichTextEditor.OrderedList />
						<RichTextEditor.Blockquote />
						<RichTextEditor.Hr />
					</RichTextEditor.ControlsGroup>
					<RichTextEditor.ControlsGroup>
						<RichTextEditor.Link />
						<RichTextEditor.Unlink />
						{action('Блок кода', () =>
							editor?.chain().focus().toggleCodeBlock().run(),
						)}
						{action('Спойлер', () =>
							editor?.chain().focus().setDetails().run(),
						)}
						{action('Раскрыть спойлер', () =>
							editor?.chain().focus().unsetDetails().run(),
						)}
					</RichTextEditor.ControlsGroup>
					<RichTextEditor.ControlsGroup>
						{action('Изображение', () => {
							const attrs = editor?.isActive('image')
								? editor.getAttributes('image')
								: {};
							setImage({
								src: attrs.src ?? '',
								alt: attrs.alt ?? '',
								title: attrs.title ?? '',
							});
						})}
						{action('Галерея', () => setGalleryPicker(true))}
						{action('Таблица', () =>
							editor
								?.chain()
								.focus()
								.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
								.run(),
						)}
					</RichTextEditor.ControlsGroup>
					{editor?.isActive('table') && (
						<RichTextEditor.ControlsGroup>
							{action('+ строка', () =>
								editor.chain().focus().addRowAfter().run(),
							)}
							{action('− строка', () =>
								editor.chain().focus().deleteRow().run(),
							)}
							{action('+ столбец', () =>
								editor.chain().focus().addColumnAfter().run(),
							)}
							{action('− столбец', () =>
								editor.chain().focus().deleteColumn().run(),
							)}
							{action('Влево', () => alignColumn('left'))}
							{action('По центру', () => alignColumn('center'))}
							{action('Вправо', () => alignColumn('right'))}
							{action('Убрать таблицу', () =>
								editor.chain().focus().deleteTable().run(),
							)}
						</RichTextEditor.ControlsGroup>
					)}
				</RichTextEditor.Toolbar>
				<RichTextEditor.Content />
			</RichTextEditor>
			<Modal
				opened={!!image}
				onClose={() => setImage(null)}
				title="Изображение"
			>
				{image && (
					<Stack>
						<Select
							label="Из медиабиблиотеки"
							searchable
							data={galleries.flatMap((g) =>
								g.items
									.filter((i) => i.kind === 'image')
									.map((i) => ({
										value: fullImage(i),
										label: `${g.id} / ${i.id}`,
									})),
							)}
							onChange={(src) => src && setImage({ ...image, src })}
						/>
						<TextInput
							label="URL изображения"
							value={image.src}
							onChange={(e) => setImage({ ...image, src: e.target.value })}
						/>
						<TextInput
							label="Описание (alt)"
							value={image.alt}
							onChange={(e) => setImage({ ...image, alt: e.target.value })}
						/>
						<TextInput
							label="Подсказка"
							value={image.title}
							onChange={(e) => setImage({ ...image, title: e.target.value })}
						/>
						<Button
							disabled={!image.src}
							onClick={() => {
								editor?.chain().focus().setImage(image).run();
								setImage(null);
							}}
						>
							Применить
						</Button>
					</Stack>
				)}
			</Modal>
			<Modal
				opened={galleryPicker}
				onClose={() => setGalleryPicker(false)}
				title="Вставить галерею"
			>
				<Stack>
					<Select
						label="Галерея"
						searchable
						data={galleries.map((g) => g.id)}
						value={chosenGallery}
						onChange={setChosenGallery}
					/>
					<Button
						variant="default"
						onClick={() => {
							setGalleryPicker(false);
							onCreateGallery();
						}}
					>
						Создать галерею
					</Button>
					<Button
						disabled={!chosenGallery}
						onClick={() => {
							editor
								?.chain()
								.focus()
								.insertContent({
									type: 'mediaGallery',
									attrs: { gallery: chosenGallery },
								})
								.run();
							setGalleryPicker(false);
						}}
					>
						Вставить в текст
					</Button>
				</Stack>
			</Modal>
		</>
	);
}
