import { useEffect, useState } from 'react';
import {
	Alert,
	Badge,
	Button,
	FileButton,
	Group,
	Image,
	Loader,
	Paper,
	Select,
	Stack,
	Text,
	TextInput,
	Title,
} from '@mantine/core';
import { api, previewImage, type AdminGallery } from './client';
import type { Job } from '../media';

export function MediaPanel({
	galleries,
	refresh,
	onDirty,
	onBusy,
	initialGalleryId,
}: {
	galleries: AdminGallery[];
	refresh: () => Promise<void>;
	onDirty: (value: boolean) => void;
	onBusy: (value: boolean) => void;
	initialGalleryId?: string;
}) {
	const [selected, setSelected] = useState<AdminGallery | null>(() =>
		structuredClone(
			galleries.find((gallery) => gallery.id === initialGalleryId) ?? null,
		),
	);
	const [newId, setNewId] = useState('');
	const [dirty, setDirty] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');
	useEffect(() => {
		const pending = sessionStorage.getItem('admin-media-job');
		if (pending) void watch(pending);
	}, []);
	function changed(value: AdminGallery) {
		setSelected(value);
		setDirty(true);
		onDirty(true);
	}
	function choose(id: string | null) {
		if (dirty && !confirm('Не сохранять изменения галереи?')) return;
		setSelected(structuredClone(galleries.find((g) => g.id === id) ?? null));
		setNewId('');
		setDirty(false);
		onDirty(false);
		setError('');
		setMessage('');
	}
	async function perform(task: () => Promise<void>) {
		setBusy(true);
		onBusy(true);
		setError('');
		try {
			await task();
		} catch (error: any) {
			setError(error.message);
		} finally {
			setBusy(false);
			onBusy(false);
		}
	}
	async function watch(id: string) {
		sessionStorage.setItem('admin-media-job', id);
		setBusy(true);
		onBusy(true);
		try {
			for (;;) {
				const job = await api<Job>(`jobs/${id}`);
				setMessage(job.message);
				if (job.stage === 'error') throw new Error(job.message);
				if (job.stage === 'done') {
					await refresh();
					const updated = await api<AdminGallery[]>('galleries');
					setSelected(updated.find((g) => g.id === job.gallery) ?? null);
					setNewId('');
					break;
				}
				await new Promise((done) => setTimeout(done, 700));
			}
		} catch (error: any) {
			setError(error.message);
		} finally {
			sessionStorage.removeItem('admin-media-job');
			setBusy(false);
			onBusy(false);
		}
	}
	const galleryId = selected?.id ?? newId;
	async function upload(files: File[]) {
		if (!files.length) return;
		await perform(async () => {
			const data = new FormData();
			files.forEach((file) => data.append('files', file));
			setMessage('Загрузка файлов на локальный сервер');
			const response = await fetch(
				`/api/upload?${new URLSearchParams({ gallery: galleryId, ...(selected ? { version: selected.version } : {}) })}`,
				{ method: 'POST', body: data },
			);
			const result = await response.json();
			if (!response.ok) throw new Error(result.error);
			await watch(result.id);
		});
	}
	function move(index: number, direction: number) {
		if (!selected) return;
		const items = [...selected.items];
		[items[index], items[index + direction]] = [
			items[index + direction],
			items[index],
		];
		changed({ ...selected, items });
	}
	return (
		<Stack>
			<div>
				<Title order={2}>Медиа</Title>
				<Text c="dimmed" size="sm">
					Галереи общие для RU и EN. Исходники остаются локально до явной
					загрузки в S3.
				</Text>
			</div>
			{error && (
				<Alert color="red" title="Операция не выполнена">
					{error}
				</Alert>
			)}
			<Group align="end">
				<Select
					label="Галерея"
					searchable
					clearable
					data={galleries.map((g) => g.id)}
					value={selected?.id ?? null}
					onChange={choose}
					disabled={busy}
					style={{ flex: 1 }}
				/>
				<Button variant="default" disabled={busy} onClick={() => choose(null)}>
					Новая галерея
				</Button>
			</Group>
			{!selected && (
				<TextInput
					label="ID новой галереи"
					description="Латинские буквы, цифры и дефисы. После обработки создастся локальный JSON-манифест."
					value={newId}
					onChange={(e) => setNewId(e.target.value)}
				/>
			)}
			<Group>
				<FileButton
					multiple
					accept="image/*,video/*,.heic,.heif,.mkv"
					onChange={(files) => void upload(files)}
				>
					{(props) => (
						<Button
							{...props}
							disabled={
								busy || dirty || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(galleryId)
							}
						>
							Добавить фото / видео
						</Button>
					)}
				</FileButton>
				<Button
					variant="default"
					disabled={busy || !dirty || !selected}
					onClick={() =>
						void perform(async () => {
							const saved = await api<AdminGallery>('gallery', {
								gallery: selected,
								version: selected!.version,
							});
							setSelected({ ...saved, pending: selected!.pending });
							setDirty(false);
							onDirty(false);
							await refresh();
							setMessage('Подписи и порядок сохранены');
						})
					}
				>
					Сохранить галерею
				</Button>
				<Button
					color="teal"
					disabled={busy || dirty || !selected?.pending}
					onClick={() =>
						void perform(async () => {
							const job = await api<Job>('publish', { gallery: galleryId });
							await watch(job.id);
						})
					}
				>
					Загрузить в S3 {selected?.pending ? `(${selected.pending})` : ''}
				</Button>
			</Group>
			{!!selected?.pending && (
				<Text size="sm" c="dimmed">
					После загрузки в S3 производные будут доступны по URL до коммита.
				</Text>
			)}
			{dirty && (
				<Text size="sm" c="orange">
					Сохраните подписи и порядок перед добавлением или загрузкой медиа.
				</Text>
			)}
			{message && (
				<Group>
					{busy && <Loader size="xs" />}
					<Text size="sm" role="status">
						{message}
					</Text>
				</Group>
			)}
			{selected?.items.map((item, index) => (
				<Paper withBorder p="md" key={item.id}>
					<Group align="start" wrap="nowrap">
						<Image
							src={previewImage(item)}
							alt={item.alt.ru}
							w={160}
							h={120}
							fit="contain"
						/>
						<Stack style={{ flex: 1 }} gap="xs">
							<Group justify="space-between">
								<Text size="xs" c="dimmed">
									{item.id}
								</Text>
								<Badge>{item.kind === 'video' ? 'Видео' : 'Фото'}</Badge>
							</Group>
							{(['ru', 'en'] as const).map((locale) => (
								<Group key={locale} grow>
									<TextInput
										label={`Alt · ${locale.toUpperCase()}`}
										disabled={busy}
										value={item.alt[locale]}
										onChange={(e) =>
											changed({
												...selected,
												items: selected.items.map((i) =>
													i.id === item.id
														? {
																...i,
																alt: { ...i.alt, [locale]: e.target.value },
															}
														: i,
												),
											})
										}
									/>
									<TextInput
										label={`Подпись · ${locale.toUpperCase()}`}
										disabled={busy}
										value={item.caption?.[locale] ?? ''}
										onChange={(e) =>
											changed({
												...selected,
												items: selected.items.map((i) =>
													i.id === item.id
														? {
																...i,
																caption: {
																	ru: '',
																	en: '',
																	...i.caption,
																	[locale]: e.target.value,
																},
															}
														: i,
												),
											})
										}
									/>
								</Group>
							))}
							<Group>
								<Button
									size="compact-xs"
									variant="default"
									aria-label={`Медиа ${index + 1} выше`}
									disabled={busy || index === 0}
									onClick={() => move(index, -1)}
								>
									↑
								</Button>
								<Button
									size="compact-xs"
									variant="default"
									aria-label={`Медиа ${index + 1} ниже`}
									disabled={busy || index === selected.items.length - 1}
									onClick={() => move(index, 1)}
								>
									↓
								</Button>
								<Button
									size="compact-xs"
									color="red"
									variant="subtle"
									disabled={busy || selected.items.length < 2}
									onClick={() =>
										changed({
											...selected,
											items: selected.items.filter((i) => i.id !== item.id),
										})
									}
								>
									Убрать из галереи
								</Button>
								{item.kind === 'video' && (
									<a href={item.url} target="_blank" rel="noreferrer">
										Смотреть видео
									</a>
								)}
							</Group>
						</Stack>
					</Group>
				</Paper>
			))}
		</Stack>
	);
}
