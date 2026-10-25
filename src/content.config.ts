import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { tripSchema, entrySchema } from './data/travel.mts';

const blogSchema = z.object({
	title: z.string(),
	description: z.string(),
	publishDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	heroImage: z.string().optional(),
	hidden: z.boolean().optional(),
});

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: blogSchema,
});

const blogEn = defineCollection({
	loader: glob({ base: './src/content/blogEn', pattern: '**/*.{md,mdx}' }),
	schema: blogSchema,
});

const travelRoot = process.env.TRAVEL_CONTENT_ROOT || './src/content/travel';
function travelLoader(base: string) {
	const loader = glob({ base, pattern: '**/*.mdx', generateId: ({ entry }) => entry.replace(/\.mdx$/, '') });
	return { ...loader, load: async (context: Parameters<typeof loader.load>[0]) => {
		// Astro's empty-glob path retains old entries; clear these small collections before syncing.
		context.store.clear();
		await loader.load(context);
	} };
}
const trips = defineCollection({ loader: travelLoader(`${travelRoot}/trips`), schema: tripSchema });
const travelEntries = defineCollection({ loader: travelLoader(`${travelRoot}/entries`), schema: entrySchema });

export const collections = { blog, blogEn, trips, travelEntries };
