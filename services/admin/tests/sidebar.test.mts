import assert from 'node:assert/strict';
import test from 'node:test';
import type { Material } from '../store.ts';
import { sortTravelMaterials } from '../ui/client.ts';

const trip = (
	slug: string,
	startDate: string,
	locale: 'ru' | 'en' = 'ru',
): Material => ({
	id: `trip/${locale}/${slug}`,
	type: 'trip',
	locale,
	slug,
	version: '',
	metadata: { startDate, draft: true },
});
const entry = (
	slug: string,
	parent: string,
	order: number,
	kind: 'chapter' | 'note' = 'chapter',
	locale: 'ru' | 'en' = 'ru',
): Material => ({
	id: `entry/${locale}/${parent}/${slug}`,
	type: 'entry',
	locale,
	slug,
	trip: parent,
	version: '',
	metadata: { order, kind, draft: true },
});

test('sidebar groups trips by start date and mixes chapters and notes by configured order', () => {
	const materials = [
		trip('old', '2025-01-01'),
		entry('alphabetically-first', 'new', 2),
		entry('old-entry', 'old', 0),
		trip('new', '2026-10-25'),
		entry('note', 'new', 1, 'note'),
		entry('walk', 'new', 0),
		trip('new', '2026-10-25', 'en'),
		entry('translation', 'new', 0, 'chapter', 'en'),
	];
	const before = [...materials];
	const ordered = sortTravelMaterials(materials).filter(
		(material) => material.locale === 'ru',
	);
	assert.deepEqual(
		ordered.map((material) => material.id),
		[
			'trip/ru/new',
			'entry/ru/new/walk',
			'entry/ru/new/note',
			'entry/ru/new/alphabetically-first',
			'trip/ru/old',
			'entry/ru/old/old-entry',
		],
	);
	assert.deepEqual(materials, before);
	const updated = materials.map((material) =>
		material.slug === 'walk'
			? { ...material, metadata: { ...material.metadata, order: 3 } }
			: material,
	);
	assert.deepEqual(
		sortTravelMaterials(updated)
			.filter(
				(material) =>
					material.type === 'entry' &&
					material.trip === 'new' &&
					material.locale === 'ru',
			)
			.map((material) => material.slug),
		['note', 'alphabetically-first', 'walk'],
	);
});

test('search retains configured order and entries without a parent stay visible', () => {
	const materials = [
		trip('trip', '2026-10-25'),
		entry('chapter-a', 'trip', 2),
		entry('chapter-z', 'trip', 0),
		entry('orphan', 'missing', 1),
	];
	const ordered = sortTravelMaterials(materials);
	assert.deepEqual(
		ordered
			.filter((material) => material.slug.startsWith('chapter'))
			.map((material) => material.slug),
		['chapter-z', 'chapter-a'],
	);
	assert.equal(ordered.at(-1)?.slug, 'orphan');
});
