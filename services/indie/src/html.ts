import { parseHTML } from 'linkedom';

export type ParsedSource = {
	property: 'mention-of' | 'in-reply-to' | 'like-of';
	authorName?: string;
	authorUrl?: string;
	authorPhoto?: string;
	sourceName?: string;
	contentText?: string;
	publishedAt?: Date;
};

export const escapeHtml = (value: unknown) => String(value ?? '')
	.replaceAll('&', '&amp;')
	.replaceAll('<', '&lt;')
	.replaceAll('>', '&gt;')
	.replaceAll('"', '&quot;')
	.replaceAll("'", '&#39;');

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() || undefined;

const href = (element: Element | null | undefined, base: string) => {
	const value = element?.getAttribute('href');
	if (!value) return undefined;
	try {
		const url = new URL(value, base);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
	} catch {
		return undefined;
	}
};

export const hasExactLink = (html: string, sourceUrl: string, target: string) => {
	const { document } = parseHTML(html);
	return [...document.querySelectorAll('[href], [src]')].some((element) => {
		const value = element.getAttribute('href') ?? element.getAttribute('src');
		try {
			return value ? new URL(value, sourceUrl).toString() === target : false;
		} catch {
			return false;
		}
	});
};

export const parseSource = (html: string, sourceUrl: string, targetUrl: string): ParsedSource => {
	const { document } = parseHTML(html);
	const entry = document.querySelector('.h-entry') ?? document.body;
	const reply = [...entry.querySelectorAll('.u-in-reply-to')].map((element) => href(element, sourceUrl)).includes(targetUrl);
	const like = [...entry.querySelectorAll('.u-like-of')].map((element) => href(element, sourceUrl)).includes(targetUrl);
	const author = entry.querySelector('.p-author.h-card, .h-card');
	const published = entry.querySelector('.dt-published');
	const publishedValue = published?.getAttribute('datetime') ?? published?.getAttribute('content');

	return {
		property: reply ? 'in-reply-to' : like ? 'like-of' : 'mention-of',
		authorName: text(author?.querySelector('.p-name')) ?? text(author),
		authorUrl: href(author?.querySelector('.u-url'), sourceUrl),
		authorPhoto: href(author?.querySelector('.u-photo'), sourceUrl),
		sourceName: text(entry.querySelector('.p-name')),
		contentText: text(entry.querySelector('.e-content')) ?? text(entry),
		publishedAt: publishedValue ? new Date(publishedValue) : undefined,
	};
};

export const discoverWebmentionEndpoint = (html: string, targetUrl: string, linkHeader?: string | null) => {
	const headerMatch = linkHeader?.match(/<([^>]+)>\s*;\s*[^,]*rel\s*=\s*["']?([^,;"']+)["']?/i);
	if (headerMatch && headerMatch[2].split(/\s+/).includes('webmention')) {
		return new URL(headerMatch[1], targetUrl).toString();
	}

	const { document } = parseHTML(html);
	const element = document.querySelector('link[rel~="webmention"], a[rel~="webmention"]');
	const value = element?.getAttribute('href');
	return value ? new URL(value, targetUrl).toString() : undefined;
};
