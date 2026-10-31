import { useMemo, useRef, useState } from 'react';
import {
	Alert,
	Button,
	FileButton,
	Group,
	Modal,
	Select,
	SegmentedControl,
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
import {
	api,
	previewImage,
	fullImage,
	waitForJob,
	type AdminGallery,
} from './client';
import type { Job } from '../media';

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
	onBusy,
}: {
	document: EditorNode;
	galleries: AdminGallery[];
	onChange: (doc: EditorNode) => void;
	onReady: (editor: Editor) => void;
	onEditGallery: (id: string) => void;
	onCreateGallery: () => void;
	onBusy: (value: boolean) => void;
}) {
	const [media, setMedia] = useState<{
		kind: 'image' | 'video';
		src: string;
		poster: string;
		alt: string;
		title: string;
	} | null>(null);
	const [mediaBusy, setMediaBusy] = useState(false);
	const [mediaMessage, setMediaMessage] = useState('');
	const [mediaError, setMediaError] = useState('');
	const [pendingMedia, setPendingMedia] = useState<string | null>(null);
	const resetMediaUpload = useRef<() => void>(null);
	async function uploadMedia(file: File | null) {
		if (!file && !pendingMedia) return;
		setMediaBusy(true);
		onBusy(true);
		setMediaError('');
		const galleryId = file ? `media-${crypto.randomUUID()}` : pendingMedia!;
		try {
			if (file) {
				setPendingMedia(null);
				setMediaMessage('Загрузка файла на локальный сервер');
				const data = new FormData();
				data.append('files', file);
				const response = await fetch(
					`/api/upload?${new URLSearchParams({ gallery: galleryId })}`,
					{ method: 'POST', body: data },
				);
				const job = await response.json();
				if (!response.ok) throw new Error(job.error);
				await waitForJob(job.id, setMediaMessage);
				setPendingMedia(galleryId);
			}
			setMediaMessage('Загрузка файла в S3');
			const job = await api<Job>('publish', { gallery: galleryId });
			await waitForJob(job.id, setMediaMessage);
			const updated = await api<AdminGallery[]>('galleries');
			const item = updated.find((g) => g.id === galleryId)?.items[0];
			if (!item) throw new Error('Загруженный файл не найден');
			setMedia((current) => current && {
				...current,
				kind: item.kind,
				src: fullImage(item),
				poster: item.kind === 'video' ? item.poster : '',
			});
			setPendingMedia(null);
			setMediaMessage(
				'Файл загружен. Нажмите «Применить», чтобы вставить его в текст.',
			);
		} catch (error: any) {
			setMediaMessage('');
			setMediaError(error.message);
		} finally {
			setMediaBusy(false);
			onBusy(false);
			resetMediaUpload.current?.();
		}
	}
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
			Node.create({
				name: 'video',
				group: 'block',
				atom: true,
				draggable: true,
				addAttributes: () => ({
					src: { default: '' },
					poster: { default: null },
					alt: {
						default: '',
						parseHTML: (element) => element.getAttribute('aria-label') ?? '',
						renderHTML: (attrs) => ({ 'aria-label': attrs.alt }),
					},
					title: { default: null },
				}),
				parseHTML: () => [{ tag: 'video[src]' }],
				renderHTML: ({ HTMLAttributes }) => [
					'video',
					mergeAttributes(HTMLAttributes, {
						controls: true,
						playsinline: true,
						preload: 'metadata',
					}),
				],
			}),
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
						{action('Фото / видео', () => {
							setMediaMessage('');
							setMediaError('');
							setPendingMedia(null);
							const kind = editor?.isActive('video') ? 'video' : 'image';
							const attrs = editor?.isActive(kind)
								? editor.getAttributes(kind)
								: {};
							setMedia({
								kind,
								src: attrs.src ?? '',
								poster: attrs.poster ?? '',
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
				opened={!!media}
				onClose={() => {
					if (!mediaBusy) setMedia(null);
				}}
				closeButtonProps={{
					disabled: mediaBusy,
					'aria-label': 'Закрыть окно медиа',
				}}
				closeOnEscape={!mediaBusy}
				closeOnClickOutside={!mediaBusy}
				title="Фото / видео"
			>
				{media && (
					<Stack>
						<SegmentedControl
							aria-label="Тип медиа"
							data={[
								{ value: 'image', label: 'Фото' },
								{ value: 'video', label: 'Видео' },
							]}
							value={media.kind}
							disabled={mediaBusy}
							onChange={(kind) => setMedia({
								...media,
								kind: kind as 'image' | 'video',
							})}
						/>
						<FileButton
							resetRef={resetMediaUpload}
							accept="image/*,video/*,.heic,.heif,.mkv"
							onChange={(file) => void uploadMedia(file)}
						>
							{(props) => (
								<Button {...props} loading={mediaBusy}>
									Загрузить фото / видео
								</Button>
							)}
						</FileButton>
						<Text size="sm" c="dimmed">
							Фото или видео обработается и автоматически загрузится в S3.
						</Text>
						{mediaError && (
							<Alert color="red" title="Не удалось загрузить файл">
								{mediaError}
							</Alert>
						)}
						{mediaMessage && (
							<Text size="sm" role="status">{mediaMessage}</Text>
						)}
						{pendingMedia && !mediaBusy && (
							<Button variant="default" onClick={() => void uploadMedia(null)}>
								Повторить загрузку в S3
							</Button>
						)}
						<Select
							label="Из медиабиблиотеки"
							disabled={mediaBusy}
							searchable
							data={galleries.flatMap((g) =>
								g.items.map((i) => ({
									value: `${g.id}/${i.id}`,
									label: `${g.id} / ${i.id}`,
								})),
							)}
							onChange={(ref) => {
								const [galleryId, itemId] = ref?.split('/') ?? [];
								const item = galleries
									.find((g) => g.id === galleryId)
									?.items.find((i) => i.id === itemId);
								if (item) setMedia({
									...media,
									kind: item.kind,
									src: fullImage(item),
									poster: item.kind === 'video' ? item.poster : '',
								});
							}}
						/>
						<TextInput
							label={media.kind === 'video' ? 'URL видео' : 'URL изображения'}
							disabled={mediaBusy}
							value={media.src}
							onChange={(e) => setMedia({ ...media, src: e.target.value, poster: '' })}
						/>
						<TextInput
							label={media.kind === 'video' ? 'Описание видео' : 'Описание (alt)'}
							value={media.alt}
							onChange={(e) => setMedia({ ...media, alt: e.target.value })}
						/>
						<TextInput
							label="Подсказка"
							value={media.title}
							onChange={(e) => setMedia({ ...media, title: e.target.value })}
						/>
						<Button
							disabled={!media.src || mediaBusy || !!pendingMedia}
							onClick={() => {
								const { kind, src, poster, alt, title } = media;
								const chain = editor?.chain().focus();
								if (kind === 'video') {
									const attrs = {
										src, poster: poster || null, alt, title: title || null,
									};
									if (editor?.isActive('video'))
										chain?.updateAttributes('video', attrs).run();
									else chain?.insertContent({ type: 'video', attrs }).run();
								} else chain?.setImage({ src, alt, title }).run();
								setMedia(null);
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
