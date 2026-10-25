import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { renderTravelPreview } from '../../scripts/travel-previews.mts';
import { travelPreviewKey, getTravelPreview } from '../../src/data/travel-previews.mts';

test('preview contains complete portrait, landscape and square photos without EXIF', async () => {
	const photos = await Promise.all([[80, 160], [160, 80], [80, 80]].map(async ([width, height], index) => {
		const stripe = async (color: string) => await sharp({ create: { width, height: 12, channels: 3, background: color } }).png().toBuffer();
		return await sharp({ create: { width, height, channels: 3, background: ['red', 'green', 'blue'][index] } }).composite([
			{ input: await stripe('white'), left: 0, top: 0 },
			{ input: await stripe('black'), left: 0, top: height - 12 },
		]).png().withMetadata().toBuffer();
	}));
	const preview = await renderTravelPreview(photos);
	const metadata = await sharp(preview.buffer).metadata();
	assert.equal(metadata.format, 'jpeg');
	assert.equal(metadata.exif, undefined);
	assert.equal(metadata.width, preview.width);
	assert.equal(metadata.height, preview.height);
	for (const [top, white] of [[3, true], [preview.height - 4, false]] as const) {
		const row = await sharp(preview.buffer).extract({ left: 0, top, width: preview.width, height: 1 }).removeAlpha().raw().toBuffer();
		let visible = 0;
		for (let x = 0; x < row.length; x += 3) if ([...row.subarray(x, x + 3)].every((value) => white ? value > 230 : value < 30)) visible++;
		assert.ok(visible > preview.width * .95, 'Top and bottom markers of every photo stay visible');
	}
	await assert.rejects(renderTravelPreview(photos.slice(0, 2)), /3–8 photos/);
});

test('preview cache changes with photo content or order and falls back for new collages', () => {
	const sources = ['/media/a/one.jpeg', '/media/b/two.jpeg', '/media/c/three.jpeg'];
	assert.equal(travelPreviewKey(sources), travelPreviewKey([...sources]));
	assert.notEqual(travelPreviewKey(sources), travelPreviewKey([...sources].reverse()));
	assert.notEqual(travelPreviewKey(sources), travelPreviewKey([...sources, '/media/d/four.jpeg']));
	assert.equal(getTravelPreview(sources), undefined);
});
