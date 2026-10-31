import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fullImage, type AdminGallery } from '../../ui/client';

test('upload a single photo in the media dialog and retry S3 without uploading it again', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	let uploads = 0;
	const published: string[] = [];
	let failPublish = false;
	await page.route('**/api/upload?*', (route) => {
		uploads++;
		return uploads === 1
			? route.fulfill({ status: 500, json: { error: 'Ошибка загрузки файла' } })
			: route.continue();
	});
	await page.route('**/api/publish', (route) => {
		published.push(route.request().postDataJSON().gallery);
		return route.fulfill({ json: { id: `single-photo-publish-${published.length}` } });
	});
	await page.route('**/api/jobs/single-photo-publish-*', (route) => {
		const first = route.request().url().endsWith('-1');
		return route.fulfill({ json: {
			stage: first ? (failPublish ? 'error' : 'publishing') : 'done',
			message: first ? (failPublish ? 'S3 unavailable' : 'Загрузка и проверка S3') : 'Готово',
		} });
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Новая статья' }).click();
	await page.getByLabel('Slug', { exact: true }).fill('uploaded-single-photo');
	await page.getByLabel('Заголовок', { exact: true }).fill('Загруженное одиночное фото');
	await page.getByLabel('Краткое описание').fill('Загрузка из редактора');
	await page.locator('.tiptap').fill('До фото.');
	await page.locator('.tiptap').press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('После фото.');
	await page.keyboard.press('Home');
	await page.getByRole('button', { name: 'Фото / видео', exact: true }).click();
	const modal = page.getByRole('dialog', { name: 'Фото / видео', exact: true });
	await modal.getByLabel('Описание (alt)').fill('Загруженное фото');
	const input = modal.locator('input[type=file]');
	await input.setInputFiles(resolve('.state/admin-e2e/photo.jpeg'));
	await expect(modal.getByRole('alert')).toContainText('Ошибка загрузки файла');
	await input.setInputFiles(resolve('.state/admin-e2e/photo.jpeg'));
	await expect(modal.getByRole('status')).toHaveText('Загрузка и проверка S3');
	await expect(modal.getByRole('button', { name: 'Закрыть окно медиа' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled();
	await expect(modal.getByRole('button', { name: 'Применить', exact: true })).toBeDisabled();
	failPublish = true;
	await expect(modal.getByRole('alert')).toContainText('S3 unavailable');
	await modal.getByRole('button', { name: 'Повторить загрузку в S3' }).click();
	await expect(modal.getByRole('status')).toContainText('Файл загружен');
	expect(uploads).toBe(2);
	expect(published).toHaveLength(2);
	expect(published[1]).toBe(published[0]);
	const src = await modal.getByLabel('URL изображения').inputValue();
	expect(src).toMatch(/^\/media\/[a-f0-9]{64}\/\d+\.jpeg$/);
	await modal.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(page.locator('.tiptap > p').first()).toHaveText('До фото.');
	await expect(page.locator('.tiptap > p').last()).toHaveText('После фото.');
	const inserted = page.locator('.tiptap').getByRole('img', { name: 'Загруженное фото' });
	await expect(inserted).toHaveAttribute('src', src);
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Файл сохранён');
	await page.reload();
	await page.getByText('Загруженное одиночное фото', { exact: true }).click();
	await expect(inserted).toHaveAttribute('src', src);
	expect(errors).toEqual([]);
});

test('upload video in the media dialog, edit it and reopen it as a playable video', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.route('**/api/publish', (route) => route.fulfill({ json: { id: 'single-video-publish' } }));
	await page.route('**/api/jobs/single-video-publish', (route) => route.fulfill({ json: { stage: 'done', message: 'Готово' } }));
	await page.goto('/');
	await page.getByRole('button', { name: 'Новая статья' }).click();
	await page.getByLabel('Slug', { exact: true }).fill('uploaded-single-video');
	await page.getByLabel('Заголовок', { exact: true }).fill('Одиночное видео');
	await page.getByLabel('Краткое описание').fill('Загрузка видео из редактора');
	await page.locator('.tiptap').fill('До видео.');
	await page.locator('.tiptap').press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('После видео.');
	await page.keyboard.press('Home');
	await page.getByRole('button', { name: 'Фото / видео', exact: true }).click();
	const modal = page.getByRole('dialog', { name: 'Фото / видео', exact: true });
	await modal.locator('input[type=file]').setInputFiles(resolve('.state/admin-e2e/video.mp4'));
	await expect(modal.getByRole('status')).toContainText('Файл загружен');
	await expect(modal.getByRole('radio', { name: 'Видео', exact: true })).toBeChecked();
	await modal.getByLabel('Описание видео', { exact: true }).fill('Тестовый ролик');
	await modal.getByLabel('Подсказка', { exact: true }).fill('Загруженное видео');
	const src = await modal.getByLabel('URL видео', { exact: true }).inputValue();
	expect(src).toMatch(/^\/media\/[a-f0-9]{64}\/video\.mp4$/);
	await modal.getByRole('button', { name: 'Применить', exact: true }).click();
	const video = page.locator('.tiptap video');
	await expect(video).toHaveCount(1);
	await expect(video).toHaveAttribute('src', src);
	await expect(video).toHaveAttribute('poster', /\/media\/[a-f0-9]{64}\/\d+\.jpeg$/);
	await expect(video).toHaveJSProperty('controls', true);
	await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState)).toBeGreaterThanOrEqual(2);
	await expect(page.locator('.tiptap > p').first()).toHaveText('До видео.');
	await expect(page.locator('.tiptap > p').last()).toHaveText('После видео.');
	await video.click({ position: { x: 5, y: 5 } });
	await page.getByRole('button', { name: 'Фото / видео', exact: true }).click();
	await expect(modal.getByLabel('URL видео', { exact: true })).toHaveValue(src);
	await modal.getByLabel('Описание видео', { exact: true }).fill('Описание после правки');
	await modal.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(video).toHaveCount(1);
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Файл сохранён');
	await page.reload();
	await page.getByText('Одиночное видео', { exact: true }).click();
	await expect(video).toHaveAttribute('src', src);
	await expect(video).toHaveAttribute('aria-label', 'Описание после правки');
	await expect(video).toHaveAttribute('title', 'Загруженное видео');
	await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Новая статья' }).click();
	await page.getByRole('button', { name: 'Фото / видео', exact: true }).click();
	await modal.getByRole('combobox', { name: 'Из медиабиблиотеки' }).click();
	const galleries: AdminGallery[] = await (await page.request.get('/api/galleries')).json();
	const uploaded = galleries.find((g) => g.items.some((i) => i.kind === 'video' && i.url === src))!;
	await page.getByRole('option', { name: `${uploaded.id} / ${uploaded.items[0].id}`, exact: true }).click();
	await expect(modal.getByLabel('URL видео', { exact: true })).toHaveValue(src);
	await modal.getByLabel('URL видео', { exact: true }).fill(`${src}?v=2`);
	await modal.getByRole('button', { name: 'Применить', exact: true }).click();
	await expect(video).toHaveAttribute('src', `${src}?v=2`);
	await expect(video).not.toHaveAttribute('poster', /.+/);
	expect(errors).toEqual([]);
});

test('insert a single image shared by multiple galleries without duplicate options', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const galleries: AdminGallery[] = await (
		await page.request.get('/api/galleries')
	).json();
	const gallery = galleries.find((g) => g.id === 'admin-fixture')!;
	const src = fullImage(gallery.items[0]);
	await page.route('**/api/galleries', (route) =>
		route.fulfill({
			json: [gallery, { ...gallery, id: 'shared-photo' }],
		}),
	);
	await page.goto('/');
	await page.getByRole('button', { name: 'Новая статья' }).click();
	await page.getByLabel('Slug', { exact: true }).fill('single-image');
	await page.getByLabel('Заголовок', { exact: true }).fill('Одиночное фото');
	await page.getByLabel('Краткое описание').fill('Фото в двух галереях');
	await page.getByRole('button', { name: 'Фото / видео', exact: true }).click();
	const modal = page.getByRole('dialog', { name: 'Фото / видео', exact: true });
	for (const id of ['admin-fixture', 'shared-photo']) {
		await modal.getByRole('combobox', { name: 'Из медиабиблиотеки' }).click();
		await page
			.getByRole('option', { name: `${id} / photo`, exact: true })
			.click();
		await expect(modal.getByLabel('URL изображения')).toHaveValue(src);
	}
	await modal.getByLabel('Описание (alt)').fill('Общее фото');
	await modal.getByLabel('Подсказка', { exact: true }).fill('Подсказка фото');
	await modal.getByRole('button', { name: 'Применить', exact: true }).click();
	const inserted = page.locator('.tiptap').getByRole('img', { name: 'Общее фото' });
	await expect(inserted).toHaveAttribute('src', src);
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Файл сохранён');
	await page.reload();
	await page.getByText('Одиночное фото', { exact: true }).click();
	await expect(inserted).toHaveAttribute('src', src);
	await expect(inserted).toHaveAttribute('title', 'Подсказка фото');
	expect(errors).toEqual([]);
});

