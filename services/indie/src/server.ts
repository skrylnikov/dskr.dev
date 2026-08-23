import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import { discoverWebmentionEndpoint, escapeHtml, hasExactLink, parseSource } from './html.js';
import { Store, type Note, type NoteKind } from './storage.js';

const siteUrl = new URL(process.env.SITE_URL ?? 'https://dskr.dev').origin;
const port = Number(process.env.PORT ?? 4322);
const cookieSecret = required('COOKIE_SECRET');
const tokenSecret = required('TOKEN_SECRET');
const indieauthPassword = required('INDIEAUTH_PASSWORD');
const store = new Store();
const app = Fastify({ logger: true, bodyLimit: 64 * 1024 });

await app.register(cookie, { secret: cookieSecret });
await app.register(formbody);

const ownerUrl = `${siteUrl}/`;
const absolute = (path: string) => new URL(path, `${siteUrl}/`).toString();
const noteUrl = (id: string) => absolute(`/notes/${id}/`);
const now = () => new Date();

app.get('/healthz', async () => ({ status: 'ok' }));
app.get('/readyz', async (_request, reply) => {
		try {
			await store.pool.query('select 1');
			return { status: 'ready' };
		} catch {
			return reply.code(503).send({ status: 'not_ready' });
		}
});

app.get('/auth/metadata', async () => ({
		issuer: ownerUrl,
		authorization_endpoint: absolute('/auth'),
		token_endpoint: absolute('/auth/token'),
		code_challenge_methods_supported: ['S256'],
		scopes_supported: ['create', 'update', 'delete'],
}));

app.get('/auth', async (request, reply) => {
	const query = request.query as Record<string, string | undefined>;
	const params = authParams(query);
	if (!params.valid) return reply.code(400).type('text/plain').send(params.error);
	return reply.type('text/html').send(authPage(params.value));
});

app.post('/auth/approve', async (request, reply) => {
	const body = asRecord(request.body);
	const params = authParams(body);
	if (!params.valid) return reply.code(400).type('text/plain').send(params.error);
	const session = await hasSession(request);
	if (!session && !passwordMatches(String(body.password ?? ''))) {
		return reply.code(401).type('text/html').send(authPage(params.value, 'Неверный пароль'));
	}

	const code = randomToken();
	await store.createCode(hash(code, tokenSecret), params.value.clientId, params.value.redirectUri, params.value.scope);
	const redirect = new URL(params.value.redirectUri);
	redirect.searchParams.set('code', code);
	redirect.searchParams.set('state', params.value.state);
	return reply.redirect(redirect.toString(), 302);
});

app.post('/auth/token', async (request, reply) => {
	const body = asRecord(request.body);
	if (body.grant_type !== 'authorization_code' || typeof body.code !== 'string' || typeof body.client_id !== 'string' || typeof body.redirect_uri !== 'string') {
		return reply.code(400).send({ error: 'invalid_request' });
	}
	const code = await store.redeemCode(hash(body.code, tokenSecret), body.client_id, body.redirect_uri);
	if (!code) return reply.code(400).send({ error: 'invalid_grant' });
	const accessToken = randomToken();
	await store.createToken(hash(accessToken, tokenSecret), code.client_id, code.scope);
	return {
		access_token: accessToken,
		token_type: 'Bearer',
		me: ownerUrl,
		scope: code.scope,
		expires_in: 60 * 60 * 24 * 30,
	};
});

app.post('/auth/session', async (request, reply) => {
	const body = asRecord(request.body);
	const type = String(body.type ?? 'note');
	const target = String(body.target ?? '');
	if (!passwordMatches(String(body.password ?? ''))) return reply.code(401).type('text/html').send(loginPage(type, target, 'Неверный пароль'));
	const session = randomToken();
	await store.createSession(hash(session, cookieSecret));
	const next = new URLSearchParams({ type });
	if (target) next.set('target', target);
	return reply.setCookie('indie_session', session, {
		signed: true,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 30,
	}).redirect(`/notes/new?${next.toString()}`, 303);
});

app.get('/micropub', async (request, reply) => {
	const query = request.query as Record<string, string | undefined>;
	if (query.q === 'config') return micropubConfig();
	if (query.q === 'source') {
		const token = await bearerToken(request, undefined);
		if (!token) return reply.code(401).send({ error: 'unauthorized' });
		const note = await noteFromUrl(query.url);
		if (!note) return reply.code(404).send({ error: 'not_found' });
		return noteToJf2(note);
	}
	return reply.code(400).send({ error: 'invalid_request' });
});

