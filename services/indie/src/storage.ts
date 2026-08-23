import pg from 'pg';

const { Pool } = pg;

export type NoteKind = 'note' | 'reply' | 'like';

export type Note = {
	id: string;
	kind: NoteKind;
	content: string;
	targetUrl?: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date;
};

export type Webmention = {
	id: number;
	sourceUrl: string;
	targetUrl: string;
	property: 'mention-of' | 'in-reply-to' | 'like-of';
	status: string;
	authorName?: string;
	authorUrl?: string;
	authorPhoto?: string;
	sourceName?: string;
	contentText?: string;
	publishedAt?: Date;
	receivedAt: Date;
};

export class Store {
	readonly pool = new Pool({ connectionString: required('DATABASE_URL') });

	async close() {
		await this.pool.end();
	}

	async createNote(note: Note) {
		await this.pool.query(
			`insert into notes (id, kind, content, target_url, created_at, updated_at)
			 values ($1, $2, $3, $4, $5, $5)`,
			[note.id, note.kind, note.content, note.targetUrl ?? null, note.createdAt],
		);
		return note;
	}

	async getNote(id: string) {
		const result = await this.pool.query<NoteRow>(
			`select id, kind, content, target_url, created_at, updated_at, deleted_at
			 from notes where id = $1`,
			[id],
		);
		return result.rows[0] ? mapNote(result.rows[0]) : undefined;
	}

	async updateNote(id: string, content: string) {
		const result = await this.pool.query<NoteRow>(
			`update notes set content = $2, updated_at = now()
			 where id = $1 and deleted_at is null
			 returning id, kind, content, target_url, created_at, updated_at, deleted_at`,
			[id, content],
		);
		return result.rows[0] ? mapNote(result.rows[0]) : undefined;
	}

	async deleteNote(id: string) {
		await this.pool.query(`update notes set deleted_at = now(), updated_at = now() where id = $1`, [id]);
	}

	async listWebmentions(targetUrl?: string) {
		const result = await this.pool.query<WebmentionRow>(
			targetUrl
				? `select * from webmentions where target_url = $1 and status = 'verified' order by received_at desc`
				: `select * from webmentions where status = 'verified' order by received_at desc limit 100`,
			targetUrl ? [targetUrl] : [],
		);
		return result.rows.map(mapWebmention);
	}

	async enqueueDelivery(noteId: string, targetUrl: string) {
		await this.pool.query(
			`insert into deliveries (note_id, target_url, status, next_attempt_at)
			 values ($1, $2, 'pending', now()) on conflict (note_id, target_url) do nothing`,
			[noteId, targetUrl],
		);
	}

	async pendingDeliveries() {
		const result = await this.pool.query<DeliveryRow>(
			`select * from deliveries where status in ('pending', 'failed')
			 and next_attempt_at <= now() order by next_attempt_at asc limit 20`,
		);
		return result.rows;
	}

	async markDelivery(id: number, result: { status: 'sent' | 'failed' | 'skipped'; endpointUrl?: string; response?: number; error?: string }) {
		const nextAttempt = result.status === 'failed' ? new Date(Date.now() + 5 * 60_000) : new Date();
		await this.pool.query(
			`update deliveries set status = $2, endpoint_url = coalesce($3, endpoint_url),
			 attempts = attempts + 1, last_response = $4, last_error = $5, next_attempt_at = $6
			 where id = $1`,
			[id, result.status, result.endpointUrl ?? null, result.response ?? null, result.error ?? null, nextAttempt],
		);
	}

