import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { projects, type Project } from './projects.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicDir = join(repoRoot, 'public');

const EXISTING_PROJECTS: Project[] = [
	{
		slug: 'dskr-dev',
		github: 'https://github.com/skrylnikov/dskr.dev',
		live: 'https://dskr.dev',
		stack: ['Astro', 'MDX', 'TypeScript', 'CSS'],
		ru: {
			title: 'dskr.dev',
			description: 'Личный блог о разработке, собственных проектах и вещах, которые интересно разбирать на практике.',
		},
		en: {
			title: 'dskr.dev',
			description: 'A personal blog about software development, side projects, and things worth understanding by building.',
		},
	},
	{
		slug: 'phoronis',
		github: 'https://github.com/skrylnikov/Phoronis-tg-bot',
		live: 'https://t.me/PhoronisBot',
		image: '/assets/telegram-bot-six-years/hero.png',
		stack: ['TypeScript', 'grammY', 'PostgreSQL', 'Prisma', 'OpenRouter', 'pgvector'],
		ru: {
			title: 'Phoronis / Ио',
			description: 'Telegram-бот с AI-возможностями, памятью, контекстом чата, обработкой изображений и голосовых сообщений.',
		},
		en: {
			title: 'Phoronis / Io',
			description: 'An AI-powered Telegram bot with chat context, memory, image and voice processing, and vector search.',
		},
	},
];

const DSKR_PHOTOS_ENTRY: Project = {
	slug: 'dskr-photos',
	github: 'https://github.com/skrylnikov/photo-lib',
	live: 'https://dskr.photos',
	image: '/assets/dskr-photos.png',
	stack: ['React', 'TypeScript', 'Vite', 'Fastify', 'SQLite'],
	ru: {
		title: 'dskr.photos',
		description: 'Фотоальбомы с авторскими подборками снимков из поездок, прогулок и городских событий.',
	},
	en: {
		title: 'dskr.photos',
		description: 'Curated photo albums featuring images from trips, walks, and city events.',
	},
};

const REQUIRED_CAPTURE = {
	width: 1440,
	height: 1000,
	byteLength: 1_537_484,
	sha256: '75f827b10c6aa888c38eb507d8f4a3e2367fb7982bef3d6c52c2dd539349ed04',
} as const;

interface PngExpectation {
	width: number;
	height: number;
	byteLength: number;
	sha256: string;
}

function requireDskrPhotosEntry(): Project {
	const entries = projects.filter((project) => project.slug === 'dskr-photos');
	assert.equal(entries.length, 1, 'expected exactly one dskr-photos entry');
	return entries[0];
}

function pngMetadata(bytes: Buffer): { width: number; height: number } {
	assert.ok(bytes.length >= 24, 'file is too short to contain a PNG IHDR header');
	assert.deepEqual(
		[...bytes.subarray(0, 8)],
		[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
		'file does not start with the PNG signature',
	);
	assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR', 'first chunk is not IHDR');
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function assertAssetIntegrity(baseDir: string, imageUrl: string, expected: PngExpectation): void {
	const imagePath = join(baseDir, imageUrl);
	assert.ok(existsSync(imagePath), `missing image file for ${imageUrl}`);
	const bytes = readFileSync(imagePath);
	assert.equal(
		bytes.length,
		expected.byteLength,
		`unexpected byte length for ${imageUrl}: got ${bytes.length}, expected ${expected.byteLength}`,
	);
	const { width, height } = pngMetadata(bytes);
	assert.equal(
		`${width}x${height}`,
		`${expected.width}x${expected.height}`,
		`unexpected dimensions for ${imageUrl}: got ${width}x${height}, expected ${expected.width}x${expected.height}`,
	);
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	assert.equal(
		sha256,
		expected.sha256,
		`unexpected SHA-256 for ${imageUrl}: got ${sha256}, expected ${expected.sha256}`,
	);
}

test('dskr.photos has the complete required catalog metadata', () => {
	const entry = requireDskrPhotosEntry();
	assert.equal(entry.github, 'https://github.com/skrylnikov/photo-lib');
	assert.equal(entry.live, 'https://dskr.photos');
	assert.equal(entry.image, '/assets/dskr-photos.png');
	assert.deepEqual(entry.stack, ['React', 'TypeScript', 'Vite', 'Fastify', 'SQLite']);
	assert.equal(entry.ru.title, 'dskr.photos');
	assert.equal(entry.ru.description, 'Фотоальбомы с авторскими подборками снимков из поездок, прогулок и городских событий.');
	assert.equal(entry.en.title, 'dskr.photos');
	assert.equal(entry.en.description, 'Curated photo albums featuring images from trips, walks, and city events.');
});

test('dskr.photos is appended after unchanged existing projects', () => {
	assert.deepEqual(projects, [...EXISTING_PROJECTS, DSKR_PHOTOS_ENTRY]);
});

test('dskr.photos image resolves to the exact supplied PNG', () => {
	const entry = requireDskrPhotosEntry();
	assertAssetIntegrity(publicDir, entry.image!, REQUIRED_CAPTURE);
});

test('dskr.photos asset validation rejects missing or altered captures with the path', () => {
	const entry = requireDskrPhotosEntry();
	const supplied = readFileSync(join(publicDir, entry.image!));
	const fixtureRoot = mkdtempSync(join(tmpdir(), 'dskr-photos-assets-'));
	try {
		const fixtures: Array<[name: string, prepare?: (file: string) => void]> = [
			['missing', undefined],
			['truncated', (file) => writeFileSync(file, supplied.subarray(0, 100))],
			['resized', (file) => {
				const bytes = Buffer.from(supplied);
				bytes.writeUInt32BE(999, 20);
				writeFileSync(file, bytes);
			}],
			['recompressed', (file) => {
				const bytes = Buffer.from(supplied);
				bytes[bytes.length - 1] ^= 0xff;
				writeFileSync(file, bytes);
			}],
		];
		for (const [name, prepare] of fixtures) {
			const dir = join(fixtureRoot, name);
			mkdirSync(dir);
			prepare?.(join(dir, 'dskr-photos.png'));
			assert.throws(
				() => assertAssetIntegrity(dir, entry.image!, REQUIRED_CAPTURE),
				/\/assets\/dskr-photos\.png/,
				`the ${name} fixture must be rejected with the affected image path`,
			);
		}
	} finally {
		rmSync(fixtureRoot, { recursive: true, force: true });
	}
});
