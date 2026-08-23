import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverWebmentionEndpoint, escapeHtml, hasExactLink, parseSource } from './html.js';

test('parses a reply h-entry and its author', () => {
	const html = `<article class="h-entry"><a class="p-author h-card" href="https://alice.example/"><span class="p-name">Alice</span></a><h1 class="p-name">Reply</h1><time class="dt-published" datetime="2026-08-23T10:00:00Z"></time><div class="e-content">Hello</div><a class="u-in-reply-to" href="https://dskr.dev/blog/post/"></a></article>`;
	const parsed = parseSource(html, 'https://alice.example/reply/', 'https://dskr.dev/blog/post/');
	assert.equal(parsed.property, 'in-reply-to');
	assert.equal(parsed.authorName, 'Alice');
	assert.equal(parsed.contentText, 'Hello');
});

test('recognizes exact target links and rejects near matches', () => {
	assert.equal(hasExactLink('<a href="https://dskr.dev/post/">link</a>', 'https://alice.example/reply/', 'https://dskr.dev/post/'), true);
	assert.equal(hasExactLink('<a href="https://dskr.dev/post/2">link</a>', 'https://alice.example/reply/', 'https://dskr.dev/post/'), false);
});

test('prefers an HTTP Link webmention endpoint', () => {
	const html = '<link rel="webmention" href="https://html.example/webmention">';
	assert.equal(discoverWebmentionEndpoint(html, 'https://target.example/post/', '<https://header.example/webmention>; rel="webmention"'), 'https://header.example/webmention');
});

test('escapes untrusted content before rendering', () => {
	assert.equal(escapeHtml(`<script>alert('x')</script>`), '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
});
