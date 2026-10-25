import { getCollection } from 'astro:content';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildTravelCatalog, gallerySchema, type TravelMedia, type Gallery } from '../data/travel.mts';

export const travelContentRoot = process.env.TRAVEL_CONTENT_ROOT || './src/content/travel';
const mediaDir = resolve(travelContentRoot, 'media');
const galleries = new Map<string, Gallery>();
for (const file of readdirSync(mediaDir).filter((file) => file.endsWith('.json'))) {
	const gallery = gallerySchema.parse(JSON.parse(readFileSync(resolve(mediaDir, file), 'utf8')));
	if (galleries.has(gallery.id)) throw new Error(`Duplicate gallery: ${gallery.id}`);
	galleries.set(gallery.id, gallery);
}
export function getGallery(id: string): Gallery {
	const gallery = galleries.get(id);
	if (!gallery) throw new Error(`Missing travel gallery: ${id}`);
	return gallery;
}
export function getTravelMedia(ref: string): TravelMedia {
	const [galleryId, mediaId] = ref.split('/');
	const media = getGallery(galleryId).items.find((item) => item.id === mediaId);
	if (!media) throw new Error(`Missing travel media: ${ref}`);
	return media;
}
export async function getTravelCatalog() {
	const catalog = buildTravelCatalog(await getCollection('trips'), await getCollection('travelEntries'), import.meta.env.DEV && process.env.ADMIN_PREVIEW === '1');
	for (const { data } of [...catalog.trips, ...catalog.entries]) {
		if ('collage' in data) for (const ref of data.collage) {
			if (getTravelMedia(ref).kind !== 'image') throw new Error(`Collage must use photos: ${ref}`);
		}
	}
	return catalog;
}
