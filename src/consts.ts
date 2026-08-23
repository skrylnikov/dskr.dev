export type Locale = 'ru' | 'en';

export const SITE_URL = 'https://dskr.dev';
export const SITE_TITLE = 'Dskr.dev';
export const SITE_META = {
	ru: {
		title: 'Dskr.dev — разработка, проекты и заметки Дмитрия Скрыльникова',
		description: 'Личный блог Дмитрия Скрыльникова о веб-разработке, TypeScript, self-hosted проектах и практических экспериментах.',
	},
	en: {
		title: 'Dskr.dev — software development, projects, and notes by Dmitriy Skrylnikov',
		description: "Dmitriy Skrylnikov's personal blog about web development, TypeScript, self-hosted projects, and practical experiments.",
	},
} satisfies Record<Locale, { title: string; description: string }>;

export const AUTHOR_NAME = 'Dmitriy Skrylnikov';
export const AUTHOR_URL = `${SITE_URL}/about/`;
export const SOCIAL_PROFILES = [
	'https://github.com/skrylnikov',
	'https://twitter.com/dskr_dev',
	'https://t.me/dskrylnikov',
	'https://www.instagram.com/dskr_dev',
	'https://bsky.app/profile/dskr.bsky.social',
	'https://mastodon.ml/@dskr',
	'https://www.threads.com/@dskr_dev',
	'https://habr.com/ru/users/dsrk_dev/',
];

const normalizedPath = (path: string) => path === '/' ? '/' : `/${path.replace(/^\/+|\/+$/g, '')}/`;

export const localizedPath = (locale: Locale, path: string) => {
	const normalized = normalizedPath(path);
	return locale === 'en' ? `/en${normalized}` : normalized;
};

export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString();

export const languageAlternates = (path: string) => [
	{ hreflang: 'ru', href: absoluteUrl(localizedPath('ru', path)) },
	{ hreflang: 'en', href: absoluteUrl(localizedPath('en', path)) },
	{ hreflang: 'x-default', href: absoluteUrl(localizedPath('ru', path)) },
];