test('visual blocks survive opening and unchanged save without rewriting MDX', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const file = resolve('.state/admin-e2e/content/blog/existing.mdx');
	const before = await readFile(file, 'utf8');
	await page.goto('/');
	await page.getByText('Существующая статья', { exact: true }).click();
	await expect(page.locator('.tiptap table')).toHaveCount(1);
	await expect(page.locator('.tiptap .details')).toHaveCount(1);
	await expect(page.getByLabel('Язык кода')).toHaveValue('typescript');
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Файл сохранён');
	await expect.poll(() => readFile(file, 'utf8')).toBe(before);
	await page
		.getByLabel('Заголовок', { exact: true })
		.fill('Статья после редактирования');
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Файл сохранён');
	const after = await readFile(file, 'utf8');
	expect(after.split('\n---\n')[1]).toBe(before.split('\n---\n')[1]);
	expect(after).toContain('"extra": "preserved"');
	expect(errors).toEqual([]);
	await page.screenshot({ path: '.state/admin-editor.png', fullPage: true });
});
test('create blog, edit text and reopen it with local preview', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Новая статья' }).click();
	await page.getByLabel('Slug', { exact: true }).fill('browser-post');
	await page
		.getByLabel('Заголовок', { exact: true })
		.fill('Новая статья из браузера');
	await page.getByLabel('Краткое описание').fill('Описание для проверки');
	await page.locator('.tiptap').fill('Текст из визуального редактора.');
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Файл сохранён');
	await page.reload();
	await page.getByText('Новая статья из браузера', { exact: true }).click();
	await expect(page.locator('.tiptap')).toContainText(
		'Текст из визуального редактора.',
	);
	const popup = page.waitForEvent('popup');
	await page
		.getByRole('button', { name: 'Сохранить и открыть превью' })
		.click();
	const preview = await popup;
	await preview.waitForURL('**/blog/browser-post/');
	await expect(preview.getByRole('heading', { level: 1 })).toHaveText(
		'Новая статья из браузера',
	);
	await expect(preview.locator('article')).toContainText(
		'Текст из визуального редактора.',
	);
});
test('create draft chapter, insert gallery and preview it through Astro', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByText('Путешествия', { exact: true }).click();
	await page.getByText('Тестовая поездка', { exact: true }).click();
	await page.getByRole('button', { name: 'Добавить главу / заметку' }).click();
	await page.getByLabel('Slug', { exact: true }).fill('browser-chapter');
	await page.getByLabel('Заголовок', { exact: true }).fill('Глава из браузера');
	await page.getByLabel('Краткое описание').fill('Описание главы');
	await page.getByRole('button', { name: 'Выбрать фотографии' }).click();
	await page
		.getByRole('button', { name: 'Выбрать admin-fixture/photo', exact: true })
		.click();
	await page.getByRole('button', { name: 'Применить 1 фото' }).click();
	await page.locator('.tiptap').fill('Текст главы.');
	await page.getByRole('button', { name: 'Галерея', exact: true }).click();
	await page.getByRole('combobox', { name: 'Галерея', exact: true }).click();
	await page
		.getByRole('option', { name: 'admin-fixture', exact: true })
		.click();
	await page.getByRole('button', { name: 'Вставить в текст' }).click();
	await expect(page.getByTestId('gallery-block')).toBeVisible();
	const popup = page.waitForEvent('popup');
	await page
		.getByRole('button', { name: 'Сохранить и открыть превью' })
		.click();
	const preview = await popup;
	await preview.waitForURL('**/travel/sample/browser-chapter/');
	await expect(preview.getByRole('heading', { level: 1 })).toHaveText(
		'Глава из браузера',
	);
	await expect(preview.locator('travel-gallery img')).toHaveCount(1);
	await expect
		.poll(() =>
			preview
				.locator('travel-gallery img')
				.evaluate(
					(img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
				),
		)
		.toBeTruthy();
});
test('prepare upload locally, persist captions and display pending S3 status', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByText('Медиа', { exact: true }).first().click();
	await page.getByRole('combobox', { name: 'Галерея', exact: true }).click();
	await page
		.getByRole('option', { name: 'admin-fixture', exact: true })
		.click();
	await page
		.locator('input[type=file]')
		.setInputFiles(resolve('.state/admin-e2e/photo.jpeg'));
	await expect(page.getByRole('status')).toHaveText('Готово');
	await expect(page.getByLabel('Alt · RU')).toHaveCount(2);
	await page.getByLabel('Alt · RU').nth(1).fill('Загруженное фото');
	await page.getByLabel('Подпись · EN').nth(1).fill('Uploaded locally');
	await page.getByRole('button', { name: 'Сохранить галерею' }).click();
	await expect(page.getByRole('status')).toHaveText(
		'Подписи и порядок сохранены',
	);
	await expect(
		page.getByRole('button', { name: 'Загрузить в S3 (1)' }),
	).toBeEnabled();
	await page.reload();
	await page.getByText('Медиа', { exact: true }).first().click();
	await page.getByRole('combobox', { name: 'Галерея', exact: true }).click();
	await page
		.getByRole('option', { name: 'admin-fixture', exact: true })
		.click();
	await expect(page.getByLabel('Alt · RU').nth(1)).toHaveValue(
		'Загруженное фото',
	);
	await expect(page.getByLabel('Подпись · EN').nth(1)).toHaveValue(
		'Uploaded locally',
	);
});

