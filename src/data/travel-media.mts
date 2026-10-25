import type { TravelMedia } from './travel.mts';

export function pickCollagePhotos(refs: string[]): string[] {
	if (!refs.length) throw new Error('Collage needs at least one photo');
	const count = Math.min(6, Math.max(3, refs.length));
	return Array.from({ length: count }, (_, index) => refs[Math.round(index * (refs.length - 1) / (count - 1))]);
}

export const mediaPreview = (media: TravelMedia) => media.kind === 'video' ? media.poster : [...media.sources].filter((s) => s.format === 'jpeg').sort((a, b) => a.width - b.width)[0].url;
export const mediaSource = (media: TravelMedia) => media.kind === 'video' ? media.url : [...media.sources].filter((s) => s.format === 'jpeg').sort((a, b) => b.width - a.width)[0].url;
export const srcset = (media: TravelMedia, format: 'jpeg' | 'webp' | 'jxl') => media.kind === 'image' ? media.sources.filter((s) => s.format === format).map((s) => `${s.url} ${s.width}w`).join(', ') : '';
