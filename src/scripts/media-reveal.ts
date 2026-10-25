export function prepareMediaReveal(image: HTMLImageElement) {
	const picture = image.parentElement;
	if (!picture?.matches('picture[style*="--lqip-a:"]') || picture.dataset.mediaState || image.complete) return;
	picture.dataset.mediaState = 'loading';
	image.addEventListener('load', async () => {
		try { await image.decode(); } catch { /* A load event can race a new responsive source. */ }
		picture.dataset.mediaState = 'ready';
	}, { once: true });
	image.addEventListener('error', () => { picture.removeAttribute('data-media-state'); }, { once: true });
}

const preparePage = () => document.querySelectorAll<HTMLImageElement>('picture[style*="--lqip-a:"] > img').forEach(prepareMediaReveal);
preparePage();
document.addEventListener('astro:page-load', preparePage);
