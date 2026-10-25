import { useCallback, useEffect, useRef, useState } from 'react';
import {
	Alert,
	AppShell,
	Badge,
	Button,
	Checkbox,
	Container,
	Group,
	Image,
	Modal,
	NavLink,
	NumberInput,
	Paper,
	ScrollArea,
	SegmentedControl,
	Select,
	SimpleGrid,
	Stack,
	Text,
	Textarea,
	TextInput,
	Title,
} from '@mantine/core';
import type { Editor } from '@tiptap/core';
import type { SelectionBookmark } from '@tiptap/pm/state';
import type { Material, MaterialInput, RecordData } from '../store';
import { VisualEditor } from './Editor';
import { MediaPanel } from './MediaPanel';
import {
	api,
	previewImage,
	fullImage,
	sortTravelMaterials,
	type AdminGallery,
} from './client';
import { pickCollagePhotos } from '../../../src/data/travel-media.mts';

type Form = MaterialInput & { readOnly?: string; sourceBody?: string };
const toForm = (material: Material): Form => ({ ...material });
export default function App() {
	const [section, setSection] = useState('blog');
	const [locale, setLocale] = useState<'ru' | 'en'>('ru');
	const [search, setSearch] = useState('');
	const [materials, setMaterials] = useState<Material[]>([]);
	const [galleries, setGalleries] = useState<AdminGallery[]>([]);
	const [form, setForm] = useState<Form | null>(null);
	const [dirty, setDirty] = useState(false);
	const [bodyChanged, setBodyChanged] = useState(false);
	const [editorSession, setEditorSession] = useState(0);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	const [picker, setPicker] = useState<'hero' | 'collage' | null>(null);
	const [mediaGallery, setMediaGallery] = useState<string | null>(null);
	const [mediaDirty, setMediaDirty] = useState(false);
	const mediaSelection = useRef<SelectionBookmark | null>(null);
	const editor = useRef<Editor | null>(null);
	const editGallery = useCallback((id: string) => {
		const selection = editor.current?.state.selection;
		mediaSelection.current = selection?.getBookmark() ?? null;
		setMediaGallery(id);
	}, []);
	async function refresh() {
		const [items, media] = await Promise.all([
			api<Material[]>('materials'),
			api<AdminGallery[]>('galleries'),
		]);
		setMaterials(items);
		setGalleries(media);
	}
	useEffect(() => {
		void refresh().catch((e) => setError(e.message));
	}, []);
	useEffect(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (dirty || mediaDirty || busy) e.preventDefault();
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	}, [dirty, mediaDirty, busy]);
	function canLeave() {
		return !busy && (!dirty || confirm('Не сохранять текущие изменения?'));
	}
	function navigate(next: string) {
		if (canLeave()) {
			setSection(next);
			setForm(null);
			setDirty(false);
			setBodyChanged(false);
			setError('');
			setMessage('');
		}
	}
	async function perform(task: () => Promise<void>) {
		setBusy(true);
		setError('');
		setMessage('');
		try {
			await task();
		} catch (e: any) {
			setError(e.message);
		} finally {
			setBusy(false);
		}
	}
	async function open(id: string) {
		if (!canLeave()) return;
		await perform(async () => {
			setEditorSession((session) => session + 1);
			setForm(
				toForm(await api<Material>(`material?${new URLSearchParams({ id })}`)),
			);
			setDirty(false);
			setBodyChanged(false);
		});
	}
	function create(type: Material['type'], trip?: string) {
		if (!canLeave()) return;
		setEditorSession((session) => session + 1);
		const today = new Date().toLocaleDateString('sv-SE');
		setForm({
			type,
			locale,
			slug: '',
			trip,
			version: null,
			metadata:
				type === 'blog'
					? { title: '', description: '', publishDate: today, hidden: true }
					: type === 'trip'
						? {
								title: '',
								description: '',
								destinations: [],
								startDate: today,
								collage: [],
								draft: true,
							}
						: {
								kind: 'chapter',
								title: '',
								description: '',
								date: today,
								collage: [],
								draft: true,
								order:
									Math.max(
										-1,
										...materials
											.filter(
												(m) =>
													m.type === 'entry' &&
													m.locale === locale &&
													m.trip === trip,
											)
											.map((m) => m.metadata.order),
									) + 1,
							},
			document: { type: 'doc', content: [{ type: 'paragraph' }] },
		});
		setDirty(true);
		setBodyChanged(true);
		setError('');
		setMessage('');
	}
	function field(key: string, value: unknown) {
		if (form) {
			setForm({ ...form, metadata: { ...form.metadata, [key]: value } });
			setDirty(true);
		}
	}
	function identity(key: 'slug' | 'trip', value: string) {
		if (form) {
			setForm({ ...form, [key]: value });
			setDirty(true);
		}
	}
	async function save(preview = false) {
		if (!form) return;
		const tab = preview ? window.open('about:blank', '_blank') : null;
		await perform(async () => {
			try {
				const { readOnly, sourceBody, ...input } = form;
				const saved = await api<Material>('material', {
					...input,
					document: bodyChanged
						? (editor.current?.getJSON() ?? form.document)
						: undefined,
				});
				setForm(toForm(saved));
				setDirty(false);
				setBodyChanged(false);
				await refresh();
				setMessage('Файл сохранён. Commit и push выполняются вручную.');
				if (preview) {
					setMessage('Файл сохранён. Запуск локального превью…');
					const { url } = await api<{ url: string }>('preview', {
						id: saved.id,
					});
					if (tab) {
						tab.opener = null;
						tab.location.href = url;
					} else window.location.assign(url);
					setMessage('Локальное превью открыто');
				}
			} catch (e) {
				tab?.close();
				throw e;
			}
		});
	}
	const items = (
		section === 'travel' ? sortTravelMaterials(materials) : materials
	).filter(
		(m) =>
			m.locale === locale &&
			(section === 'blog' ? m.type === 'blog' : m.type !== 'blog') &&
			`${m.metadata.title ?? ''} ${m.slug} ${m.trip ?? ''}`
				.toLowerCase()
				.includes(search.toLowerCase()),
	);
	const imageOptions = galleries.flatMap((g) =>
		g.items
			.filter((i) => i.kind === 'image')
			.map((i) => ({ ref: `${g.id}/${i.id}`, item: i })),
	);
	const meta: RecordData = form?.metadata ?? {};
	const input = (key: string, label: string, type = 'text') => (
		<TextInput
			key={key}
			label={label}
			type={type}
			value={meta[key] ?? ''}
			disabled={busy || !!form?.readOnly}
			onChange={(e) => field(key, e.target.value)}
		/>
	);
	return (
		<AppShell
			header={{ height: 64 }}
			navbar={{ width: 280, breakpoint: 0 }}
			padding="lg"
		>
			<AppShell.Header>
				<Group h="100%" px="lg" justify="space-between">
					<Group>
						<Title order={3}>dskr.dev</Title>
						<Badge variant="light">Локальный редактор</Badge>
					</Group>
					<Text size="sm" c="dimmed">
						Файлы → проверка → S3 → ручной commit / push
					</Text>
				</Group>
			</AppShell.Header>
			<AppShell.Navbar p="md">
				<Stack h="100%">
					<SegmentedControl
						aria-label="Язык материалов"
						value={locale}
						data={[
							{ value: 'ru', label: 'RU' },
							{ value: 'en', label: 'EN' },
						]}
						disabled={busy || section === 'media'}
						onChange={(value) => {
							if (canLeave()) {
								setLocale(value as 'ru' | 'en');
								setForm(null);
								setDirty(false);
							}
						}}
					/>
					<div>
						<NavLink
							label="Блог"
							active={section === 'blog'}
							onClick={() => navigate('blog')}
						/>
						<NavLink
							label="Путешествия"
							active={section === 'travel'}
							onClick={() => navigate('travel')}
						/>
						<NavLink
							label="Медиа"
							active={section === 'media'}
							onClick={() => navigate('media')}
						/>
					</div>
					{section !== 'media' && (
						<>
							<TextInput
								aria-label="Поиск материалов"
								placeholder="Поиск по названию или slug"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
							<Button
								disabled={busy}
								onClick={() => create(section === 'blog' ? 'blog' : 'trip')}
							>
								{section === 'blog' ? 'Новая статья' : 'Новая поездка'}
							</Button>
							<ScrollArea style={{ flex: 1 }}>
								{items.map((m) => (
									<NavLink
										key={m.id}
										active={form?.id === m.id}
										label={m.metadata.title || m.slug}
										description={`${m.type === 'trip' ? 'Поездка' : m.type === 'entry' ? (m.metadata.kind === 'note' ? 'Заметка' : 'Глава') : m.metadata.hidden ? 'Скрытая' : 'Статья'}${m.metadata.draft ? ' · черновик' : ''}`}
										pl={m.type === 'entry' ? 'xl' : undefined}
										onClick={() => void open(m.id)}
									/>
								))}
							</ScrollArea>
						</>
					)}
					<Text size="xs" c="dimmed">
						127.0.0.1 · изменения сохраняются в рабочую копию
					</Text>
				</Stack>
			</AppShell.Navbar>
			<AppShell.Main>
				<Container size="xl" px={0}>
					{error && (
						<Alert
							color="red"
							title="Не удалось выполнить действие"
							mb="md"
							withCloseButton
							onClose={() => setError('')}
						>
							{error}
						</Alert>
					)}
					{message && (
						<Alert color="teal" mb="md" role="status">
							{message}
						</Alert>
					)}
					{section === 'media' ? (
						<MediaPanel
							galleries={galleries}
							refresh={refresh}
							onDirty={setDirty}
							onBusy={setBusy}
						/>
					) : !form ? (
						<Paper p="xl" withBorder>
							<Title order={2}>
								{section === 'blog' ? 'Блог' : 'Путешествия'}
							</Title>
							<Text c="dimmed" mt="sm">
								Выберите материал слева или создайте новый. Текст хранится в
								MDX, медиа — в существующих галереях.
							</Text>
						</Paper>
					) : (
						<Stack>
							<Group justify="space-between">
								<div>
									<Title order={2}>{meta.title || 'Новый материал'}</Title>
									<Text size="xs" c="dimmed">
										{form.id ?? 'Файл ещё не создан'} ·{' '}
										{form.locale.toUpperCase()}
										{dirty ? ' · есть изменения' : ''}
									</Text>
								</div>
								<Group>
									{form.type === 'trip' && form.id && (
										<Button
											variant="default"
											disabled={busy}
											onClick={() => create('entry', form.slug)}
										>
											Добавить главу / заметку
										</Button>
									)}
									<Button
										variant="default"
										disabled={busy || !!form.readOnly}
										onClick={() => void save()}
									>
										Сохранить
									</Button>
									<Button
										loading={busy}
										disabled={!!form.readOnly}
										onClick={() => void save(true)}
									>
										Сохранить и открыть превью
									</Button>
								</Group>
							</Group>
							{form.readOnly && (
								<Alert color="orange" title="Только чтение">
									{form.readOnly}. Файл сохранён без изменений.
								</Alert>
							)}
							<Paper p="lg" withBorder>
								<Stack>
									<SimpleGrid cols={2}>
										<TextInput
											label="Slug"
											description="Латиница, цифры и дефисы; после создания фиксируется"
											value={form.slug}
											disabled={busy || !!form.id}
											onChange={(e) => identity('slug', e.target.value)}
										/>
										{form.type === 'entry' ? (
											<Select
												label="Поездка"
												data={materials
													.filter(
														(m) =>
															m.type === 'trip' && m.locale === form.locale,
													)
													.map((m) => ({
														value: m.slug,
														label: m.metadata.title,
													}))}
												value={form.trip ?? null}
												disabled={busy || !!form.id}
												onChange={(value) => identity('trip', value ?? '')}
											/>
										) : (
											input(
												form.type === 'blog' ? 'publishDate' : 'startDate',
												form.type === 'blog'
													? 'Дата публикации'
													: 'Начало поездки',
												'date',
											)
										)}
									</SimpleGrid>
									{form.type === 'entry' && (
										<Group grow>
											<Select
												label="Тип записи"
												data={[
													{ value: 'chapter', label: 'Глава' },
													{ value: 'note', label: 'Заметка' },
												]}
												value={meta.kind}
												disabled={busy || !!form.readOnly}
												onChange={(value) => field('kind', value)}
											/>
											<NumberInput
												label="Порядок в поездке"
												min={0}
												allowDecimal={false}
												value={meta.order ?? 0}
												disabled={busy || !!form.readOnly}
												onChange={(value) => field('order', value)}
											/>
											{input('date', 'Дата записи', 'date')}
										</Group>
									)}
									{input(
										'title',
										form.type === 'entry' && meta.kind === 'note'
											? 'Заголовок (необязательно)'
											: 'Заголовок',
									)}
									{(form.type !== 'entry' || meta.kind === 'chapter') && (
										<Textarea
											label="Краткое описание"
											autosize
											value={meta.description ?? ''}
											disabled={busy || !!form.readOnly}
											onChange={(e) => field('description', e.target.value)}
										/>
									)}
									{form.type === 'blog' && (
										<>
											<Group align="end" grow>
												{input('updatedDate', 'Дата обновления', 'date')}
												{input('heroImage', 'URL обложки')}
												<Button
													variant="default"
													disabled={busy || !!form.readOnly}
													onClick={() => setPicker('hero')}
												>
													Выбрать обложку
												</Button>
											</Group>
											{meta.heroImage && (
												<Image
													src={meta.heroImage}
													alt="Обложка"
													h={160}
													fit="contain"
												/>
											)}
											<Checkbox
												label="Скрыть из ленты и RSS (страница будет доступна по прямой ссылке)"
												checked={meta.hidden ?? false}
												disabled={busy || !!form.readOnly}
												onChange={(e) => field('hidden', e.target.checked)}
											/>
										</>
									)}
									{form.type === 'trip' && (
										<Group grow>
											<TextInput
												label="Направления через запятую"
												value={(meta.destinations ?? []).join(', ')}
												disabled={busy || !!form.readOnly}
												onChange={(e) =>
													field(
														'destinations',
														e.target.value.split(',').map((s) => s.trim()),
													)
												}
											/>
											{input(
												'endDate',
												'Конец поездки (необязательно)',
												'date',
											)}
										</Group>
									)}
									{form.type !== 'blog' && (
										<Checkbox
											label="Черновик — только в локальном превью"
											checked={meta.draft ?? false}
											disabled={busy || !!form.readOnly}
											onChange={(e) => field('draft', e.target.checked)}
										/>
									)}
									{(form.type === 'trip' ||
										(form.type === 'entry' && meta.kind === 'chapter')) && (
										<div>
											<Group>
												<Text fw={500} size="sm">
													Коллаж · 3–8 фотографий
												</Text>
												<Button
													size="compact-sm"
													variant="default"
													disabled={busy || !!form.readOnly}
													onClick={() => setPicker('collage')}
												>
													Выбрать фотографии
												</Button>
											</Group>
											<div className="media-strip">
												{(meta.collage ?? []).map(
													(ref: string, index: number) => {
														const media = imageOptions.find(
															(i) => i.ref === ref,
														);
														return (
															<div key={`${ref}-${index}`}>
																<img
																	src={media ? previewImage(media.item) : ''}
																	alt={ref}
																/>
																<Group gap={4}>
																	<Button
																		size="compact-xs"
																		variant="subtle"
																		aria-label={`Фото коллажа ${index + 1} выше`}
																		disabled={
																			index === 0 || busy || !!form.readOnly
																		}
																		onClick={() => {
																			const next = [...meta.collage];
																			[next[index - 1], next[index]] = [
																				next[index],
																				next[index - 1],
																			];
																			field('collage', next);
																		}}
																	>
																		←
																	</Button>
																	<Button
																		size="compact-xs"
																		variant="subtle"
																		aria-label={`Фото коллажа ${index + 1} ниже`}
																		disabled={
																			index === meta.collage.length - 1 ||
																			busy ||
																			!!form.readOnly
																		}
																		onClick={() => {
																			const next = [...meta.collage];
																			[next[index + 1], next[index]] = [
																				next[index],
																				next[index + 1],
																			];
																			field('collage', next);
																		}}
																	>
																		→
																	</Button>
																</Group>
															</div>
														);
													},
												)}
											</div>
										</div>
									)}
								</Stack>
							</Paper>
							{form.document && !form.readOnly ? (
								<fieldset disabled={busy} className="editor-fieldset">
									<VisualEditor
										key={`${editorSession}|${form.version}|${galleries.map((g) => g.version).join(',')}`}
										document={form.document as any}
										galleries={galleries}
										onEditGallery={editGallery}
										onReady={(value) => {
											editor.current = value;
										}}
										onChange={(document) => {
											setForm((current) =>
												current ? { ...current, document } : null,
											);
											setDirty(true);
											setBodyChanged(true);
										}}
									/>
								</fieldset>
							) : (
								<Paper withBorder p="md">
									<pre style={{ whiteSpace: 'pre-wrap' }}>
										{form.sourceBody}
									</pre>
								</Paper>
							)}
						</Stack>
					)}
				</Container>
			</AppShell.Main>
			<Modal
				opened={mediaGallery !== null}
				title="Редактировать медиа"
				size="xl"
				returnFocus={false}
				closeButtonProps={{ 'aria-label': 'Закрыть редактор медиа' }}
				onClose={() => {
					if (
						busy ||
						(mediaDirty && !confirm('Не сохранять изменения галереи?'))
					)
						return;
					setMediaGallery(null);
					setMediaDirty(false);
				}}
				onExitTransitionEnd={() => {
					const current = editor.current;
					if (mediaSelection.current && current) {
						current.view.dispatch(
							current.state.tr.setSelection(
								mediaSelection.current.resolve(current.state.doc),
							),
						);
						current.commands.focus(undefined, { scrollIntoView: false });
					}
					mediaSelection.current = null;
				}}
			>
				{mediaGallery && (
					<MediaPanel
						key={mediaGallery}
						initialGalleryId={mediaGallery}
						galleries={galleries}
						refresh={refresh}
						onDirty={setMediaDirty}
						onBusy={setBusy}
					/>
				)}
			</Modal>
			<Modal
				opened={!!picker}
				onClose={() => setPicker(null)}
				size="xl"
				title={picker === 'hero' ? 'Обложка статьи' : 'Фотографии коллажа'}
			>
				<Stack>
					<SimpleGrid cols={4}>
						{imageOptions.map(({ ref, item }) => (
							<button
								type="button"
								className={`photo-choice ${(meta.collage ?? []).includes(ref) ? 'selected' : ''}`}
								key={ref}
								aria-label={`Выбрать ${ref}`}
								onClick={() => {
									if (picker === 'hero') {
										field('heroImage', fullImage(item));
										setPicker(null);
									} else {
										const selected = [...new Set<string>(meta.collage ?? [])];
										field(
											'collage',
											selected.includes(ref)
												? selected.filter((r) => r !== ref)
												: selected.length < 8
													? [...selected, ref]
													: selected,
										);
									}
								}}
							>
								<img src={previewImage(item)} alt={item.alt[locale]} />
								<span>{ref}</span>
							</button>
						))}
					</SimpleGrid>
					{picker === 'collage' && (
						<Button
							disabled={!meta.collage?.length}
							onClick={() => {
								field('collage', pickCollagePhotos(meta.collage));
								setPicker(null);
							}}
						>
							Применить {meta.collage?.length ?? 0} фото
						</Button>
					)}
				</Stack>
			</Modal>
		</AppShell>
	);
}
