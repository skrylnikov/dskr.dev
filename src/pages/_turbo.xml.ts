import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';

import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

const parser = new MarkdownIt();

export async function get(context: any) {
	const posts = await getCollection('blog');
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.filter((x) => !x.data.hidden).map((post) => {
      return ({
      title: post.data.title,
      pubDate: post.data.publishDate,
      description: post.data.description.replaceAll(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, ''),
      // customData: post.data.customData,
      content: parser.render(post.body).replaceAll(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, ''),
      // Compute RSS link from post `slug`
      // This example assumes all posts are rendered as `/blog/[slug]` routes
      link: `/blog/${post.slug}/`,
      'turbo:content': parser.render(post.body).replaceAll(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, ''),
      "turbo:source": `/blog/${post.slug}/`,
      "turbo:extendedHtml": true
		})}),
    
	});
}
