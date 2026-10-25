import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { parseHTML } from 'linkedom';

test('ordinary builds expose both travel indexes without synthetic preview content', () => {
	for (const prefix of ['', 'en/']) {
		const html = readFileSync(resolve('dist', prefix, 'travel/index.html'), 'utf8');
		const { document } = parseHTML(html);
		assert.ok(document.querySelector('h1'));
		assert.equal(document.querySelector('.site-nav a.active')?.getAttribute('href'), `/${prefix}travel/`);
		assert.ok(!html.includes('Synthetic test content'));
		assert.equal(existsSync(resolve('dist', prefix, 'travel/sample-trip/index.html')), false);
	}
	assert.ok(!readFileSync('dist/sitemap-0.xml', 'utf8').includes('sample-trip'));
});

test('production output excludes the local admin and its UI bundle', () => {
	assert.equal(existsSync(resolve('dist/admin')), false);
	assert.equal(existsSync(resolve('dist/api/materials')), false);
	assert.ok(!readFileSync('dist/index.html', 'utf8').includes('mantine'));
});
