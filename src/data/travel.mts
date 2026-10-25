import { z } from 'astro/zod';
import type { Locale } from '../consts';

export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const copySchema = z.object({ ru: z.string(), en: z.string() });
const mediaUrl = z.string().regex(/^\/media\/[a-f0-9]{64}\/[a-z0-9.-]+$/);
const sourceSchema = z.object({ url: mediaUrl, width: z.number().int().positive(), height: z.number().int().positive(), format: z.enum(['jpeg', 'webp', 'jxl']) });
const imageSourcesSchema = z.array(sourceSchema).min(1).refine((sources) => sources.some((s) => s.format === 'jpeg'), 'JPEG fallback required');
const mediaBase = { id: slugSchema, width: z.number().int().positive(), height: z.number().int().positive(), alt: copySchema, caption: copySchema.optional(), lqip: z.union([z.array(z.string().regex(/^#[a-fA-F0-9]{6}$/)).length(6), z.number().int().min(-524288).max(524287)]).optional() };
export const mediaSchema = z.discriminatedUnion('kind', [
	z.object({ ...mediaBase, kind: z.literal('image'), sources: imageSourcesSchema }),
	z.object({ ...mediaBase, kind: z.literal('video'), url: mediaUrl, poster: mediaUrl, posterSources: imageSourcesSchema.optional(), duration: z.number().nonnegative() }),
]);
export const gallerySchema = z.object({ id: slugSchema, items: z.array(mediaSchema).min(1) }).superRefine((gallery, ctx) => {
	if (new Set(gallery.items.map((item) => item.id)).size !== gallery.items.length) ctx.addIssue({ code: 'custom', message: 'Duplicate media id' });
});
export type TravelMedia = z.infer<typeof mediaSchema>;
export type Gallery = z.infer<typeof gallerySchema>;
const common = { slug: slugSchema, locale: z.enum(['ru', 'en']), draft: z.boolean().default(false), sourceMessageIds: z.array(z.number().int()).optional() };
const collageSchema = z.array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/)).min(3).max(8);
export const tripSchema = z.object({ ...common, title: z.string().min(1), description: z.string().min(1), destinations: z.array(z.string().min(1)).min(1), startDate: z.coerce.date(), endDate: z.coerce.date().optional(), collage: collageSchema }).refine((trip) => !trip.endDate || trip.endDate >= trip.startDate, 'Trip ends before it starts');
const entryBase = { ...common, trip: slugSchema, order: z.number().int().nonnegative(), date: z.coerce.date().optional() };
export const entrySchema = z.discriminatedUnion('kind', [
	z.object({ ...entryBase, kind: z.literal('chapter'), title: z.string().min(1), description: z.string().min(1), collage: collageSchema }),
	z.object({ ...entryBase, kind: z.literal('note'), title: z.string().optional() }),
]);
export type TripData = z.infer<typeof tripSchema>;
export type EntryData = z.infer<typeof entrySchema>;
export type TravelTrip = { id: string; data: TripData; body?: string };
export type TravelEntry = { id: string; data: EntryData; body?: string };

export const travelCopy = {
	ru: { title: 'Путешествия', intro: 'Города, дороги и небольшие истории по пути.', latest: 'Последнее путешествие', all: 'Все путешествия', chapters: 'Главы', chapter: 'Глава', note: 'Заметка', read: 'Читать главу', back: 'К ленте путешествия', previous: 'Предыдущая глава', next: 'Следующая глава', contents: 'В этой главе', more: 'Показать все', remaining: 'Осталось', empty: 'Здесь скоро появятся истории из поездок.', close: 'Закрыть', play: 'Смотреть видео', error: 'Не удалось загрузить медиа. Открыть файл', permalink: 'Ссылка на заметку', view: 'Открыть фото', frame: 'Кадр' },
	en: { title: 'Travel', intro: 'Cities, roads, and little stories along the way.', latest: 'Latest trip', all: 'All trips', chapters: 'Chapters', chapter: 'Chapter', note: 'Note', read: 'Read chapter', back: 'Back to the trip', previous: 'Previous chapter', next: 'Next chapter', contents: 'In this chapter', more: 'Show all', remaining: 'Remaining', empty: 'Stories from the road will appear here soon.', close: 'Close', play: 'Play video', error: 'Could not load this media. Open file', permalink: 'Link to note', view: 'Open photo', frame: 'Frame' },
} as const;

export const travelPath = (locale: Locale, trip?: string, chapter?: string) => `${locale === 'en' ? '/en' : ''}/travel/${trip ? `${trip}/` : ''}${chapter ? `${chapter}/` : ''}`;
export const entryAnchor = (entry: EntryData) => `${entry.kind}-${entry.slug}`;
export const formatTravelDate = (date: Date, locale: Locale) => new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
export { mediaPreview, mediaSource, srcset, mediaPlaceholderStyle } from './travel-media.mts';

export function buildTravelCatalog(trips: TravelTrip[], entries: TravelEntry[], includeDrafts = false) {
	const tripKeys = new Set<string>();
	const entryKeys = new Set<string>();
	const orders = new Set<string>();
	for (const { data } of trips) {
		const key = `${data.locale}/${data.slug}`;
		if (tripKeys.has(key)) throw new Error(`Duplicate trip: ${key}`);
		tripKeys.add(key);
	}
	for (const { data } of entries) {
		const key = `${data.locale}/${data.trip}/${data.slug}`;
		const order = `${data.locale}/${data.trip}/${data.order}`;
		if (!tripKeys.has(`${data.locale}/${data.trip}`)) throw new Error(`Missing trip for ${key}`);
		if (entryKeys.has(key) || orders.has(order)) throw new Error(`Duplicate entry slug or order: ${key}`);
		entryKeys.add(key); orders.add(order);
	}
	const publishedTrips = trips.filter((trip) => includeDrafts || !trip.data.draft).sort((a, b) => b.data.startDate.valueOf() - a.data.startDate.valueOf() || a.data.slug.localeCompare(b.data.slug));
	const publishedKeys = new Set(publishedTrips.map(({ data }) => `${data.locale}/${data.slug}`));
	return {
		trips: publishedTrips,
		entries: entries.filter(({ data }) => (includeDrafts || !data.draft) && publishedKeys.has(`${data.locale}/${data.trip}`)).sort((a, b) => a.data.order - b.data.order),
	};
}
