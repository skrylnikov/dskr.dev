import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