app.post('/micropub', async (request, reply) => {
	const body = asRecord(request.body);
	const token = await bearerToken(request, body.access_token);
	if (!token) return reply.code(401).send({ error: 'unauthorized' });
	const scope = String(token.scope).split(/\s+/);
	const action = String(body.action ?? 'create');

	if (action === 'delete') {
		if (!scope.includes('delete')) return reply.code(403).send({ error: 'insufficient_scope' });
		const note = await noteFromUrl(String(body.url ?? ''));
		if (!note) return reply.code(404).send({ error: 'not_found' });
		await store.deleteNote(note.id);
		return reply.code(204).send();
	}

	if (action === 'update') {
		if (!scope.includes('update')) return reply.code(403).send({ error: 'insufficient_scope' });
		const note = await noteFromUrl(String(body.url ?? ''));
		const content = contentFrom(body);
		if (!note || content === undefined) return reply.code(400).send({ error: 'invalid_request' });
		const updated = await store.updateNote(note.id, content);
		if (!updated) return reply.code(404).send({ error: 'not_found' });
		await enqueueTargets(updated);
		return reply.code(200).send(noteToJf2(updated));
	}

	if (!scope.includes('create')) return reply.code(403).send({ error: 'insufficient_scope' });
	const input = parseCreate(body);
	if (!input.valid) return reply.code(400).send({ error: 'invalid_request', error_description: input.error });
	const note = await publishNote(input.value);
	await enqueueTargets(note);
	return reply.code(201).header('Location', noteUrl(note.id)).send();
});

app.get('/notes/new', async (request, reply) => {
	const query = request.query as Record<string, string | undefined>;
	if (!(await hasSession(request))) return reply.type('text/html').send(loginPage(query.type, query.target));
	return reply.type('text/html').send(composePage(query.type, query.target));
});

app.post('/notes/new', async (request, reply) => {
	if (!(await hasSession(request))) return reply.code(401).type('text/plain').send('Войдите снова');
	const body = asRecord(request.body);
	const input = parseCreate(body);
	if (!input.valid) return reply.code(400).type('text/html').send(composePage(String(body.kind), String(body.target ?? ''), input.error));
	const note = await publishNote(input.value);
	await enqueueTargets(note);
	return reply.redirect(noteUrl(note.id), 303);
});

app.get('/notes/:id/', async (request, reply) => {
	const { id } = request.params as { id: string };
	const note = await store.getNote(id);
	if (!note || note.deletedAt) return reply.code(404).type('text/plain').send('Not found');
	return reply.type('text/html').send(renderNote(note));
});

app.post('/webmention', async (request, reply) => {
	const body = asRecord(request.body);
	const source = urlValue(body.source);
	const target = urlValue(body.target);
	if (!source || !target || source === target || !isOwnedTarget(target)) return reply.code(400).send({ error: 'invalid_request' });
	const mention = await store.upsertWebmention({ sourceUrl: source, targetUrl: target, property: 'mention-of' });
	void verifyIncoming(mention.id, source, target);
	return reply.code(202).send({ status: 'queued' });
});

app.get('/api/interactions', async (request, reply) => {
	const query = request.query as Record<string, string | undefined>;
	const target = query.target ? urlValue(query.target) : undefined;
	if (query.target && !target) return reply.code(400).send({ error: 'invalid_target' });
	const children = await store.listWebmentions(target);
	return { type: 'feed', name: 'Webmentions', children: children.map((item) => ({
		type: 'entry',
		url: item.sourceUrl,
		name: item.sourceName,
		published: item.publishedAt?.toISOString(),
		author: { type: 'card', name: item.authorName ?? 'Webmention', url: item.authorUrl, photo: item.authorPhoto },
		content: { text: item.contentText ?? '' },
		'wm-property': item.property,
		'wm-received': item.receivedAt.toISOString(),
	})) };
});

app.get('/inbox', async (request, reply) => {
	const query = request.query as Record<string, string | undefined>;
	const mentions = await store.listWebmentions(query.target ? urlValue(query.target) : undefined);
	const items = mentions.map((item) => `<li><strong>${escapeHtml(item.property)}</strong> · <a href="${escapeHtml(item.sourceUrl)}">${escapeHtml(item.sourceName ?? item.sourceUrl)}</a><p>${escapeHtml(item.contentText ?? '')}</p></li>`).join('');
	return reply.type('text/html').send(page('Inbox', `<main><h1>Inbox</h1><ul>${items || '<li>Пока пусто.</li>'}</ul></main>`));
});

