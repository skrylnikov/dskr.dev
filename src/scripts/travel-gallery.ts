import type { TravelMedia } from '../data/travel.mts';
import { mediaPreview, mediaSource, srcset, mediaPlaceholderStyle } from '../data/travel-media.mts';
import { prepareMediaReveal } from './media-reveal';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
// A local 1×1 image checks decoding support without a network request or browser sniffing.
const supportsJxl = new Promise<boolean>((resolve) => {
	const image = new Image();
	image.onload = () => resolve(image.naturalWidth === 1);
	image.onerror = () => resolve(false);
	image.src = 'data:image/jxl;base64,/woAEBAJCAIBAJgCSxibnHGEAziAAzggSsA5BQEAIESACBABIkDk/5F7+h5aZ1dVVVUlSZIQUHd3d3d3////v1VvZmZmBv7fv+e/h8acc661z71JkiQEVFVVVVVV////z72vu7u7G/7fv+e/h8acc661z71JkiQEVFVVVVVV////z72vu7u7G/7fv+e/h8acc661z71JkiQEVFVVVVVV////z72vu7u7+wIhALiAu9vtMA==';
});

function thumbnailFrame(thumbnail: HTMLImageElement, bounds: DOMRect): Keyframe | undefined {
	const target = thumbnail.getBoundingClientRect();
	if (!target.width || !target.height || !bounds.width || !bounds.height) return;
	const fit = getComputedStyle(thumbnail).objectFit;
	const scale = (fit === 'contain' ? Math.min : Math.max)(target.width / bounds.width, target.height / bounds.height);
	const x = target.left + target.width / 2 - bounds.left - bounds.width / 2;
	const y = target.top + target.height / 2 - bounds.top - bounds.height / 2;
	// Crop to the thumbnail without stretching the photo.
	const cropX = Math.max(0, (1 - target.width / (bounds.width * scale)) * 50);
	const cropY = Math.max(0, (1 - target.height / (bounds.height * scale)) * 50);
	const radius = parseFloat(getComputedStyle(thumbnail.closest('a') ?? thumbnail).borderTopLeftRadius) || 0;
	return { transform: `translate(${x}px, ${y}px) scale(${scale})`, clipPath: `inset(${cropY}% ${cropX}% round ${radius / scale}px)` };
}

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
		// Cached failures can happen before the custom element is registered.
		for (const image of this.querySelectorAll('img')) if (image.complete && !image.naturalWidth) image.closest('a')?.classList.add('travel-media-error');
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
		figure.style.setProperty('--media-ratio', String(media.width / media.height));
		const link = document.createElement('a');
		link.href = mediaSource(media);
		link.dataset.astroPrefetch = 'false';
		link.dataset.mediaIndex = String(index);
		link.setAttribute('aria-label', media.alt[this.locale]);
		const picture = document.createElement('picture');
		picture.style.cssText = mediaPlaceholderStyle(media) ?? '';
		if (srcset(media, 'jxl')) {
			const source = document.createElement('source');
			source.type = 'image/jxl'; source.srcset = srcset(media, 'jxl'); source.sizes = '(max-width: 600px) 90vw, 400px';
			picture.append(source);
		}
		if (srcset(media, 'webp')) {
			const source = document.createElement('source');
			source.type = 'image/webp'; source.srcset = srcset(media, 'webp'); source.sizes = '(max-width: 600px) 90vw, 400px';
			picture.append(source);
		}
		const image = document.createElement('img');
		image.alt = media.alt[this.locale]; image.width = media.width; image.height = media.height;
		image.loading = 'lazy'; image.decoding = 'async';
		image.srcset = srcset(media, 'jpeg'); image.sizes = '(max-width: 600px) 90vw, 400px';
		image.src = mediaPreview(media); picture.append(image); link.append(picture);
		prepareMediaReveal(image);
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
				const poster = useJxl ? media.posterSources?.filter((source) => source.format === 'jxl').sort((a, b) => b.width - a.width)[0] : undefined;
				video.dataset.poster = poster?.url ?? media.poster; video.dataset.src = media.url; video.setAttribute('aria-label', media.alt[this.locale]);
				video.width = media.width; video.height = media.height;
				const fallback = document.createElement('a'); fallback.href = media.url; fallback.dataset.astroPrefetch = 'false'; fallback.textContent = this.dataset.error!;
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
			let returning = false;
			let transition: { previous: HTMLElement; slide: HTMLElement; direction: number; animations: Animation[] } | undefined;
			const finishTransition = () => {
				if (!transition) return;
				for (const animation of transition.animations) animation.cancel();
				transition.previous.style.removeProperty('opacity');
				for (const preview of transition.previous.querySelectorAll('.travel-viewer-preview')) preview.remove();
				transition = undefined;
			};
			const startTransition = (slide: HTMLElement) => {
				if (!transition || transition.slide !== slide || transition.animations.length) return;
				const current = transition;
				current.slide.style.opacity = '1';
				if (reduced) { finishTransition(); return; }
				const timing = { duration: 360, easing: 'cubic-bezier(.22, .61, .36, 1)' };
				current.animations = [
					current.previous.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-current.direction * innerWidth}px)` }], timing),
					current.slide.animate([{ transform: `translateX(${current.direction * innerWidth}px)` }, { transform: 'translateX(0)' }], timing),
				];
				void Promise.allSettled(current.animations.map((animation) => animation.finished)).then(() => { if (transition === current) finishTransition(); });
			};
			const previews = new Map<HTMLElement, HTMLImageElement>();
			const clearPreviews = () => { for (const preview of previews.values()) preview.remove(); previews.clear(); };
			const layoutPhoto = (slide: HTMLElement) => {
				const media = this.items[Number(slide.dataset.mediaIndex)];
				const image = slide.querySelector<HTMLImageElement>('.gslide-image img');
				if (!image || !media || media.kind !== 'image' || slide.classList.contains('zoomed')) return;
				const captionHeight = slide.querySelector<HTMLElement>('.gslide-description')?.offsetHeight ?? 0;
				const scale = Math.min(1, innerWidth / media.width, Math.max(1, innerHeight * .97 - captionHeight) / media.height);
				slide.style.setProperty('--photo-width', `${media.width * scale}px`);
				slide.style.setProperty('--photo-height', `${media.height * scale}px`);
				const preview = previews.get(slide);
				if (preview) {
					const bounds = image.getBoundingClientRect();
					preview.style.left = `${bounds.left + bounds.width / 2}px`; preview.style.top = `${bounds.top + bounds.height / 2}px`;
					preview.style.width = `${bounds.width}px`; preview.style.height = `${bounds.height}px`;
				}
			};
			const resizePhotos = () => { for (const slide of document.querySelectorAll<HTMLElement>('.glightbox-container .travel-viewer-photo')) layoutPhoto(slide); };
			const still = { in: 'none', out: 'none' };
			// GLightbox forces the slide effect on mobile; animate the complete frame ourselves.
			const options = { elements, preload: false, autoplayVideos: false, loop: false, openEffect: reduced ? 'none' : 'fade', closeEffect: 'none', slideEffect: 'none', cssEfects: { slide: still, slideBack: still }, moreLength: 0 };
			// GLightbox's bundled types incorrectly declare the slide list as an empty tuple.
			const lightbox = GLightbox({ ...options, elements: elements as [] });
			this.lightbox = lightbox;
			const close = lightbox.close.bind(lightbox);
			lightbox.close = () => {
				if (reduced || !this.isConnected) return close();
				if (returning) return false;
				const container = document.querySelector<HTMLElement>('.glightbox-container');
				if (!container) return close();
				returning = true;
				stopVideos();
				const index = lightbox.getActiveSlideIndex()!;
				const slide = container.querySelectorAll<HTMLElement>('.gslide')[index];
				const thumbnail = this.querySelector<HTMLImageElement>(`[data-media-index="${index}"] img`);
				const image = previews.get(slide) ?? slide?.querySelector<HTMLImageElement>('.gslide-image img');
				const movingBounds = transition && image?.getBoundingClientRect();
				finishTransition();
				const target = thumbnail?.getBoundingClientRect();
				let flight: Animation;
				if (image?.naturalWidth && !image.dataset.fallback && thumbnail && target?.width && target.height && target.right > 0 && target.bottom > 0 && target.left < innerWidth && target.top < innerHeight) {
					const preview = (!movingBounds && previews.get(slide)) || image.cloneNode() as HTMLImageElement;
					let start: Keyframe = { transform: 'none', clipPath: 'inset(0% 0% round 0px)' };
					container.classList.add('travel-viewer-returning');
					if (preview === image) {
						container.querySelector('.gcontainer')!.append(preview);
						const style = getComputedStyle(preview);
						start = { transform: style.transform, clipPath: style.clipPath === 'none' ? 'inset(0% 0% round 0px)' : style.clipPath };
						for (const animation of preview.getAnimations()) animation.cancel();
					} else {
						const bounds = movingBounds || image.getBoundingClientRect();
						preview.className = 'travel-viewer-preview'; preview.alt = ''; preview.setAttribute('aria-hidden', 'true');
						preview.removeAttribute('srcset'); preview.src = image.currentSrc;
						preview.style.cssText = `left: ${bounds.left + bounds.width / 2}px; top: ${bounds.top + bounds.height / 2}px; width: ${bounds.width}px; height: ${bounds.height}px; max-height: none; max-width: none`;
						container.querySelector('.gcontainer')!.append(preview);
					}
					const end = thumbnailFrame(thumbnail, preview.getBoundingClientRect());
					if (!end) return close();
					flight = preview.animate([start, end], { duration: 360, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
					container.querySelector('.goverlay')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360, fill: 'forwards' });
				} else {
					flight = container.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
				}
				void flight.finished.then(close, close);
				return false;
			};
			const updateCounter = () => { const counter = document.querySelector('.travel-viewer-counter'); if (counter) counter.textContent = `${(lightbox.getActiveSlideIndex() ?? 0) + 1} / ${this.items.length}`; };
			const showPhotoPreview = (slide: HTMLElement, index: number) => {
				if (previews.has(slide)) return previews.get(slide);
				const media = this.items[index];
				if (media.kind !== 'image') return;
				slide.classList.add('travel-viewer-photo', 'travel-viewer-pending');
				slide.dataset.mediaIndex = String(index);
				const thumbnail = this.querySelector<HTMLImageElement>(`[data-media-index="${index}"] img`);
				const preview = new Image();
				preview.className = 'travel-viewer-preview';
				preview.alt = ''; preview.setAttribute('aria-hidden', 'true');
				preview.width = media.width; preview.height = media.height;
				preview.style.setProperty('--preview-width', `${media.width}px`);
				preview.style.setProperty('--preview-ratio', String(media.width / media.height));
				const discard = () => { if (previews.get(slide) === preview) { startTransition(slide); previews.delete(slide); } preview.remove(); };
				preview.onerror = discard;
				preview.src = thumbnail?.currentSrc || mediaPreview(media);
				const container = slide.closest('.gcontainer')!;
				const opening = !container.querySelector('.travel-viewer-counter');
				(opening ? container : slide).append(preview);
				previews.set(slide, preview);
				// GLightbox inserts the photo and caption after slide_before_load returns.
				queueMicrotask(() => {
					if (returning || !preview.isConnected) return;
					layoutPhoto(slide);
					if (!opening) {
						void preview.decode().then(() => {
							if (returning || previews.get(slide) !== preview) return;
							startTransition(slide);
						}, discard);
						return;
					}
					if (reduced || !thumbnail) return;
					const start = thumbnailFrame(thumbnail, preview.getBoundingClientRect());
					if (start) {
						slide.classList.add('travel-viewer-opening');
						const flight = preview.animate([
							start,
							{ transform: 'none', clipPath: 'inset(0% 0% round 0px)' },
						], { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' });
						const finish = () => slide.classList.remove('travel-viewer-opening');
						void flight.finished.then(finish, finish);
					}
				});
				return preview;
			};
			lightbox.on('slide_before_load', (event?: { slideNode: HTMLElement; slideIndex: number }) => {
				if (!event || returning) return;
				updateCounter();
				showPhotoPreview(event.slideNode, event.slideIndex);
				event.slideNode.addEventListener('error', (error) => {
					const image = error.target;
					if (!(image instanceof HTMLImageElement) || image.dataset.fallback) return;
					image.dataset.fallback = 'true';
					const fallback = document.createElement('a');
					fallback.href = mediaSource(this.items[event.slideIndex]); fallback.dataset.astroPrefetch = 'false'; fallback.textContent = this.dataset.error!; fallback.className = 'travel-viewer-error';
					image.parentElement?.append(fallback);
					image.removeAttribute('srcset');
					image.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#202125"/></svg>');
				}, true);
			});
			lightbox.on('slide_after_load', (event?: { slideNode: HTMLElement; slideIndex: number }) => {
				if (!event) return;
				const stale = () => event.slideIndex !== lightbox.getActiveSlideIndex();
				if (stale()) {
					event.slideNode.classList.remove('current', 'prev', 'gfadeIn', 'travel-viewer-pending');
					for (const preview of event.slideNode.querySelectorAll('.travel-viewer-preview')) preview.remove();
					return;
				}
				const preview = previews.get(event.slideNode);
				const image = event.slideNode.querySelector<HTMLImageElement>('.gslide-image img');
				if (!image) return;
				const reveal = async () => {
					if (returning || stale() || previews.get(event.slideNode) !== preview) return;
					event.slideNode.classList.remove('travel-viewer-pending');
					startTransition(event.slideNode);
					if (!preview) return;
					await Promise.allSettled(preview.getAnimations().map((animation) => animation.finished));
					if (returning || stale() || previews.get(event.slideNode) !== preview) return;
					previews.delete(event.slideNode);
					if (reduced || image.dataset.fallback || !preview.naturalWidth || !preview.isConnected) { preview.remove(); return; }
					preview.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' }).finished.then(() => preview.remove(), () => preview.remove());
				};
				void image.decode().then(reveal, reveal);
			});
			lightbox.on('slide_before_change', (event?: { prev?: { slideNode: HTMLElement; slideIndex: number } }) => {
				stopVideos();
				if (returning) return;
				finishTransition();
				const previous = event?.prev?.slideNode;
				const previousPreview = previous && previews.get(previous);
				if (previous && previousPreview) { previews.delete(previous); previous.append(previousPreview); }
				clearPreviews(); updateCounter();
				const index = lightbox.getActiveSlideIndex()!;
				const slide = document.querySelectorAll<HTMLElement>('.glightbox-container .gslider > .gslide')[index];
				if (!slide || !previous) return;
				for (const preview of slide.querySelectorAll('.travel-viewer-preview')) preview.remove();
				transition = { previous, slide, direction: index > event!.prev!.slideIndex ? 1 : -1, animations: [] };
				previous.style.opacity = '1'; slide.style.opacity = '0';
				const image = slide.querySelector<HTMLImageElement>('.gslide-image img');
				if (!(image?.complete && image.naturalWidth) && showPhotoPreview(slide, index)) return;
				queueMicrotask(() => startTransition(slide));
			});
			lightbox.on('slide_after_load', hydrateVideo);
			lightbox.on('slide_changed', hydrateVideo);
			lightbox.on('slide_changed', () => {
				queueMicrotask(() => {
					const video = document.querySelector<HTMLVideoElement>('.glightbox-container .gslide.current video');
					if (!video) return;
					void video.play().catch((error: DOMException) => {
						if (error.name !== 'NotAllowedError' || !video.isConnected || !video.closest('.gslide.current')) return;
						// Some browsers allow autoplay only without sound; native controls still allow unmuting.
						video.muted = true;
						void video.play().catch(() => {});
					});
				});
			});
			lightbox.on('close', () => { window.removeEventListener('resize', resizePhotos); finishTransition(); returning = false; stopVideos(); clearPreviews(); this.opener?.focus({ preventScroll: true }); });
			lightbox.on('slide_changed', updateCounter);
			lightbox.on('open', () => {
				window.addEventListener('resize', resizePhotos);
				const container = document.querySelector<HTMLElement>('.glightbox-container');
				container?.setAttribute('role', 'dialog'); container?.setAttribute('aria-modal', 'true');
				container?.setAttribute('aria-label', this.locale === 'ru' ? 'Фото и видео' : 'Photos and videos');
				const counter = document.createElement('span'); counter.className = 'travel-viewer-counter';
				counter.setAttribute('aria-live', 'polite');
				container?.querySelector('.gcontainer')?.append(counter); updateCounter();
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
