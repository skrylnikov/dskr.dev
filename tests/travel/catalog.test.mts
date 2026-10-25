import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTravelCatalog, entrySchema, tripSchema, gallerySchema, travelPath } from '../../src/data/travel.mts';
import { pickCollagePhotos, mediaPreview, srcset } from '../../src/data/travel-media.mts';

const trip = (slug = 'trip', locale = 'ru', draft = false) => ({ id: `${slug}-${locale}`, data: tripSchema.parse({ slug, locale, draft, title: 'Trip', description: 'Description', destinations: ['City'], startDate: '2026-10-20', collage: ['gallery/a', 'gallery/b', 'gallery/c'] }) });
const entry = (slug: string, order: number, options = {}) => ({ id: slug, data: entrySchema.parse({ slug, order, trip: 'trip', locale: 'ru', kind: 'note', ...options }) });

test('collages allow 3–8 photos; imports choose six across the whole selection', () => {
	assert.deepEqual(pickCollagePhotos(['a']), ['a', 'a', 'a']);
	assert.deepEqual(pickCollagePhotos(['a', 'b', 'c']), ['a', 'b', 'c']);
	assert.deepEqual(pickCollagePhotos(Array.from({ length: 11 }, (_, index) => String(index))), ['0', '2', '4', '6', '8', '10']);
	assert.throws(() => pickCollagePhotos([]));
	const data = trip().data;
	assert.equal(tripSchema.safeParse({ ...data, collage: Array(6).fill('gallery/a') }).success, true);
	assert.equal(tripSchema.safeParse({ ...data, collage: Array(8).fill('gallery/a') }).success, true);
	assert.equal(tripSchema.safeParse({ ...data, collage: Array(9).fill('gallery/a') }).success, false);
});

test('chapters and titleless notes share explicit order, independently of dates', () => {
	const chapter = entry('chapter', 1, { kind: 'chapter', title: 'Chapter', description: 'Text', collage: ['g/a', 'g/b', 'g/c'] });
	assert.deepEqual(buildTravelCatalog([trip()], [entry('last', 2), chapter, entry('first', 0)]).entries.map((e) => e.data.slug), ['first', 'chapter', 'last']);
	assert.equal(entry('note', 0).data.title, undefined);
	assert.throws(() => entry('chapter', 0, { kind: 'chapter' }));
});
test('draft trips, their entries, and draft entries never publish; locales are independent', () => {
	const catalog = buildTravelCatalog([trip(), trip('trip', 'en', true)], [entry('ru', 1), entry('en', 1, { locale: 'en' }), entry('draft', 2, { draft: true })]);
	assert.equal(catalog.trips.length, 1);
	assert.deepEqual(catalog.entries.map((e) => e.id), ['ru']);
});
test('rejects duplicate trip, entry slugs/orders, missing parents, invalid dates and paths', () => {
	assert.throws(() => buildTravelCatalog([trip(), trip()], []), /Duplicate trip/);
	assert.throws(() => buildTravelCatalog([trip()], [entry('a', 1), entry('b', 1)]), /Duplicate entry/);
	assert.throws(() => buildTravelCatalog([trip()], [entry('a', 1), entry('a', 2)]), /Duplicate entry/);
	assert.throws(() => buildTravelCatalog([], [entry('a', 1)]), /Missing trip/);
	assert.equal(tripSchema.safeParse({ ...trip().data, endDate: '2020-01-01' }).success, false);
	assert.equal(entrySchema.safeParse({ ...entry('a', 1).data, slug: '../escape' }).success, false);
	assert.equal(travelPath('en', 'trip', 'chapter'), '/en/travel/trip/chapter/');
});
test('latest trip is determined by start date', () => {
	const old = trip('old'); old.data.startDate = new Date('2025-01-01');
	assert.deepEqual(buildTravelCatalog([old, trip()], []).trips.map((t) => t.data.slug), ['trip', 'old']);
});
test('gallery validation rejects arbitrary URLs and duplicate media', () => {
	const media = { id: 'one', kind: 'video', width: 100, height: 200, duration: 3, alt: { ru: 'Кадр', en: 'Frame' }, url: `/media/${'a'.repeat(64)}/video.mp4`, poster: `/media/${'a'.repeat(64)}/poster.jpeg` };
	assert.equal(gallerySchema.safeParse({ id: 'g', items: [media] }).success, true);
	assert.equal(gallerySchema.safeParse({ id: 'g', items: [media, media] }).success, false);
	assert.equal(gallerySchema.safeParse({ id: 'g', items: [{ ...media, url: 'javascript:alert(1)' }] }).success, false);
	assert.equal(mediaPreview(media), media.poster);
	assert.equal(srcset(media, 'jxl'), '');
	const posterSources = ['jpeg', 'webp', 'jxl'].map((format) => ({ url: `/media/${'b'.repeat(64)}/100.${format}`, width: 100, height: 200, format }));
	const video = gallerySchema.parse({ id: 'g', items: [{ ...media, posterSources }] }).items[0];
	assert.equal(mediaPreview(video), posterSources[0].url);
	assert.equal(srcset(video, 'jxl'), `${posterSources[2].url} 100w`);
	assert.equal(gallerySchema.safeParse({ id: 'g', items: [{ ...media, posterSources: posterSources.slice(1) }] }).success, false);
	assert.equal(gallerySchema.safeParse({ id: 'g', items: [{ ...media, posterSources: [{ ...posterSources[0], url: 'https://example.com/poster.jpeg' }] }] }).success, false);
});
