import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseHTML } from 'linkedom';

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');

const RU_DESCRIPTION = 'Фотоальбомы с авторскими подборками снимков из поездок, прогулок и городских событий.';
const EN_DESCRIPTION = 'Curated photo albums featuring images from trips, walks, and city events.';

const PROJECT_SLUGS = ['dskr-photos', 'dskr-dev', 'phoronis'] as const;

const HOME_ROUTES = [
	{ route: '.', projectsPrefix: '/projects/' },
	{ route: 'en', projectsPrefix: '/en/projects/' },
] as const;

const PROJECTS_ROUTES = ['projects', 'en/projects'] as const;

type ParsedDocument = ReturnType<typeof parseHTML>['document'];

function loadPage(route: string): ParsedDocument {
	const file = join(distDir, route, 'index.html');
	return parseHTML(readFileSync(file, 'utf8')).document;
}

function builtCssRules(): Array<{ selector: string; body: string }> {
	const css = readdirSync(join(distDir, '_astro'))
		.filter((file) => file.endsWith('.css'))
		.map((file) => readFileSync(join(distDir, '_astro', file), 'utf8'))
		.join('\n');
	return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
		.map((match) => ({ selector: match[1].replace(/\s+/g, ' ').trim(), body: match[2] }))
		.filter((rule) => !rule.selector.startsWith('@'));
}

function requireCssRule(rules: Array<{ selector: string; body: string }>, selector: string): string {
	const covered = rules.filter((rule) => rule.selector.split(',').map((part) => part.trim()).includes(selector));
	assert.equal(covered.length, 1, `expected exactly one CSS rule for ${selector}, found ${covered.length}`);
	return covered[0].body;
}

function requireOne<T>(elements: { length: number; [index: number]: T }, description: string): T {
	assert.equal(elements.length, 1, `expected exactly one ${description}, found ${elements.length}`);
	return elements[0];
}

function assertPreview(document: ParsedDocument, projectsPrefix: string, description: string): void {
	const link = requireOne(
		document.querySelectorAll(`a[href="${projectsPrefix}#dskr-photos"]`),
		'dskr-photos preview link',
	);
	assert.match(link.textContent ?? '', /dskr\.photos/);
	const previewText = link.closest('li')?.textContent ?? '';
	assert.ok(previewText.includes(description), 'preview must contain the locale description');
}

function assertCardLinks(card: Element): void {
	const source = requireOne(
		card.querySelectorAll('a[href="https://github.com/skrylnikov/photo-lib"]'),
		'dskr-photos source link',
	);
	assert.equal(source.getAttribute('target'), '_blank');
	assert.equal(source.getAttribute('rel'), 'noreferrer');
	const live = requireOne(card.querySelectorAll('a[href="https://dskr.photos"]'), 'dskr-photos live link');
	assert.equal(live.getAttribute('target'), '_blank');
	assert.equal(live.getAttribute('rel'), 'noreferrer');
}

function assertDskrPhotosCard(document: ParsedDocument, description: string): void {
	const card = requireOne(document.querySelectorAll('article#dskr-photos'), 'dskr-photos card');
	assert.equal(card.querySelector('.eyebrow')?.textContent?.trim(), 'PERSONAL SITE');
	assert.equal(card.querySelector('h2')?.textContent?.trim(), 'dskr.photos');
	assert.equal(card.querySelector('.project-description')?.textContent?.trim(), description);
	const image = requireOne(card.querySelectorAll('img[src="/assets/dskr-photos.png"]'), 'dskr-photos image');
	assert.equal(image.getAttribute('alt'), '');
	assert.deepEqual(
		[...card.querySelectorAll('.stack-list li')].map((item) => item.textContent?.trim()),
		['React', 'TypeScript', 'Vite', 'Fastify', 'SQLite'],
	);
	assertCardLinks(card);
}

test('Russian home renders the dskr.photos preview and exact fragment link', () => {
	assertPreview(loadPage('.'), '/projects/', RU_DESCRIPTION);
});

test('English home renders only the English dskr.photos preview and exact fragment link', () => {
	const document = loadPage('en');
	assertPreview(document, '/en/projects/', EN_DESCRIPTION);
	assert.equal(
		document.body.textContent?.includes(RU_DESCRIPTION),
		false,
		'English home must not contain the Russian description',
	);
});

test('Russian projects renders the complete dskr.photos card', () => {
	assertDskrPhotosCard(loadPage('projects'), RU_DESCRIPTION);
});

test('English projects renders the complete English dskr.photos card', () => {
	const document = loadPage('en/projects');
	assertDskrPhotosCard(document, EN_DESCRIPTION);
	assert.equal(
		document.body.textContent?.includes(RU_DESCRIPTION),
		false,
		'English projects must not contain the Russian description',
	);
});

test('the dskr.photos card shows the full uncropped screenshot', () => {
	const rules = builtCssRules();
	const dskrPhotos = requireCssRule(rules, '.project-card--dskr-photos .project-visual>img');
	assert.ok(dskrPhotos.includes('object-fit:contain'), 'dskr.photos screenshot must be contained, not cropped');
	assert.ok(dskrPhotos.includes('object-position:center'), 'dskr.photos screenshot must be centered');
	const phoronis = requireCssRule(rules, '.project-card--phoronis .project-visual>img');
	assert.ok(phoronis.includes('object-fit:contain'), 'existing Phoronis presentation must be preserved');
	const coverRules = rules
		.filter((rule) => rule.selector.split(',').map((part) => part.trim()).includes('.project-visual>img'))
		.filter((rule) => rule.body.includes('object-fit'));
	assert.equal(coverRules.length, 1, 'expected exactly one base object-fit rule for project visuals');
	assert.ok(coverRules[0].body.includes('object-fit:cover'), 'existing base card presentation must be preserved');
});

test('existing project previews and cards remain on their route-specific surfaces', () => {
	for (const { route, projectsPrefix } of HOME_ROUTES) {
		const home = loadPage(route);
		for (const slug of PROJECT_SLUGS) {
			assert.equal(
				home.querySelectorAll(`a[href="${projectsPrefix}#${slug}"]`).length,
				1,
				`home ${route} must link exactly once to the ${slug} card fragment`,
			);
		}
	}
	for (const route of PROJECTS_ROUTES) {
		const page = loadPage(route);
		for (const slug of PROJECT_SLUGS) {
			assert.equal(
				page.querySelectorAll(`article#${slug}`).length,
				1,
				`projects page ${route} must contain exactly one ${slug} card`,
			);
		}
	}
});
