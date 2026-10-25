import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareGallery, publishGallery } from '../../scripts/travel-media.mts';
import { ContentStore, AdminError } from './store';
import { slugSchema } from '../../src/data/travel.mts';

export type Job = {
	id: string;
	stage: 'queued' | 'preparing' | 'publishing' | 'done' | 'error';
	message: string;
	gallery: string;
};
export class MediaManager {
	readonly state: ContentStore;
	readonly jobs = new Map<string, Job>();
	private readonly controller = new AbortController();
	private readonly tasks = new Set<Promise<void>>();
	async stop() {
		this.controller.abort();
		await Promise.all(this.tasks);
	}
	constructor(
		readonly store: ContentStore,
		readonly publisher = publishGallery,
		stateRoot = '.state/admin',
	) {
		this.state = new ContentStore(stateRoot);
	}
	private async pendingFile(id: string) {
		return this.state.safePath(
			join(this.state.root, 'pending', `${slugSchema.parse(id)}.json`),
		);
	}
	async pending(id: string): Promise<string[]> {
		try {
			return JSON.parse(await readFile(await this.pendingFile(id), 'utf8'));
		} catch (error: any) {
			if (error.code === 'ENOENT') return [];
			throw error;
		}
	}
	private async savePending(id: string, batches: string[]) {
		const file = await this.pendingFile(id);
		await mkdir(join(this.state.root, 'pending'), { recursive: true });
		const temp = `${file}.${randomUUID()}.tmp`;
		await writeFile(temp, JSON.stringify(batches));
		await rename(temp, file);
	}
	start(
		gallery: string,
		stage: 'preparing' | 'publishing',
		work: () => Promise<void>,
	) {
		slugSchema.parse(gallery);
		const job: Job = {
			id: randomUUID(),
			stage: 'queued',
			message: 'Ожидание операции',
			gallery,
		};
		this.jobs.set(job.id, job);
		const task = this.store.exclusive(async () => {
			job.stage = stage;
			job.message =
				stage === 'preparing'
					? 'Обработка фото и видео'
					: 'Загрузка и проверка S3';
			try {
				this.controller.signal.throwIfAborted();
				await work();
				job.stage = 'done';
				job.message = 'Готово';
			} catch (error: any) {
				job.stage = 'error';
				job.message = error.message;
			}
			// Keep the polling registry bounded during long editing sessions.
			if (this.jobs.size > 100)
				for (const [id, old] of this.jobs)
					if (id !== job.id && ['done', 'error'].includes(old.stage)) {
						this.jobs.delete(id);
						if (this.jobs.size <= 100) break;
					}
		});
		this.tasks.add(task);
		void task.finally(() => this.tasks.delete(task));
		return job;
	}
	async prepare(
		galleryId: string,
		batchId: string,
		files: { id: string; file: string }[],
		version: string | null,
	) {
		const current = (await this.store.galleries()).find(
			(g) => g.id === galleryId,
		);
		if ((current?.version ?? null) !== version)
			throw new AdminError(
				'Галерея изменена. Обновите список и повторите загрузку.',
				409,
			);
		const dir = await this.state.safePath(
			join(this.state.root, 'uploads', batchId),
		);
		const input = join(dir, 'input.json');
		await writeFile(
			input,
			JSON.stringify({
				id: batchId,
				items: files.map((f) => ({ ...f, alt: { ru: '', en: '' } })),
			}),
		);
		const prepared = await prepareGallery(
			input,
			join(dir, 'manifests'),
			this.controller.signal,
		);
		this.controller.signal.throwIfAborted();
		// Record the pending batch first; a crash cannot leave visible media marked as uploaded.
		await this.savePending(galleryId, [
			...(await this.pending(galleryId)),
			batchId,
		]);
		await this.store.saveGallery(
			{ id: galleryId, items: [...(current?.items ?? []), ...prepared.items] },
			version,
		);
	}
	publish(galleryId: string) {
		return this.start(galleryId, 'publishing', async () => {
			const gallery = (await this.store.galleries()).find(
				(g) => g.id === galleryId,
			);
			if (!gallery) throw new AdminError('Галерея не найдена', 404);
			for (const batch of await this.pending(galleryId)) {
				await this.publisher(
					batch,
					gallery.items.map((item) => item.id),
					this.controller.signal,
				);
				await this.savePending(
					galleryId,
					(await this.pending(galleryId)).filter((id) => id !== batch),
				);
			}
		});
	}
}