test('external edit is protected and reopening refreshes the actual editor document', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByText('Статья после редактирования', { exact: true }).click();
	const file = resolve('.state/admin-e2e/content/blog/existing.mdx');
	const source = await readFile(file, 'utf8');
	const headerEnd = source.indexOf('\n---\n', 4) + 5;
	await writeFile(
		file,
		source.slice(0, headerEnd) + '\nИзменено внешним редактором.\n',
	);
	await page.getByLabel('Заголовок', { exact: true }).fill('Локальная правка');
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByText(/Файл изменён извне/)).toBeVisible();
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByText('Статья после редактирования', { exact: true }).click();
	await expect(page.locator('.tiptap')).toContainText(
		'Изменено внешним редактором.',
	);
});

test('create a gallery from the insertion dialog and insert it at the saved cursor', async ({
	page,
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.route('**/api/galleries', (route) => route.fulfill({ json: [] }));
	await page.goto('/');
	await page.getByRole('button', { name: 'Новая статья' }).click();
	await page.getByLabel('Slug', { exact: true }).fill('create-inline-gallery');
	await page
		.getByLabel('Заголовок', { exact: true })
		.fill('Статья с новой галереей');
	await page
		.getByLabel('Краткое описание')
		.fill('Создание без ухода из статьи');
	await page.locator('.tiptap').fill('Текст до галереи.');
	await page.locator('.tiptap').press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Текст после галереи.');
	await page.keyboard.press('Home');
	await page.getByRole('button', { name: 'Галерея', exact: true }).click();
	const picker = page.getByRole('dialog', {
		name: 'Вставить галерею',
		exact: true,
	});
	await expect(
		picker.getByRole('button', { name: 'Вставить в текст' }),
	).toBeDisabled();
	await picker
		.getByRole('button', { name: 'Создать галерею', exact: true })
		.click();
	const modal = page.getByRole('dialog', {
		name: 'Создать галерею',
		exact: true,
	});
	await expect(
		modal.getByRole('button', { name: 'Вставить в текст' }),
	).toBeDisabled();
	await modal.getByRole('button', { name: 'Закрыть редактор медиа' }).click();
	await expect(modal).not.toBeVisible();
	await expect(page.locator('.tiptap')).toBeFocused();
	await expect(page.getByTestId('gallery-block')).toHaveCount(0);
	await page.getByRole('button', { name: 'Галерея', exact: true }).click();
	await picker
		.getByRole('button', { name: 'Создать галерею', exact: true })
		.click();
	await modal.getByLabel('ID новой галереи').fill('inline-created');
	await page.unroute('**/api/galleries');
	await page.route(
		'**/api/upload?*',
		(route) =>
			route.fulfill({
				status: 500,
				json: { error: 'Не удалось загрузить фото' },
			}),
		{ times: 1 },
	);
	await modal
		.locator('input[type=file]')
		.setInputFiles(resolve('.state/admin-e2e/photo.jpeg'));
	await expect(modal.getByRole('alert')).toContainText(
		'Не удалось загрузить фото',
	);
	await expect(
		modal.getByRole('button', { name: 'Вставить в текст' }),
	).toBeDisabled();
	await modal
		.locator('input[type=file]')
		.setInputFiles(resolve('.state/admin-e2e/photo.jpeg'));
	await expect(modal.getByRole('status')).toHaveText('Готово');
	await modal.getByLabel('Alt · RU').fill('Фото новой галереи');
	await expect(
		modal.getByRole('button', { name: 'Вставить в текст' }),
	).toBeDisabled();
	await modal.getByRole('button', { name: 'Сохранить галерею' }).click();
	await expect(modal.getByRole('status')).toHaveText(
		'Подписи и порядок сохранены',
	);
	await modal.getByRole('button', { name: 'Вставить в текст' }).click();
	await expect(modal).not.toBeVisible();
	await expect(page.locator('.tiptap')).toBeFocused();
	await expect(
		page.getByTestId('gallery-block').getByRole('combobox'),
	).toHaveValue('inline-created');
	await expect(
		page.getByTestId('gallery-block').getByAltText('Фото новой галереи'),
	).toBeVisible();
	await expect(page.locator('.tiptap > p').first()).toHaveText(
		'Текст до галереи.',
	);
	await expect(page.locator('.tiptap > p').last()).toHaveText(
		'Текст после галереи.',
	);
	await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(
		'Статья с новой галереей',
	);
	const file = resolve(
		'.state/admin-e2e/content/blog/create-inline-gallery.mdx',
	);
	await expect(readFile(file, 'utf8')).rejects.toThrow();
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Файл сохранён');
	const saved = await readFile(file, 'utf8');
	expect(saved).toMatch(
		/Текст до галереи\.[\s\S]*<MediaGallery gallery="inline-created"[\s\S]*Текст после галереи\./,
	);
	await page.reload();
	await page.getByText('Статья с новой галереей', { exact: true }).click();
	await expect(
		page.getByTestId('gallery-block').getByRole('combobox'),
	).toHaveValue('inline-created');
	expect(errors).toEqual([]);
});

test('edit gallery from its block without losing unsaved text or cursor', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Новая статья' }).click();
	await page.getByLabel('Slug', { exact: true }).fill('inline-media');
	await page
		.getByLabel('Заголовок', { exact: true })
		.fill('Статья с окном медиа');
	await page.getByLabel('Краткое описание').fill('Несохранённый текст');
	await page.locator('.tiptap').fill('Текст до галереи.');
	await page.getByRole('button', { name: 'Галерея', exact: true }).click();
	await page.getByRole('combobox', { name: 'Галерея', exact: true }).click();
	await page
		.getByRole('option', { name: 'admin-fixture', exact: true })
		.click();
	await page.getByRole('button', { name: 'Вставить в текст' }).click();
	await page.locator('.tiptap > p').first().click();
	for (let index = 0; index < 'Текст до галереи.'.length; index++)
		await page.keyboard.press('ArrowLeft');
	await expect
		.poll(() =>
			page
				.locator('.tiptap > p')
				.first()
				.evaluate((paragraph) => {
					const selection = window.getSelection();
					return (
						!!selection?.anchorNode &&
						paragraph.contains(selection.anchorNode) &&
						selection.anchorOffset === 0
					);
				}),
		)
		.toBeTruthy();
	await page
		.getByRole('button', { name: 'Редактировать медиа', exact: true })
		.click();
	const modal = page.getByRole('dialog', {
		name: 'Редактировать медиа',
		exact: true,
	});
	await expect(
		modal.getByRole('combobox', { name: 'Галерея', exact: true }),
	).toHaveValue('admin-fixture');
	await modal.getByLabel('Alt · RU').first().fill('Описание из окна');
	await modal.getByRole('button', { name: 'Сохранить галерею' }).click();
	await expect(modal.getByRole('status')).toHaveText(
		'Подписи и порядок сохранены',
	);
	await modal.getByRole('button', { name: 'Закрыть редактор медиа' }).click();
	await expect(modal).not.toBeVisible();
	await expect(page.locator('.tiptap')).toBeFocused();
	await expect(
		page.getByTestId('gallery-block').getByAltText('Описание из окна'),
	).toBeVisible();
	await page.keyboard.type('Продолжение ');
	await expect(page.locator('.tiptap > p').first()).toHaveText(
		'Продолжение Текст до галереи.',
	);
	await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(
		'Статья с окном медиа',
	);
	await expect(
		readFile(resolve('.state/admin-e2e/content/blog/inline-media.mdx'), 'utf8'),
	).rejects.toThrow();
	await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Файл сохранён');
	expect(
		await readFile(
			resolve('.state/admin-e2e/content/blog/inline-media.mdx'),
			'utf8',
		),
	).toContain('Продолжение Текст до галереи.');
	await page
		.getByRole('button', { name: 'Редактировать медиа', exact: true })
		.click();
	await modal
		.getByLabel('Подпись · RU')
		.first()
		.fill('Не сохранять эту подпись');
	page.once('dialog', (dialog) => dialog.dismiss());
	await modal.getByRole('button', { name: 'Закрыть редактор медиа' }).click();
	await expect(modal).toBeVisible();
	await expect(modal.getByLabel('Подпись · RU').first()).toHaveValue(
		'Не сохранять эту подпись',
	);
	page.once('dialog', (dialog) => dialog.accept());
	await modal.getByRole('button', { name: 'Закрыть редактор медиа' }).click();
	await expect(modal).not.toBeVisible();
});

