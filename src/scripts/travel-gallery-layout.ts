import { photoFlexLayout } from 'photo-flex-layout';
import type { TravelMedia } from '../data/travel.mts';

export function galleryLayout(items: Pick<TravelMedia, 'width' | 'height'>[], width: number, gap: number, target: number, minimum: number) {
	let best = photoFlexLayout({ items, containerWidth: width + gap, boxSpacing: gap, targetRowHeight: target }).boxes;
	const score = (boxes: typeof best) => boxes.reduce((lowest, box) => Math.min(lowest, box.height / Math.min(minimum, width / box.aspectRatio)), Infinity);
	let bestScore = score(best);
	// shortcut: unusual aspect ratios may stay below the minimum; use a constrained layout algorithm if needed.
	for (let step = 1; step <= 6 && bestScore < 1; step++) {
		const boxes = photoFlexLayout({ items, containerWidth: width + gap, boxSpacing: gap, targetRowHeight: target * (1 + step / 4) }).boxes;
		const candidateScore = score(boxes);
		if (candidateScore > bestScore) { best = boxes; bestScore = candidateScore; }
	}
	return best;
}
