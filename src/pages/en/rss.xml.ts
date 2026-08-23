import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';

import { SITE_TITLE, SITE_DESCRIPTION } from '../../consts';

const parser = new MarkdownIt();

export async function GET(context: any) {
	const posts = await getCollection('blogEn');
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.filter((x) => !x.data.hidden).map((post) => ({
			title: post.data.title,
			pubDate: post.data.publishDate,
			description: post.data.description,
			content: parser.render(post.body ?? ''),
			link: `/en/blog/${post.id}/`,
		})),
	});
}