const server = await app.listen({ host: '0.0.0.0', port });
app.log.info(`IndieWeb backend listening at ${server}`);
setInterval(() => void processDeliveries(), 60_000).unref();
void processDeliveries();

async function publishNote(input: { kind: NoteKind; content: string; targetUrl?: string }): Promise<Note> {
	const note: Note = { id: crypto.randomUUID(), ...input, createdAt: now(), updatedAt: now() };
	return store.createNote(note);
}

async function enqueueTargets(note: Note) {
	const targets = new Set<string>();
	if (note.targetUrl) targets.add(note.targetUrl);
	for (const match of note.content.matchAll(/https?:\/\/[^\s<>"']+/g)) targets.add(match[0].replace(/[).,;!?]+$/, ''));
	for (const target of targets) await store.enqueueDelivery(note.id, target);
	void processDeliveries();
}

async function processDeliveries() {
	try {
		for (const delivery of await store.pendingDeliveries()) {
			const note = await store.getNote(delivery.note_id);
			if (!note || note.deletedAt) {
				await store.markDelivery(delivery.id, { status: 'skipped' });
				continue;
			}
			try {
				const targetResponse = await fetchWithTimeout(delivery.target_url);
				const endpoint = discoverWebmentionEndpoint(await limitedText(targetResponse), delivery.target_url, targetResponse.headers.get('link'));
				if (!endpoint) {
					await store.markDelivery(delivery.id, { status: 'skipped' });
					continue;
				}
				const response = await fetchWithTimeout(endpoint, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ source: noteUrl(note.id), target: delivery.target_url }) });
				await store.markDelivery(delivery.id, { status: response.ok ? 'sent' : 'failed', endpointUrl: endpoint, response: response.status, error: response.ok ? undefined : `HTTP ${response.status}` });
			} catch (error) {
				await store.markDelivery(delivery.id, { status: 'failed', error: error instanceof Error ? error.message : String(error) });
			}
		}
	} catch (error) {
		app.log.warn({ err: error }, 'Webmention delivery queue unavailable');
	}
}

async function verifyIncoming(id: number, source: string, target: string) {
	try {
		const response = await fetchWithTimeout(source);
		if (response.status === 410) {
			await store.upsertWebmention({ sourceUrl: source, targetUrl: target, property: 'mention-of', status: 'deleted' });
			return;
		}
		if (!response.ok) return;
		const html = await limitedText(response);
		if (!hasExactLink(html, source, target)) {
			await store.upsertWebmention({ sourceUrl: source, targetUrl: target, property: 'mention-of', status: 'rejected' });
			return;
		}
		const parsed = parseSource(html, source, target);
		await store.upsertWebmention({ sourceUrl: source, targetUrl: target, ...parsed, status: 'verified' });
	} catch (error) {
		app.log.warn({ err: error, id }, 'Webmention verification failed');
	}
}

async function fetchWithTimeout(input: string, init?: RequestInit) {
	await assertPublicUrl(input);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5_000);
	try {
		return await fetch(input, { ...init, redirect: 'follow', signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml', ...(init?.headers ?? {}) } });
	} finally {
		clearTimeout(timer);
	}
}

async function assertPublicUrl(input: string) {
	const url = new URL(input);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported URL scheme');
	const host = url.hostname.toLowerCase();
	if (host === 'localhost' || host.endsWith('.local')) throw new Error('private URL is not fetchable');
	const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
	if (addresses.some(({ address }) => isPrivateIp(address))) throw new Error('private URL is not fetchable');
}

function isPrivateIp(value: string) {
	if (net.isIP(value) === 4) {
		const octets = value.split('.').map(Number);
		return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] === 169 && octets[1] === 254 ||
			octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
	}
	const normalized = value.toLowerCase();
	return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('::ffff:127.');
}

async function limitedText(response: Response) {
	const contentLength = Number(response.headers.get('content-length') ?? 0);
	if (contentLength > 1_000_000) throw new Error('response is too large');
	const body = await response.text();
	if (body.length > 1_000_000) throw new Error('response is too large');
	return body;
}

