import { createServer } from 'vite';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { createApi } from './api';
import { ContentStore } from './store';
import viteConfig from './vite.config';

const root = resolve(import.meta.dirname, '../..');
process.chdir(root);
const store = new ContentStore(process.env.ADMIN_CONTENT_ROOT);
let astro: ChildProcess | undefined;
let stopping = false;
async function stopPreview() {
	if (astro && astro.exitCode === null && astro.signalCode === null) {
		const child = astro;
		const exited = once(child, 'exit');
		child.kill('SIGTERM');
		const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
		await exited;
		clearTimeout(timer);
	}
	astro = undefined;
}
async function preview() {
	if (stopping) throw new Error('Админка останавливается');
	await stopPreview();
	if (stopping) throw new Error('Админка останавливается');
	const env = {
		...process.env,
		ADMIN_PREVIEW: '1',
		ADMIN_PREVIEW_CONTENT_ROOT: store.root,
		TRAVEL_CONTENT_ROOT: resolve(store.root, 'travel'),
	};
	for (const key of Object.keys(env))
		if (key.startsWith('MEDIA_S3_')) delete env[key as keyof typeof env];
	astro = spawn(
		process.execPath,
		['--import', 'tsx', resolve(import.meta.dirname, 'preview.ts')],
		{ cwd: root, env, stdio: 'inherit' },
	);
	let failure: Error | undefined;
	astro.on('error', (error) => {
		failure = error;
	});
	for (let attempt = 0; attempt < 240; attempt++) {
		if (
			stopping ||
			failure ||
			astro.exitCode !== null ||
			astro.signalCode !== null
		)
			throw failure ?? new Error('Локальный preview завершился');
		try {
			const response = await fetch('http://127.0.0.1:4324/', {
				signal: AbortSignal.timeout(1000),
			});
			if (response.ok) return;
		} catch {}
		await new Promise((done) => setTimeout(done, 250));
	}
	throw new Error('Локальный preview не запустился за 60 секунд');
}
let previewQueue = Promise.resolve();
const api = createApi({
	store,
	preview: () => {
		const next = previewQueue.then(preview, preview);
		previewQueue = next;
		return next;
	},
});
const vite = await createServer({ ...viteConfig, configFile: false });
async function stop() {
	if (stopping) return;
	stopping = true;
	await stopPreview();
	await Promise.all([api.close(), vite.close()]);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
try {
	await api.listen({ host: '127.0.0.1', port: 4323 });
	await vite.listen();
	await preview();
	console.log(
		'\nАдминка: http://127.0.0.1:4322\nGit commit и push выполняются вручную.\n',
	);
} catch (error) {
	console.error(error);
	await stop();
	process.exitCode = 1;
}
