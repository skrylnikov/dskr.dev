import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photoFlexLayout } from 'photo-flex-layout';
import { galleryLayout } from '../../src/scripts/travel-gallery-layout';

test('gallery layout raises small rows while preserving exceptionally wide images', () => {
	const items = [0.75, 0.75, 0.75, 4 / 3, 4 / 3, 0.75].map((ratio) => ({ width: ratio * 1200, height: 1200 }));
	const initial = photoFlexLayout({ items, containerWidth: 776, boxSpacing: 8, targetRowHeight: 272 }).boxes;
	assert.ok(Math.min(...initial.map((box) => box.height)) < 224);
	assert.ok(Math.min(...galleryLayout(items, 768, 8, 272, 224).map((box) => box.height)) >= 224);
	const panorama = galleryLayout([{ width: 10000, height: 1000 }, ...items], 768, 8, 272, 224);
	assert.equal(panorama.length, items.length + 1);
	assert.ok(panorama.every((box) => box.width <= 768 + .01));
});
