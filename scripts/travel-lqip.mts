import sharp from 'sharp';

export async function generateLqip(input: string | Buffer): Promise<string[]> {
	const pixels = await sharp(input, { limitInputPixels: 100_000_000 }).autoOrient().flatten({ background: '#fff' }).toColourspace('srgb').resize(3, 2, { fit: 'fill' }).raw().toBuffer();
	return Array.from({ length: 6 }, (_, index) => `#${pixels.subarray(index * 3, index * 3 + 3).toString('hex')}`);
}
