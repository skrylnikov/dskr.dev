import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from 'rehype-external-links';

// https://astro.build/config
export default defineConfig({
	site: 'https://dskr.dev',
	integrations: [mdx(), sitemap()],
	markdown: {
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