async function bearerToken(request: { headers: Record<string, string | string[] | undefined> }, body: unknown) {
	const header = request.headers.authorization;
	const bearer = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : undefined;
	const token = bearer ?? (typeof body === 'string' ? body : undefined);
	if (!token) return undefined;
	return store.verifyToken(hash(token, tokenSecret));
}

async function hasSession(request: { cookies: Record<string, string | undefined>; unsignCookie(value: string): { valid: boolean; value?: string | null } }) {
	const raw = request.cookies.indie_session;
	if (!raw) return false;
	const signed = request.unsignCookie(raw);
	return signed.valid && !!signed.value && store.verifySession(hash(signed.value, cookieSecret));
}

function parseCreate(body: Record<string, unknown>): { valid: true; value: { kind: NoteKind; content: string; targetUrl?: string } } | { valid: false; error: string } {
	const properties = asRecord(body.properties);
	const replyTarget = urlValue(first(body['in-reply-to']) ?? first(properties['in-reply-to']));
	const likeTarget = urlValue(first(body['like-of']) ?? first(properties['like-of']));
	const explicitTarget = urlValue(body.target ?? body['in-reply-to'] ?? body['like-of']);
	const target = replyTarget ?? likeTarget ?? explicitTarget;
	const propertyKind = replyTarget ? 'reply' : likeTarget ? 'like' : body.kind;
	const kind: NoteKind = propertyKind === 'reply' || propertyKind === 'like' || propertyKind === 'note' ? propertyKind : 'note';
	const content = contentFrom(body) ?? '';
	if (kind === 'reply' && !target) return { valid: false, error: 'reply requires a target URL' };
	if (kind === 'like' && !target) return { valid: false, error: 'like requires a target URL' };
	if (kind !== 'like' && !content.trim()) return { valid: false, error: 'content is required' };
	if (content.length > 20_000) return { valid: false, error: 'content is too long' };
	return { valid: true, value: { kind, content, targetUrl: target } };
}

function contentFrom(body: Record<string, unknown>) {
	const properties = asRecord(body.properties);
	const value = first(body.content) ?? first(properties.content);
	return value === undefined ? undefined : String(value).slice(0, 20_000);
}

function first(value: unknown) {
	return Array.isArray(value) ? value[0] : value;
}

async function noteFromUrl(value: string | undefined) {
	if (!value) return undefined;
	try {
		const url = new URL(value);
		if (url.origin !== siteUrl) return undefined;
		const match = url.pathname.match(/^\/notes\/([0-9a-f-]+)\/?$/i);
		return match ? store.getNote(match[1]) : undefined;
	} catch {
		return undefined;
	}
}

function urlValue(value: unknown) {
	if (typeof value !== 'string') return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
	} catch {
		return undefined;
	}
}

function isOwnedTarget(value: string) {
	try {
		return new URL(value).origin === siteUrl;
	} catch {
		return false;
	}
}

function noteToJf2(note: Note) {
	return {
		type: 'entry',
		id: noteUrl(note.id),
		url: noteUrl(note.id),
		name: noteTitle(note),
		content: { text: note.content },
		published: note.createdAt.toISOString(),
		updated: note.updatedAt.toISOString(),
		author: { type: 'card', name: 'Dmitriy Skrylnikov', url: ownerUrl },
		...(note.targetUrl && note.kind === 'reply' ? { 'in-reply-to': [note.targetUrl] } : {}),
		...(note.targetUrl && note.kind === 'like' ? { 'like-of': [note.targetUrl] } : {}),
	};
}

function renderNote(note: Note) {
	const target = note.targetUrl ? `<p>${note.kind === 'reply' ? 'Reply to' : 'Like of'} <a class="${note.kind === 'reply' ? 'u-in-reply-to' : 'u-like-of'}" href="${escapeHtml(note.targetUrl)}">${escapeHtml(note.targetUrl)}</a></p>` : '';
	const content = note.content ? `<div class="e-content">${escapeHtml(note.content).replace(/(https?:\/\/[^\s&lt;&gt;]+)/g, '<a href="$1">$1</a>')}</div>` : '';
	return page(noteTitle(note), `<main><article class="h-entry"><header><p class="p-author h-card"><a class="p-name u-url" href="${ownerUrl}">Dmitriy Skrylnikov</a></p><h1 class="p-name">${escapeHtml(noteTitle(note))}</h1><a class="u-url u-uid" href="${noteUrl(note.id)}"><time class="dt-published" datetime="${note.createdAt.toISOString()}">${note.createdAt.toISOString()}</time></a></header>${content}${target}</article></main>`);
}

