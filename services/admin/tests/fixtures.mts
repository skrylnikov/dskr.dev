import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { prepareGallery } from '../../../scripts/travel-media.mts';

const root = resolve('.state/admin-e2e');
await rm(root, { recursive: true, force: true });
for (const directory of [
	'blog',
	'blogEn',
	'travel/trips',
	'travel/entries',
	'travel/media',
])
	await mkdir(join(root, 'content', directory), { recursive: true });
await sharp({
	create: { width: 80, height: 60, channels: 3, background: '#2e7775' },
})
	.jpeg()
	.toFile(join(root, 'photo.jpeg'));
await writeFile(
	join(root, 'input.json'),
	JSON.stringify({
		id: 'admin-fixture',
		items: [
			{
				id: 'photo',
				file: 'photo.jpeg',
				alt: { ru: 'Тестовое фото', en: 'Test photo' },
			},
		],
	}),
);
await prepareGallery(
	join(root, 'input.json'),
	join(root, 'content/travel/media'),
);
const mdx = (data: unknown, body: string) =>
	`---\n${JSON.stringify(data, null, 2)}\n---\n\n${body}\n`;
await writeFile(
	join(root, 'content/travel/trips/sample.ru.mdx'),
	mdx(
		{
			slug: 'sample',
			locale: 'ru',
			title: 'Тестовая поездка',
			description: 'Черновик поездки',
			destinations: ['Город'],
			startDate: '2026-10-25',
			collage: [
				'admin-fixture/photo',
				'admin-fixture/photo',
				'admin-fixture/photo',
			],
			draft: true,
		},
		'Вступление.',
	),
);
await writeFile(
	join(root, 'content/blog/existing.mdx'),
	mdx(
		{
			title: 'Существующая статья',
			description: 'Проверка блоков',
			publishDate: '2026-10-25',
			extra: 'preserved',
		},
		'**Жирный и *курсив***\n\n| A | B |\n| :- | -: |\n| X | Y |\n\n<details>\n<summary>Подробнее</summary>\n\nВнутренний текст.\n\n</details>\n\n```typescript\nconst x = { value: "<X />" };\n```',
	),
);
console.log('Admin browser fixtures ready');
