import type { Gallery } from '../../../src/data/travel.mts';
import type { Material } from '../store';

export function sortTravelMaterials(materials: Material[]): Material[] {
	const tripKey = (material: Material) =>
		`${material.locale}/${material.type === 'trip' ? material.slug : material.trip}`;
	const trips = new Map(
		materials
			.filter((material) => material.type === 'trip')
			.map((trip) => [tripKey(trip), trip]),
	);
	const startDate = (key: string) =>
		Date.parse(trips.get(key)?.metadata.startDate ?? '') || 0;
	return materials
		.filter((material) => material.type !== 'blog')
		.sort((a, b) => {
			const aTrip = tripKey(a),
				bTrip = tripKey(b);
			return (
				startDate(bTrip) - startDate(aTrip) ||
				aTrip.localeCompare(bTrip) ||
				Number(a.type === 'entry') - Number(b.type === 'entry') ||
				(a.metadata.order ?? 0) - (b.metadata.order ?? 0)
			);
		});
}

export type AdminGallery = Gallery & { version: string; pending?: number };
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
	const response = await fetch(
		`/api/${path}`,
		body === undefined
			? undefined
			: {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				},
	);
	const result = await response.json();
	if (!response.ok)
		throw new Error(result.error ?? 'Не удалось выполнить операцию');
	return result;
}
export const previewImage = (item: Gallery['items'][number]) =>
	item.kind === 'video'
		? item.poster
		: [...item.sources]
				.filter((s) => s.format === 'jpeg')
				.sort((a, b) => a.width - b.width)[0].url;
export const fullImage = (item: Gallery['items'][number]) =>
	item.kind === 'video'
		? item.url
		: [...item.sources]
				.filter((s) => s.format === 'jpeg')
				.sort((a, b) => b.width - a.width)[0].url;
