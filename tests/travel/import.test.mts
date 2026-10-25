import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { importTelegram, telegramText, parseTelegramHtml, readTelegramExport } from '../../scripts/travel-import.mts';

test('Telegram formatting is preserved without executable MDX or unsafe links', () => {
	const text = telegramText({ text_entities: [{ type: 'bold', text: 'Жирный' }, ' <script>{danger()} & x', { type: 'text_link', text: 'bad', href: 'javascript:alert(1)' }, { type: 'text_link', text: 'link', href: 'https://example.org/a(b)' }] });
	assert.match(text, /\*\*Жирный\*\*/);
	assert.ok(!text.includes('<script>')); assert.ok(!text.includes('{danger()}')); assert.ok(!text.includes('javascript:'));
	assert.match(text, /https:\/\/example.org\/a%28b%29/);
	assert.equal(telegramText({ text: 'import "node:fs"\nexport default 1' }), '&#105;mport "node:fs"  \n&#101;xport default 1');
});

const htmlMessage = (id: number, body: string, date = '20.10.2026 12:00:00 UTC+03:00') => `<div class="message default clearfix" id="message${id}"><div class="body"><div class="date" title="${date}">12:00</div>${body}</div></div>`;
test('HTML import preserves rich block order, original files, mixed collages and captions', () => {
	const html = htmlMessage(407, `<div class="text rich_message">
		<p class="rich_block rich_paragraph">Первый <strong>абзац</strong>.</p>
		<section class="rich_block rich_media_group"><div class="rich_collage_box">
		<figure class="rich_block rich_media_item"><a class="photo_wrap" href="photos/large%20photo.jpg"><img src="photos/thumb.jpg"></a><figcaption>Подпись кадра</figcaption></figure>
		<figure class="rich_block rich_media_item"><a class="media_video" href="video_files/clip.MOV"></a></figure>
		</div><figcaption>Название места</figcaption></section>
		<p class="rich_block rich_paragraph">Следующий абзац.</p></div>`);
	const [message] = parseTelegramHtml(html);
	assert.equal(message.id, 407); assert.equal(message.date, '2026-10-20');
	assert.deepEqual(message.blocks, [
		{ kind: 'text', mdx: 'Первый **абзац**.' }, { kind: 'break' },
		{ kind: 'media', mediaType: 'photo', file: 'photos/large photo.jpg', caption: 'Подпись кадра' },
		{ kind: 'media', mediaType: 'video', file: 'video_files/clip.MOV', caption: undefined },
		{ kind: 'break' }, { kind: 'text', mdx: 'Название места' }, { kind: 'text', mdx: 'Следующий абзац.' },
	]);
});
test('HTML text is not executed and native Russian dates and joined messages are supported', () => {
	const html = htmlMessage(1, '<a class="photo_wrap" href="photos/one.jpg"><img></a><div class="text">import "node:fs"<br>&lt;Component&gt;{danger()}<br><a href="javascript:alert(1)">unsafe</a><script>evil()</script></div>', '19 октября 2026, 12:00:00') + htmlMessage(2, '<div class="text">Continuation</div>').replace(/<div class="date".*?<\/div>/, '');
	const messages = parseTelegramHtml(html);
	assert.equal(messages[0].date, '2026-10-19'); assert.equal(messages[1].date, '2026-10-19');
	const text = messages[0].blocks!.filter((block) => block.kind === 'text').map((block) => block.mdx).join('');
	assert.match(text, /&#105;mport/); assert.ok(!text.includes('javascript:')); assert.ok(!text.includes('evil()')); assert.ok(!text.includes('{danger()}'));
	assert.throws(() => parseTelegramHtml('<p>Not an export</p>'), /No Telegram messages/);
	assert.throws(() => parseTelegramHtml(htmlMessage(1, '', 'unknown date')), /Unsupported HTML date/);
});
test('HTML pages are read numerically and duplicate messages or escaping pages are rejected', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'travel-html-pages-'));
	try {
		for (const [file, id] of [['messages.html', 1], ['messages2.html', 2], ['messages10.html', 10]] as const) await writeFile(join(dir, file), htmlMessage(id, '<div class="text">Post</div>'));
		assert.deepEqual((await readTelegramExport(join(dir, 'messages.html'))).map((message) => message.id), [1, 2, 10]);
		await writeFile(join(dir, 'messages3.html'), htmlMessage(2, '<div class="text">Duplicate</div>'));
		await assert.rejects(readTelegramExport(join(dir, 'messages.html')), /Duplicate HTML/);
		await rm(join(dir, 'messages3.html')); await symlink('/etc/hosts', join(dir, 'messages3.html'));
		await assert.rejects(readTelegramExport(join(dir, 'messages.html')), /escapes its folder/);
	} finally { await rm(dir, { recursive: true, force: true }); }
});
test('HTML to MDX import gives every rich attachment a stable id and preserves source boundaries', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'travel-html-import-'));
	const trip = `html-${Date.now()}`;
	try {
		await writeFile(join(dir, 'one.jpg'), 'first'); await writeFile(join(dir, 'two.jpg'), 'second');
		await writeFile(join(dir, 'messages.html'), htmlMessage(412, `<div class="text rich_message"><p class="rich_block rich_paragraph">Before</p><section class="rich_block rich_media_group"><div><figure class="rich_block rich_media_item"><a class="photo_wrap" href="one.jpg"></a><figcaption>One</figcaption></figure><figure class="rich_block rich_media_item"><a class="photo_wrap" href="two.jpg"></a></figure></div></section><p class="rich_block rich_paragraph">After</p></div>`));
		await writeFile(join(dir, 'mapping.json'), JSON.stringify({ trip, title: 'Trip', description: 'Description', destinations: ['City'], startDate: '2026-10-20', entries: [{ slug: 'chapter', kind: 'chapter', title: 'Chapter', description: 'Description', messageIds: [412] }] }));
		const report = await importTelegram(join(dir, 'messages.html'), join(dir, 'mapping.json'), join(dir, 'content'));
		assert.deepEqual(report.missing, []);
		const content = await readFile(join(dir, 'content/entries', trip, 'chapter.ru.mdx'), 'utf8');
		assert.ok(content.indexOf('Before') < content.indexOf('<MediaGallery')); assert.ok(content.indexOf('<MediaGallery') < content.indexOf('After'));
		const gallery = JSON.parse(await readFile(join('.state/travel/import', trip, `${trip}-chapter-1.json`), 'utf8'));
		assert.deepEqual(gallery.items.map((item: { id: string }) => item.id), ['message-412-1', 'message-412-2']);
		assert.equal(gallery.items[0].caption.ru, 'One');
	} finally { await rm(dir, { recursive: true, force: true }); await rm(join('.state/travel/import', trip), { recursive: true, force: true }); }
});
test('import reports missing/escaping files and preserves existing drafts on rerun', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'travel-import-'));
	const trip = `test-${Date.now()}`;
	try {
		await writeFile(join(dir, 'photo.jpg'), 'fixture');
		await symlink('/etc/hosts', join(dir, 'escape.jpg'));
		await writeFile(join(dir, 'result.json'), JSON.stringify({ messages: [
			{ id: 1, type: 'message', date: '2026-10-20T12:00:00', photo: 'photo.jpg', text: 'Первый пост' },
			{ id: 2, type: 'message', photo: 'missing.jpg', text: 'Второй пост' },
			{ id: 3, type: 'message', photo: 'escape.jpg', text: '' },
			{ id: 4, type: 'message', photo: 'photo.jpg', text: 'Последняя подпись' },
		] }));
		await writeFile(join(dir, 'mapping.json'), JSON.stringify({ trip, title: 'Trip', description: 'Description', destinations: ['City'], startDate: '2026-10-20', entries: [{ slug: 'evening', kind: 'note', messageIds: [3, 2, 1, 4, 99] }] }));
		const output = join(dir, 'content');
		const first = await importTelegram(join(dir, 'result.json'), join(dir, 'mapping.json'), output);
		assert.equal(first.missing.length, 3);
		const file = join(output, 'entries', trip, 'evening.ru.mdx');
		const content = await readFile(file, 'utf8');
		assert.ok(content.indexOf('Первый пост') < content.indexOf('Второй пост'));
		assert.ok(content.indexOf('Второй пост') < content.indexOf(`gallery="${trip}-evening-2"`));
		assert.match(content, /"draft": true/);
		await writeFile(file, content + '\nManual edit\n');
		const second = await importTelegram(join(dir, 'result.json'), join(dir, 'mapping.json'), output);
		assert.ok(second.skipped.includes(file));
		assert.match(await readFile(file, 'utf8'), /Manual edit/);
	} finally { await rm(dir, { recursive: true, force: true }); await rm(join('.state/travel/import', trip), { recursive: true, force: true }); }
});
