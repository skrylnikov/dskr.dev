import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import rehypeExternalLinks from 'rehype-external-links';

// https://astro.build/config
export default defineConfig({
	site: 'https://dskr.dev',
	integrations: [mdx(), sitemap()],
  markdown: {
    rehypePlugins: [
      (x) => rehypeExternalLinks({ ...x, target: '_blank'})
    ],
    extendDefaultPlugins: true,
  },
  i18n: {
    defaultLocale: 'ru',
    locales: ['ru', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
    fallback: {
      en: 'ru',
    },
  },
});