function authParams(input: Record<string, unknown>) {
	const clientId = String(input.client_id ?? '');
	const redirectUri = String(input.redirect_uri ?? '');
	const responseType = String(input.response_type ?? 'code');
	const me = String(input.me ?? ownerUrl);
	const state = String(input.state ?? '');
	const scope = String(input.scope ?? 'create').split(/\s+/).filter((item) => ['create', 'update', 'delete'].includes(item)).join(' ') || 'create';
	try {
		const client = new URL(clientId);
		const redirect = new URL(redirectUri);
		if (responseType !== 'code' || new URL(me).origin !== siteUrl || !state || client.protocol !== 'https:' || redirect.protocol !== 'https:' || redirect.origin !== client.origin) throw new Error('invalid OAuth request');
		return { valid: true as const, value: { clientId, redirectUri, state, scope } };
	} catch {
		return { valid: false as const, error: 'invalid OAuth request' };
	}
}

function micropubConfig() {
	return { 'media-endpoint': null, 'post-types': [{ type: 'note' }, { type: 'reply' }, { type: 'like' }] };
}

function noteTitle(note: Note) {
	return note.kind === 'reply' ? 'Reply' : note.kind === 'like' ? 'Like' : note.content.split(/\r?\n/, 1)[0].slice(0, 80) || 'Note';
}

function authPage(params: { clientId: string; redirectUri: string; state: string; scope: string }, error?: string) {
	return page('Authorize', `<main><h1>Authorize dskr.dev</h1>${error ? `<p>${escapeHtml(error)}</p>` : ''}<p>${escapeHtml(params.clientId)} requests: ${escapeHtml(params.scope)}</p><form method="post" action="/auth/approve"><input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}"><input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}"><input type="hidden" name="state" value="${escapeHtml(params.state)}"><input type="hidden" name="scope" value="${escapeHtml(params.scope)}"><label>Password <input type="password" name="password" autocomplete="current-password"></label><button>Allow</button></form></main>`);
}

function loginPage(type = 'note', target = '', error = '') {
	return page('Sign in', `<main><h1>Sign in</h1>${error ? `<p>${escapeHtml(error)}</p>` : ''}<form method="post" action="/auth/session"><input type="hidden" name="type" value="${escapeHtml(type)}"><input type="hidden" name="target" value="${escapeHtml(target)}"><label>Password <input type="password" name="password" autocomplete="current-password"></label><button>Sign in</button></form></main>`);
}

function composePage(kind = 'note', target = '', error = '') {
	return page('New note', `<main><h1>New note</h1>${error ? `<p>${escapeHtml(error)}</p>` : ''}<form method="post" action="/notes/new"><label>Type <select name="kind"><option value="note" ${kind === 'note' ? 'selected' : ''}>Note</option><option value="reply" ${kind === 'reply' ? 'selected' : ''}>Reply</option><option value="like" ${kind === 'like' ? 'selected' : ''}>Like</option></select></label><label>Target URL <input type="url" name="target" value="${escapeHtml(target)}"></label><label>Content <textarea name="content" rows="8"></textarea></label><button>Publish</button></form></main>`);
}

function page(title: string, body: string) {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="webmention" href="${absolute('/webmention')}"><link rel="micropub" href="${absolute('/micropub')}"><title>${escapeHtml(title)} · dskr.dev</title><style>body{font:1rem/1.6 system-ui;max-width:48rem;margin:4rem auto;padding:0 1rem;color:#20211f;background:#f5f3ed}main{background:#fffdf8;padding:2rem;border:1px solid #deded7;border-radius:1rem}label{display:block;margin:1rem 0}input,textarea,select{display:block;width:100%;box-sizing:border-box;padding:.6rem;margin-top:.3rem}button{padding:.7rem 1rem}a{color:#087f5b}</style></head><body>${body}</body></html>`;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function passwordMatches(value: string) {
	const expected = crypto.createHash('sha256').update(indieauthPassword).digest();
	const actual = crypto.createHash('sha256').update(value).digest();
	return crypto.timingSafeEqual(expected, actual);
}

function randomToken() {
	return crypto.randomBytes(32).toString('base64url');
}

function hash(value: string, secret: string) {
	return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function required(name: string) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

process.on('SIGTERM', async () => {
	await app.close();
	await store.close();
	process.exit(0);
});
