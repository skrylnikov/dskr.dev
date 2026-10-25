import { z } from 'astro/zod';

export const blogSchema = z.object({
	title: z.string().min(1),
	description: z.string().min(1),
	publishDate: z.coerce.date(),
	updatedDate: z.coerce.date().optional(),
	heroImage: z.string().optional(),
	hidden: z.boolean().optional(),
});
