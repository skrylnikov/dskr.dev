import type { TravelMedia } from '../data/travel.mts';
import { mediaPreview, mediaSource, srcset } from '../data/travel-media.mts';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
// A local 1×1 image checks decoding support without a network request or browser sniffing.
const supportsJxl = new Promise<boolean>((resolve) => {
	const image = new Image();
	image.onload = () => resolve(image.naturalWidth === 1);
	image.onerror = () => resolve(false);
	image.src = 'data:image/jxl;base64,/woAEBAJCAIBAJgCSxibnHGEAziAAzggSsA5BQEAIESACBABIkDk/5F7+h5aZ1dVVVUlSZIQUHd3d3d3////v1VvZmZmBv7fv+e/h8acc661z71JkiQEVFVVVVVV////z72vu7u7G/7fv+e/h8acc661z71JkiQEVFVVVVVV////z72vu7u7G/7fv+e/h8acc661z71JkiQEVFVVVVVV////z72vu7u7+wIhALiAu9vtMA==';
});

class TravelGallery extends HTMLElement {
	private visible = 6;
	private lightbox?: { destroy(): void; openAt(index: number): void };
	private opener?: HTMLElement;
	private loading = false;
	private generation = 0;
	private items: TravelMedia[] = [];
	private get locale(): 'ru' | 'en' { return this.dataset.locale === 'en' ? 'en' : 'ru'; }
	connectedCallback() {
		this.items = JSON.parse(this.querySelector('[data-gallery-items]')!.textContent!);
		this.querySelector<HTMLButtonElement>('[data-show-more]')?.removeAttribute('hidden');
		this.addEventListener('click', this.onClick);
		this.addEventListener('error', this.onMediaError, true);
	}
	disconnectedCallback() {
		this.generation++;
		this.lightbox?.destroy();
		this.lightbox = undefined;
		this.loading = false;
		this.removeEventListener('click', this.onClick);
		this.removeEventListener('error', this.onMediaError, true);
	}
	private onMediaError = (event: Event) => {
		const image = event.target;
		if (image instanceof HTMLImageElement) image.closest('a')?.classList.add('travel-media-error');
	};
	private onClick = (event: MouseEvent) => {
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('[data-show-more]')) {
			const end = Math.min(this.items.length, this.visible + 24);
			const grid = this.querySelector('.travel-media-grid')!;
			for (let index = this.visible; index < end; index++) grid.append(this.thumbnail(this.items[index], index));
			this.visible = end;
			const button = this.querySelector<HTMLButtonElement>('[data-show-more]')!;
			button.hidden = end === this.items.length;
			button.querySelector('[data-remaining]')!.textContent = String(this.items.length - end);
			if (button.hidden) this.querySelector<HTMLElement>(`[data-media-index="${end - 1}"]`)?.focus({ preventScroll: true });
			return;
		}
		const link = target?.closest<HTMLAnchorElement>('[data-media-index]');
		if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		void this.open(Number(link.dataset.mediaIndex), link);
	};
	private thumbnail(media: TravelMedia, index: number) {
		const figure = document.createElement('figure');
		const link = document.createElement('a');
		link.href = mediaSource(media);
		link.dataset.mediaIndex = String(index);
		link.setAttribute('aria-label', media.alt[this.locale]);
		const picture = document.createElement('picture');
		if (media.kind === 'image') {
			if (srcset(media, 'jxl')) {
				const source = document.createElement('source');
				source.type = 'image/jxl'; source.srcset = srcset(media, 'jxl'); source.sizes = '(max-width: 600px) 90vw, 400px';
				picture.append(source);
			}
			const source = document.createElement('source');
			source.type = 'image/webp'; source.srcset = srcset(media, 'webp'); source.sizes = '(max-width: 600px) 90vw, 400px';
			picture.append(source);
		}
		const image = document.createElement('img');
		image.alt = media.alt[this.locale]; image.width = media.width; image.height = media.height;
		image.loading = 'lazy'; image.decoding = 'async';
		if (media.kind === 'image') { image.srcset = srcset(media, 'jpeg'); image.sizes = '(max-width: 600px) 90vw, 400px'; }
		image.src = mediaPreview(media); picture.append(image); link.append(picture);
		if (media.kind === 'video') {
			const badge = document.createElement('span'); badge.className = 'travel-video-badge';
			badge.textContent = `▶ ${Math.floor(media.duration / 60)}:${String(Math.floor(media.duration % 60)).padStart(2, '0')}`; link.append(badge);
		}
		figure.append(link);
		if (media.caption?.[this.locale]) { const caption = document.createElement('figcaption'); caption.textContent = media.caption[this.locale]; figure.append(caption); }
		return figure;
	}
	private async open(index: number, link: HTMLElement) {
		if (this.loading) return;
		this.opener = link;
		if (this.lightbox) { this.lightbox.openAt(index); return; }
		this.loading = true;
		const generation = this.generation;
		try {
			const [{ default: GLightbox }, , useJxl] = await Promise.all([import('glightbox'), import('glightbox/dist/css/glightbox.css'), supportsJxl]);
			if (!this.isConnected || generation !== this.generation) return;
			const videos: HTMLVideoElement[] = [];
			const elements = this.items.map((media) => {
				const description = escapeHtml(media.caption?.[this.locale] || '');
				if (media.kind === 'image') {
					const jxl = useJxl ? media.sources.filter((source) => source.format === 'jxl').sort((a, b) => b.width - a.width)[0] : undefined;
					return { href: jxl?.url ?? mediaSource(media), type: 'image', alt: media.alt[this.locale], description, sizes: '100vw', srcset: srcset(media, jxl ? 'jxl' : 'jpeg') };
				}
				const wrapper = document.createElement('div'); wrapper.className = 'travel-viewer-video';
				const video = document.createElement('video'); video.controls = true; video.playsInline = true; video.preload = 'none';
				video.dataset.poster = media.poster; video.dataset.src = media.url; video.setAttribute('aria-label', media.alt[this.locale]);
				video.width = media.width; video.height = media.height;
				const fallback = document.createElement('a'); fallback.href = media.url; fallback.textContent = this.dataset.error!;
				video.addEventListener('error', () => { fallback.hidden = false; }); fallback.hidden = true;
				wrapper.append(video, fallback); videos.push(video);
				return { content: wrapper, type: 'inline', description, width: 'auto', height: 'auto' };
			});
			const stopVideos = () => { for (const video of videos) video.pause(); };
			const hydrateVideo = (event?: { current?: { slideNode: HTMLElement }; slideNode?: HTMLElement }) => {
				if (!event) return;
				const video = (event.current?.slideNode ?? event.slideNode)?.querySelector('video');
				if (video && !video.hasAttribute('src')) { video.poster = video.dataset.poster!; video.src = video.dataset.src!; }
			};
			const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
			// GLightbox's bundled types incorrectly declare the slide list as an empty tuple.
			const options = { elements, preload: false, autoplayVideos: false, loop: false, openEffect: reduced ? 'none' : 'fade', closeEffect: reduced ? 'none' : 'fade', slideEffect: reduced ? 'none' : 'slide', moreLength: 0 };
			const lightbox = GLightbox(options as Parameters<typeof GLightbox>[0]);
			this.lightbox = lightbox;
			lightbox.on('slide_before_load', (event?: { slideNode: HTMLElement; slideIndex: number }) => {
				if (!event) return;
				event.slideNode.addEventListener('error', (error) => {
					const image = error.target;
					if (!(image instanceof HTMLImageElement) || image.dataset.fallback) return;
					image.dataset.fallback = 'true';
					const fallback = document.createElement('a');
					fallback.href = mediaSource(this.items[event.slideIndex]); fallback.textContent = this.dataset.error!; fallback.className = 'travel-viewer-error';
					image.parentElement?.append(fallback);
					image.removeAttribute('srcset');
					image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#202125"/></svg>');
				}, true);
			});
			lightbox.on('slide_before_change', stopVideos);
			lightbox.on('slide_after_load', hydrateVideo);
			lightbox.on('slide_changed', hydrateVideo);
			lightbox.on('slide_changed', () => {
				const video = document.querySelector<HTMLVideoElement>('.glightbox-container .gslide.current video');
				if (!video) return;
				void video.play().catch((error: DOMException) => {
					if (error.name !== 'NotAllowedError' || !video.isConnected || !video.closest('.gslide.current')) return;
					// Some browsers allow autoplay only without sound; native controls still allow unmuting.
					video.muted = true;
					void video.play().catch(() => {});
				});
			});
			lightbox.on('close', () => { stopVideos(); this.opener?.focus({ preventScroll: true }); });
			const updateCounter = () => { const counter = document.querySelector('.travel-viewer-counter'); if (counter) counter.textContent = `${(lightbox.getActiveSlideIndex() ?? 0) + 1} / ${this.items.length}`; };
			lightbox.on('slide_changed', updateCounter);
			lightbox.on('open', () => {
				const container = document.querySelector<HTMLElement>('.glightbox-container');
				container?.setAttribute('role', 'dialog'); container?.setAttribute('aria-modal', 'true');
				container?.setAttribute('aria-label', this.locale === 'ru' ? 'Фото и видео' : 'Photos and videos');
				const counter = document.createElement('span'); counter.className = 'travel-viewer-counter';
				counter.setAttribute('aria-live', 'polite');
				container?.append(counter); updateCounter();
				const close = container?.querySelector<HTMLButtonElement>('.gclose');
				container?.querySelector('.gprev')?.setAttribute('aria-label', this.locale === 'ru' ? 'Предыдущий кадр' : 'Previous frame');
				container?.querySelector('.gnext')?.setAttribute('aria-label', this.locale === 'ru' ? 'Следующий кадр' : 'Next frame');
				close?.setAttribute('aria-label', this.dataset.close!); close?.focus();
			});
			lightbox.openAt(index);
		} catch {
			if (this.isConnected && generation === this.generation) window.location.assign(mediaSource(this.items[index]));
		} finally { this.loading = false; }
	}
}

if (!customElements.get('travel-gallery')) customElements.define('travel-gallery', TravelGallery);
