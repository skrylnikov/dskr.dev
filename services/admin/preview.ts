import { dev } from 'astro';
import { resolve } from 'node:path';

const server = await dev({
	root: resolve(import.meta.dirname, '../..'),
	server: { host: '127.0.0.1', port: 4324 },
});
async function stop() {
	await server.stop();
	process.exit(0);
}
process.once('SIGTERM', () => void stop());
process.once('SIGINT', () => void stop());