	async upsertWebmention(input: Omit<Webmention, 'id' | 'receivedAt' | 'status'> & { status?: string }) {
		const result = await this.pool.query<WebmentionRow>(
			`insert into webmentions
			 (source_url, target_url, property, status, author_name, author_url, author_photo,
			  source_name, content_text, published_at, received_at)
			 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
			 on conflict (source_url, target_url) do update set
			 property = excluded.property, status = excluded.status, author_name = excluded.author_name,
			 author_url = excluded.author_url, author_photo = excluded.author_photo,
			 source_name = excluded.source_name, content_text = excluded.content_text,
			 published_at = excluded.published_at, received_at = now(), verified_at =
			 case when excluded.status = 'verified' then now() else webmentions.verified_at end
			 returning *`,
			[input.sourceUrl, input.targetUrl, input.property, input.status ?? 'pending', input.authorName ?? null,
				input.authorUrl ?? null, input.authorPhoto ?? null, input.sourceName ?? null, input.contentText ?? null,
				input.publishedAt ?? null],
		);
		return mapWebmention(result.rows[0]);
	}

	async createCode(codeHash: string, clientId: string, redirectUri: string, scope: string) {
		await this.pool.query(
			`insert into auth_codes (code_hash, client_id, redirect_uri, scope, expires_at)
			 values ($1, $2, $3, $4, now() + interval '10 minutes')`,
			[codeHash, clientId, redirectUri, scope],
		);
	}

	async redeemCode(codeHash: string, clientId: string, redirectUri: string) {
		const client = await this.pool.connect();
		try {
			await client.query('begin');
			const result = await client.query<AuthCodeRow>(
				`select * from auth_codes where code_hash = $1 and used_at is null and expires_at > now() for update`,
				[codeHash],
			);
			const code = result.rows[0];
			if (!code || code.client_id !== clientId || code.redirect_uri !== redirectUri) {
				await client.query('rollback');
				return undefined;
			}
			await client.query(`update auth_codes set used_at = now() where code_hash = $1`, [codeHash]);
			await client.query('commit');
			return code;
		} catch (error) {
			await client.query('rollback');
			throw error;
		} finally {
			client.release();
		}
	}

	async createToken(tokenHash: string, clientId: string, scope: string) {
		await this.pool.query(
			`insert into access_tokens (token_hash, client_id, scope, expires_at)
			 values ($1, $2, $3, now() + interval '30 days')`,
			[tokenHash, clientId, scope],
		);
	}

	async verifyToken(tokenHash: string) {
		const result = await this.pool.query<TokenRow>(
			`select * from access_tokens where token_hash = $1 and revoked_at is null and expires_at > now()`,
			[tokenHash],
		);
		return result.rows[0];
	}

	async createSession(sessionHash: string) {
		await this.pool.query(`insert into sessions (session_hash, expires_at) values ($1, now() + interval '30 days')`, [sessionHash]);
	}

	async verifySession(sessionHash: string) {
		const result = await this.pool.query(`select 1 from sessions where session_hash = $1 and expires_at > now()`, [sessionHash]);
		return result.rowCount === 1;
	}
}

type NoteRow = { id: string; kind: NoteKind; content: string; target_url?: string; created_at: Date; updated_at: Date; deleted_at?: Date };
type WebmentionRow = { id: number; source_url: string; target_url: string; property: Webmention['property']; status: string; author_name?: string; author_url?: string; author_photo?: string; source_name?: string; content_text?: string; published_at?: Date; received_at: Date };
export type DeliveryRow = { id: number; note_id: string; target_url: string; attempts: number };
export type AuthCodeRow = { client_id: string; redirect_uri: string; scope: string };
export type TokenRow = { client_id: string; scope: string };

const mapNote = (row: NoteRow): Note => ({ id: row.id, kind: row.kind, content: row.content, targetUrl: row.target_url, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at });
const mapWebmention = (row: WebmentionRow): Webmention => ({ id: row.id, sourceUrl: row.source_url, targetUrl: row.target_url, property: row.property, status: row.status, authorName: row.author_name, authorUrl: row.author_url, authorPhoto: row.author_photo, sourceName: row.source_name, contentText: row.content_text, publishedAt: row.published_at, receivedAt: row.received_at });
const required = (name: string) => {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
};
