import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from 'rehype-external-links';

const hiddenPages = new Set([
	'https://dskr.dev/blog/dskr-dev-part-1/',
	'https://dskr.dev/blog/dskr-dev-part-2/',
	'https://dskr.dev/blog/dskr-dev-part-3/',
	'https://dskr.dev/blog/performance-ssr-in-preact/',
]);

// https://astro.build/config
export default defineConfig({
	site: 'https://dskr.dev',
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => !hiddenPages.has(page),
		}),
	],
	markdown: {
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			defaultColor: false,
		},
		processor: unified({
			rehypePlugins: [[rehypeExternalLinks, { target: '_blank' }]],
		}),
	},
	i18n: {
		defaultLocale: 'ru',
		locales: ['ru', 'en'],
		routing: {
			prefixDefaultLocale: false,
		},
	},
});
