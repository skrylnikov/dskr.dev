// Synthetic content lives outside src/content and is never included in a normal build.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '../../scripts/travel-media.mts';
import sharp from 'sharp';
import { generateLqip } from '../../scripts/travel-lqip.mts';

const root = resolve('.state/travel-fixtures');
const save = async (file: string, contents: string) => { const path = join(root, file); await mkdir(resolve(path, '..'), { recursive: true }); await writeFile(path, contents); };
const mdx = (data: object, body = '') => `---\n${JSON.stringify(data, null, 2)}\n---\n\n${body}\n`;
const collage = [0, 1, 2, 3, 5, 6].map((index) => `sample/frame-${index}`);
const items = Array.from({ length: 200 }, (_, index) => {
	const base = { id: `frame-${index}`, width: 1200, height: 800, lqip: [] as string[], alt: { ru: `Тестовый кадр ${index}`, en: `Test frame ${index}` }, ...(index === 0 || index === 2 ? { caption: { ru: index === 0 ? 'Прогулка у воды.\nПервый кадр поездки.' : 'Длинное описание вертикального кадра. '.repeat(18), en: index === 0 ? 'A walk by the water.\nThe first photo of the trip.' : 'A long description of a portrait photograph. '.repeat(18) } } : {}) };
	const hash = createHash('sha256').update(String(index)).digest('hex');
	if (index === 2) return { ...base, width: 600, height: 1000, kind: 'image', sources: [{ url: `/media/${hash}/640.jpeg`, width: 600, height: 1000, format: 'jpeg' }, { url: `/media/${hash}/640.jxl`, width: 600, height: 1000, format: 'jxl' }] };
	return index === 4 || index === 199 ? { ...base, width: index === 4 ? 160 : 120, height: index === 4 ? 120 : 160, caption: { ru: 'Нижний пруд', en: 'Lower pond' }, kind: 'video', duration: 6, url: `/media/${hash}/video.mp4`, poster: `/media/${hash}/poster.jpeg`, posterSources: ['jpeg', 'webp', 'jxl'].map((format) => ({ url: `/media/${hash}/${index === 4 ? 160 : 120}.${format}`, width: index === 4 ? 160 : 120, height: index === 4 ? 120 : 160, format })) } : { ...base, kind: 'image', sources: [{ url: `/media/${hash}/640.jpeg`, width: 640, height: 427, format: 'jpeg' }, { url: `/media/${hash}/1280.jpeg`, width: 1200, height: 800, format: 'jpeg' }, { url: `/media/${hash}/1280.jxl`, width: 1200, height: 800, format: 'jxl' }] };
});
await sharp('public/assets/photo-lib-part-1.jpg').resize(600, 1000).jpeg().toFile(join(root, 'portrait.jpeg'));
await sharp('public/assets/photo-lib-part-1.jpg').resize(1200, 800).jpeg().toFile(join(root, 'landscape.jpeg'));
for (const [name, width, height] of [['video-landscape', 160, 120], ['video-portrait', 120, 160]] as const) {
	await sharp({ create: { width, height, channels: 3, background: 'green' } }).jpeg({ progressive: true }).toFile(join(root, `${name}.jpeg`));
}
for (const name of ['portrait', 'landscape', 'video-landscape', 'video-portrait']) {
	await sharp(join(root, `${name}.jpeg`)).png().toFile(join(root, `${name}.png`));
	await sharp(join(root, `${name}.jpeg`)).webp().toFile(join(root, `${name}.webp`));
	await run('cjxl', [join(root, `${name}.png`), join(root, `${name}.jxl`), '--distance=1', '--effort=7', '--progressive', '--num_threads=2']);
	const lqip = await generateLqip(join(root, `${name}.jpeg`));
	for (const [index, item] of items.entries()) {
		const source = index === 2 ? 'portrait' : index === 4 ? 'video-landscape' : index === 199 ? 'video-portrait' : 'landscape';
		if (source === name) item.lqip = lqip;
	}
}
await save('media/sample.json', JSON.stringify({ id: 'sample', items }));
await save('media/single-portrait.json', JSON.stringify({ id: 'single-portrait', items: [items[2]] }));
await save('media/single-landscape.json', JSON.stringify({ id: 'single-landscape', items: [items[1]] }));
for (const locale of ['ru', 'en']) {
	const trip = { slug: 'sample-trip', locale, title: locale === 'ru' ? 'Тестовая поездка' : 'Sample trip', description: 'Synthetic test content', destinations: ['Test city'], startDate: '2026-10-20', endDate: '2026-10-23', collage };
	await save(`trips/sample-trip.${locale}.mdx`, mdx(trip, 'Synthetic introduction.'));
	await save(`trips/draft.${locale}.mdx`, mdx({ ...trip, slug: 'draft-trip', draft: true }));
	await save(`entries/chapter.${locale}.mdx`, mdx({ slug: 'first-walk', trip: trip.slug, locale, kind: 'chapter', title: locale === 'ru' ? 'Прогулка' : 'A walk', description: 'Chapter description', collage, order: 0 }, '## First place\n\nA paragraph.\n\n<MediaGallery gallery="sample" />\n\n## Second place\n\nAnother paragraph.'));
	await save(`entries/note.${locale}.mdx`, mdx({ slug: 'evening', trip: trip.slug, locale, kind: 'note', date: '2026-10-21', order: 1 }, '<MediaGallery gallery="sample" />\n\nA short evening note.'));
	await save(`entries/draft.${locale}.mdx`, mdx({ slug: 'hidden-note', trip: trip.slug, locale, kind: 'note', order: 2, draft: true }, 'DRAFT MUST NOT LEAK'));
	await save(`entries/hidden-parent.${locale}.mdx`, mdx({ slug: 'hidden-parent', trip: 'draft-trip', locale, kind: 'note', order: 0 }, 'PARENT DRAFT MUST NOT LEAK'));
}
await save('entries/ru-only.mdx', mdx({ slug: 'ru-only', trip: 'sample-trip', locale: 'ru', kind: 'chapter', title: 'Без перевода', description: 'Russian only chapter', collage, order: 3 }, 'Текст без перевода.\n\n<MediaGallery gallery="single-portrait" />\n\n<MediaGallery gallery="single-landscape" />'));
console.log(`Fixtures ready: ${root}`);
await run('ffmpeg', ['-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=160x120:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(root, 'clip.mp4')]);
await run('ffmpeg', ['-nostdin', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=120x160:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(root, 'portrait-clip.mp4')]);
