import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: databaseUrl });
const here = dirname(fileURLToPath(import.meta.url));
const migration = await readFile(resolve(here, '../migrations/001_initial.sql'), 'utf8');

try {
	await pool.query(migration);
	console.log('IndieWeb database is ready');
} finally {
	await pool.end();
}