test('saved gallery order and captions refresh in an already running preview', async ({
	page,
}) => {
	await page.goto('/');
	const galleries: AdminGallery[] = await (
		await page.request.get('/api/galleries')
	).json();
	const photo = galleries.find((gallery) => gallery.id === 'admin-fixture')!
		.items[0];
	const created = await page.request.post('/api/gallery', {
		headers: { Origin: new URL(page.url()).origin },
		data: {
			version: null,
			gallery: {
				id: 'reorder-preview',
				items: ['first', 'second', 'third'].map((id) => ({
					...photo,
					id,
					alt: { ru: id, en: id },
				})),
			},
		},
	});
	expect(created.ok()).toBeTruthy();
	await page.reload();
	await page.getByRole('button', { name: 'Новая статья' }).click();
	await page.getByLabel('Slug', { exact: true }).fill('gallery-order');
	await page.getByLabel('Заголовок', { exact: true }).fill('Порядок галереи');
	await page
		.getByLabel('Краткое описание')
		.fill('Сортировка в открытом превью');
	await page.getByRole('button', { name: 'Галерея', exact: true }).click();
	await page.getByRole('combobox', { name: 'Галерея', exact: true }).click();
	await page
		.getByRole('option', { name: 'reorder-preview', exact: true })
		.click();
	await page.getByRole('button', { name: 'Вставить в текст' }).click();
	const popup = page.waitForEvent('popup');
	await page
		.getByRole('button', { name: 'Сохранить и открыть превью' })
		.click();
	const preview = await popup;
	await expect
		.poll(() =>
			preview
				.locator('travel-gallery img')
				.evaluateAll((images) =>
					images.map((image) => image.getAttribute('alt')),
				),
		)
		.toEqual(['first', 'second', 'third']);
	await page
		.getByRole('button', { name: 'Редактировать медиа', exact: true })
		.click();
	const modal = page.getByRole('dialog', {
		name: 'Редактировать медиа',
		exact: true,
	});
	await modal
		.getByRole('button', { name: 'Медиа 3 выше', exact: true })
		.click();
	await modal
		.getByLabel('Подпись · RU')
		.nth(1)
		.fill('Новая подпись третьего фото');
	await expect
		.poll(() =>
			modal
				.getByLabel('Alt · RU')
				.evaluateAll((inputs: HTMLInputElement[]) =>
					inputs.map((input) => input.value),
				),
		)
		.toEqual(['first', 'third', 'second']);
	await modal.getByRole('button', { name: 'Сохранить галерею' }).click();
	await expect(modal.getByRole('status')).toHaveText(
		'Подписи и порядок сохранены',
	);
	await modal.getByRole('button', { name: 'Закрыть редактор медиа' }).click();
	await expect(modal).not.toBeVisible();
	await page
		.getByRole('button', { name: 'Редактировать медиа', exact: true })
		.click();
	await expect
		.poll(() =>
			modal
				.getByLabel('Alt · RU')
				.evaluateAll((inputs: HTMLInputElement[]) =>
					inputs.map((input) => input.value),
				),
		)
		.toEqual(['first', 'third', 'second']);
	await preview.reload();
	await expect
		.poll(() =>
			preview
				.locator('travel-gallery img')
				.evaluateAll((images) =>
					images.map((image) => image.getAttribute('alt')),
				),
		)
		.toEqual(['first', 'third', 'second']);
	await expect(preview.locator('travel-gallery figcaption')).toHaveText(
		'Новая подпись третьего фото',
	);
	await preview.locator('travel-gallery [data-media-index="1"]').click();
	await expect(
		preview.locator('.gslide.current .gslide-image img'),
	).toHaveAttribute('alt', 'third');
});
